#!/usr/bin/env python3
"""Krok 1 — podzial bundli markdown na pojedyncze dokumenty zrodlowe + indeks.

Wejscie : .work/src/*.md  (konwersje markdown paczek zip)
Wyjscie : out/zrodla/<ID>__<slug>.md  oraz  out/indeks_zrodel.json
"""
import json
import os
import re
import sys
import unicodedata

SRC = ".work/src"
DST = "out/zrodla"
IDX = "out/indeks_zrodel.json"

EXT = r"(?:docx|pdf|xlsx|pptx|md|html|htm|txt|csv|json|zip)"
BOUNDARY = re.compile(rf"^##\s+(?P<name>\S.{{0,160}}?\.{EXT}(?:\s*\([0-9]+\))?(?:\s*\.{EXT})?)\s*$", re.I)

# --- klasyfikacja do grup -------------------------------------------------
GROUPS = [
    ("G1", "Specyfikacja funkcjonalno-techniczna",
     [r"specyfikac", r"master_\d", r"master \d", r"_app_spec", r"23_moduly", r"30_modulow",
      r"architektur", r"komponent", r"taksonomia", r"struktura_warstwowa", r"struktura_merytoryczna"]),
    ("G2", "Rejestry funkcji i macierze",
     [r"rejestr", r"macierz", r"115_funkcji", r"185_funkcji", r"160-funkcji", r"309", r"299",
      r"analiza_relacyjna", r"punkty_wspolnych?", r"punkty_wspolne", r"system_punktow", r"funkcje_ewolucja",
      r"produkty_moduly", r"katalog-urzadzen", r"pokrycie-api", r"klasy-komponentow"]),
    ("G3", "Model biznesowy i monetyzacja",
     [r"biznesplan", r"monetyzac", r"przychod", r"rentownosc", r"model_agregacyjny", r"kto_placi",
      r"freemium", r"kliniki", r"podstawy-monetyzacja", r"struktura-przychody", r"alternatywy_koszty",
      r"skad_roznica_kosztow", r"koszty"]),
    ("G4", "Regulacje, certyfikacja i zgodnosc",
     [r"norm", r"certyfikac", r"mdr", r"ivdr", r"rodo", r"licencj", r"zgod", r"ikp", r"ezdrowie",
      r"p1_do_20", r"p1 do 20", r"statut", r"podmiot_zgody", r"mapowanie-panstwo", r"prawn"]),
    ("G5", "Strategia, roadmapa i plan korporacyjny",
     [r"roadmap", r"plan_korporacyjny", r"plan-90dni", r"sekwencja", r"dekompozycj", r"wizja",
      r"projekty_", r"projekty-", r"moonshot", r"40_projektow", r"model_doboru", r"skala-czas",
      r"architektura-50lat", r"punkt\d", r"punkt_", r"piec_", r"trzy_warianty", r"jak_to_zbudowac",
      r"model_orkiestratora", r"hub_i_forge", r"marketplace", r"forma_lata"]),
    ("G6", "Audyty, oceny i weryfikacje",
     [r"audyt", r"ocena", r"oceny", r"weryfikac", r"krytyczn", r"braki", r"luki", r"werdykt",
      r"analiza_zbiorcza", r"analiza_chatgpt", r"dane_zweryfikowane", r"hipotez", r"wykonalnosc"]),
    ("G7", "Konwersacje zrodlowe i rejestry pytan",
     [r"konwersacj", r"chat ?gpt", r"pytani", r"odpowiedzi", r"rejestr-pytan", r"model_odpowiedzi",
      r"model-odpowiedzi"]),
    ("G8", "Materialy prezentacyjne (pitch)",
     [r"pitch", r"podsumowanie_wykonawcze", r"podsumowanie wykonawcze", r"karty_produktowe",
      r"co_nas_wyroznia", r"marketing"]),
]
GROUP_NAMES = {g: n for g, n, _ in GROUPS}
GROUP_NAMES["G9"] = "Pozostale dokumenty robocze"


def deacc(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def classify(name: str, body: str) -> str:
    key = deacc(name).lower()
    for gid, _, pats in GROUPS:
        for p in pats:
            if re.search(p, key):
                return gid
    head = deacc(body[:4000]).lower()
    best, score = "G9", 0
    for gid, _, pats in GROUPS:
        s = sum(len(re.findall(p, head)) for p in pats)
        if s > score:
            best, score = gid, s
    return best if score >= 3 else "G9"


def slug(name: str) -> str:
    s = deacc(name).lower()
    s = re.sub(r"\.[a-z0-9]+$", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:70] or "dokument"


def main() -> int:
    os.makedirs(DST, exist_ok=True)
    for f in os.listdir(DST):
        os.remove(os.path.join(DST, f))

    index, n = [], 0
    for bundle in sorted(os.listdir(SRC)):
        if not bundle.endswith(".md"):
            continue
        text = open(os.path.join(SRC, bundle), encoding="utf-8", errors="replace").read()
        lines = text.split("\n")
        marks = [(i, m.group("name").strip()) for i, ln in enumerate(lines)
                 if (m := BOUNDARY.match(ln))]
        if not marks:
            marks = [(0, bundle)]
        for j, (start, name) in enumerate(marks):
            end = marks[j + 1][0] if j + 1 < len(marks) else len(lines)
            body = "\n".join(lines[start + 1:end]).strip("\n")
            if len(body.strip()) < 40:
                continue
            n += 1
            doc_id = f"D{n:03d}"
            gid = classify(name, body)
            fname = f"{doc_id}__{slug(name)}.md"
            with open(os.path.join(DST, fname), "w", encoding="utf-8") as fh:
                fh.write(f"<!-- ID:{doc_id} | ZRODLO:{name} | PAKIET:{bundle} | GRUPA:{gid} -->\n\n")
                fh.write(f"# {name}\n\n{body}\n")
            index.append({
                "id": doc_id, "nazwa": name, "plik": fname, "pakiet": bundle,
                "grupa": gid, "grupa_nazwa": GROUP_NAMES[gid],
                "znaki": len(body), "slowa": len(body.split()),
                "linie": end - start - 1,
            })

    with open(IDX, "w", encoding="utf-8") as fh:
        json.dump({"grupy": GROUP_NAMES, "dokumenty": index}, fh, ensure_ascii=False, indent=1)

    print(f"Dokumentow: {len(index)}   znakow: {sum(d['znaki'] for d in index):,}")
    from collections import Counter
    for g, c in sorted(Counter(d["grupa"] for d in index).items()):
        print(f"  {g} {GROUP_NAMES[g]:<45} {c:>4}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
