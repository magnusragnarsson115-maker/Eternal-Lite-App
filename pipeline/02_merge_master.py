#!/usr/bin/env python3
"""Krok 2 — scalenie wszystkich dokumentow zrodlowych w jeden plik glowny
oraz segmentacja na bloki z ocena autorytetu dokumentu.

Wyjscie:
  out/00_MASTER_ZRODLOWY.md   — cala tresc zrodlowa w jednym pliku
  .work/bloki.jsonl           — bloki tresci do deduplikacji
  .work/autorytet.json        — ocena autorytetu (aktualnosc/kompletnosc) dokumentow
"""
import json
import os
import re
import unicodedata
from datetime import date

IDX = "out/indeks_zrodel.json"
DST = "out/zrodla"
MASTER = "out/00_MASTER_ZRODLOWY.md"
BLOCKS = ".work/bloki.jsonl"
AUTH = ".work/autorytet.json"

MIESIACE = {
    "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5, "czerwca": 6,
    "lipca": 7, "sierpnia": 8, "wrzesnia": 9, "pazdziernika": 10, "listopada": 11, "grudnia": 12,
}


def deacc(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


GRANICA_OD = date(2024, 1, 1)
GRANICA_DO = date(2026, 12, 31)


def wykryj_date(body: str):
    """Najpozniejsza data POWSTANIA dokumentu z jego naglowka.

    Daty poza oknem autorskim sa odrzucane — w tresci wystepuja horyzonty
    planistyczne (2030, 2036, 2050), ktore nie sa data dokumentu.
    """
    head = deacc(body[:6000]).lower()
    best = None
    kandydaci = []
    for m in re.finditer(r"\b(\d{1,2})\s+(" + "|".join(MIESIACE) + r")\s+(\d{4})\b", head):
        kandydaci.append((int(m.group(3)), MIESIACE[m.group(2)], int(m.group(1))))
    for m in re.finditer(r"\b(20\d{2})-(\d{2})-(\d{2})\b", head):
        kandydaci.append((int(m.group(1)), int(m.group(2)), int(m.group(3))))
    for m in re.finditer(r"\b(\d{1,2})\.(\d{2})\.(20\d{2})\b", head):
        kandydaci.append((int(m.group(3)), int(m.group(2)), int(m.group(1))))
    for y, mo, dd in kandydaci:
        try:
            d = date(y, mo, dd)
        except ValueError:
            continue
        if not (GRANICA_OD <= d <= GRANICA_DO):
            continue
        if best is None or d > best:
            best = d
    return best.isoformat() if best else None


MARKERY = [
    (r"\bfinal(ny|na)?\b", 3.0), (r"\bkompletn", 2.0), (r"\bscalon", 2.5),
    (r"\bujednolicon", 2.0), (r"\bpoprawion", 1.5), (r"\bmaster\b", 1.5),
    (r"\bobowiazujac", 2.0), (r"\bv2\b", 1.0), (r"\bzastepuje\b", 2.0),
    (r"\bdraft\b", -2.0), (r"\brobocz", -1.0), (r"\bszkic\b", -1.5),
]


def autorytet(nazwa: str, body: str):
    key = deacc(nazwa).lower()
    pkt = 0.0
    wersja = 0.0
    # uwaga: zamiast \b musi byc (?![0-9]) — po "5_4" nastepuje "_FINAL",
    # a podkreslenie jest znakiem slowa, wiec \b nigdy by tu nie zadzialalo
    m = re.search(r"(?:master|specyfikacja|spec|v|_)[ _]?(\d)[._](\d)(?![0-9])", key)
    if m:
        wersja = float(f"{m.group(1)}.{m.group(2)}")
    else:
        m = re.search(r"\bv(\d)\b", key)
        if m:
            wersja = float(m.group(1))
    # numer wersji w nazwie jest najsilniejszym sygnalem aktualnosci w tym korpusie
    # (Master 5.4 zastepuje 3.1, ktore zastepuje 3.0)
    pkt += wersja * 2.5
    for pat, w in MARKERY:
        if re.search(pat, key):
            pkt += w
    head = deacc(body[:3000]).lower()
    for pat, w in MARKERY:
        if re.search(pat, head):
            pkt += w * 0.4
    d = wykryj_date(body)
    if d:
        # skala aktualnosci: 0 pkt dla stycznia 2024, +0.35 za kazdy kolejny miesiac
        y, mo, _ = (int(x) for x in d.split("-"))
        pkt += ((y - 2024) * 12 + mo - 1) * 0.35
    pkt += min(len(body) / 120000.0, 3.0)  # kompletnosc
    return round(pkt, 3), d, wersja


FENCE = re.compile(r"^```")


def bloki_z_dokumentu(doc_id: str, body: str):
    """Segmentacja: akapit / tabela / blok kodu, z kontekstem naglowka."""
    lines = body.split("\n")
    out, buf, h1, h2 = [], [], "", ""
    in_fence = False

    def flush():
        nonlocal buf
        txt = "\n".join(buf).strip()
        buf = []
        # prog dlugosci musi byc niski: naglowki sekcji zapisane pogrubieniem
        # ("**5\\. Dane**" — 11 znakow) sa krotsze niz akapit, a niosa strukture
        # calego dokumentu. Odrzucamy tylko czyste artefakty konwersji.
        if len(txt) >= 3 and re.search(r"[0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]", txt):
            out.append({"doc": doc_id, "n": len(out), "h1": h1, "h2": h2, "txt": txt})

    for ln in lines:
        if FENCE.match(ln):
            buf.append(ln)
            if in_fence:
                in_fence = False
                flush()
            else:
                in_fence = True
            continue
        if in_fence:
            buf.append(ln)
            continue
        if ln.startswith("#"):
            flush()
            lvl = len(ln) - len(ln.lstrip("#"))
            tytul = ln.lstrip("#").strip()
            if lvl <= 2:
                h1, h2 = tytul, ""
            else:
                h2 = tytul
            out.append({"doc": doc_id, "n": len(out), "h1": h1, "h2": h2,
                        "txt": ln.strip(), "naglowek": True})
            continue
        if not ln.strip():
            flush()
            continue
        buf.append(ln)
    flush()
    return out


def main():
    idx = json.load(open(IDX, encoding="utf-8"))
    docs = idx["dokumenty"]
    grupy = idx["grupy"]
    os.makedirs(".work", exist_ok=True)

    auth, wszystkie_bloki = {}, []
    with open(MASTER, "w", encoding="utf-8") as mf:
        mf.write("# ETERNAL — PLIK GLOWNY: CALA TRESC ZRODLOWA\n\n")
        mf.write(f"Scalono {len(docs)} dokumentow zrodlowych. "
                 "Tresc bez zmian, w calosci, uporzadkowana wedlug grup.\n\n")
        mf.write("## Spis grup\n\n| Grupa | Nazwa | Dokumentow |\n|---|---|---|\n")
        for gid in sorted(grupy):
            c = sum(1 for d in docs if d["grupa"] == gid)
            if c:
                mf.write(f"| {gid} | {grupy[gid]} | {c} |\n")
        mf.write("\n---\n\n")

        for gid in sorted(grupy):
            grupa_docs = [d for d in docs if d["grupa"] == gid]
            if not grupa_docs:
                continue
            mf.write(f"\n# GRUPA {gid} — {grupy[gid].upper()}\n\n")
            for d in grupa_docs:
                raw = open(os.path.join(DST, d["plik"]), encoding="utf-8").read()
                body = raw.split("\n", 2)[2] if raw.startswith("<!--") else raw
                body = re.sub(r"^#\s+.*\n", "", body, count=1).strip()
                pkt, dt, wer = autorytet(d["nazwa"], body)
                auth[d["id"]] = {"nazwa": d["nazwa"], "grupa": gid, "punkty": pkt,
                                 "data": dt, "wersja": wer, "znaki": len(body)}
                mf.write(f"\n## [{d['id']}] {d['nazwa']}\n\n")
                mf.write(f"> Pakiet: `{d['pakiet']}` · grupa: {gid} · "
                         f"znakow: {d['znaki']:,} · autorytet: {pkt}"
                         + (f" · data: {dt}" if dt else "") + "\n\n")
                mf.write(body + "\n\n")
                wszystkie_bloki.extend(bloki_z_dokumentu(d["id"], body))

    with open(BLOCKS, "w", encoding="utf-8") as bf:
        for b in wszystkie_bloki:
            bf.write(json.dumps(b, ensure_ascii=False) + "\n")
    json.dump(auth, open(AUTH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(f"MASTER: {os.path.getsize(MASTER):,} B")
    print(f"Blokow: {len(wszystkie_bloki):,}")
    top = sorted(auth.items(), key=lambda kv: -kv[1]["punkty"])[:8]
    print("Najwyzszy autorytet (wygrywaja w dedup. zaawansowanej):")
    for k, v in top:
        print(f"  {k} {v['punkty']:>6}  {v['nazwa'][:62]}")


if __name__ == "__main__":
    main()
