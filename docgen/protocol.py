"""Protokół sekcji — FAZA 0, BLOKADA, parser <STAN>, /QA (§6, §10)."""

import re
from . import budget as B
from . import markers as M
from .manifest import DONE, DRAFT, TODO

RE_STAN = re.compile(r"<STAN>(.*?)</STAN>", re.S)


# ---------------------------------------------------------------- FAZA 0

def faza0(man, section_id):
    """Zwraca (ok: bool, komunikat: str). Blokuje zgodnie z §6 FAZA 0 i §3."""
    problems, needs = [], []

    if man.threshold > 60:
        return False, blokada(
            section_id,
            f"próg wiarygodności {man.threshold}% przekracza 60%",
            ["dane do pola B (PROFIL PODMIOTU)",
             "albo świadoma decyzja o wariancie stubowym"],
            "(a) uzupełnij profil  (b) sama struktura z pustymi polami  "
            "(c) profil stubowy z jawną deklaracją i statusem SZKIELETOWY")

    s = man.get(section_id)
    if s is None:
        return False, blokada(section_id, "ID nie występuje w manifeście",
                              ["poprawne ID sekcji"],
                              f"dostępne: {', '.join(x.id for x in man.ready()[:8])}")
    if not s.budget:
        problems.append("brak budżetu sekcji")
        needs.append("budżet w słowach")
    if not man.profile:
        problems.append("brak PROFILU PODMIOTU (pole B)")
        needs.append("dane wyjściowe podmiotu")
    if not man.sources and not man.canon:
        problems.append("pusty REJESTR ŹRÓDEŁ i KANON")
        needs.append("co najmniej jedno źródło albo wpis kanonu")

    unmet = man.unmet_deps(section_id)
    if unmet:
        return True, (f"OSTRZEŻENIE: sekcja {section_id} ma niespełnione zależności: "
                      f"{', '.join(unmet)}. Generuj jako [SZKIC — do przepisania "
                      f"po ukończeniu {unmet[0]}].")

    if problems:
        return False, blokada(section_id, "; ".join(problems), needs,
                              "wygeneruję sekcje niezależne od profilu "
                              "(otoczenie, stan prawny, metodyka)")
    return True, "FAZA 0: OK"


def blokada(sid, przyczyna, potrzebuje, alternatywa):
    lines = [f"BLOKADA: {sid}", f"PRZYCZYNA: {przyczyna}", "POTRZEBUJĘ:"]
    lines += [f"  — {p}" for p in potrzebuje]
    lines.append(f"ALTERNATYWA: {alternatywa}")
    return "\n".join(lines)


# ---------------------------------------------------------------- <STAN>

def parse_stan(text):
    """Wyciąga blok <STAN> i zwraca słownik pól."""
    m = RE_STAN.search(text)
    if not m:
        return {}
    out, key = {}, None
    for line in m.group(1).strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" in line and re.match(r"^[A-ZŚŻŹĆÓĘĄŁŃ ]{2,}:", line):
            head, _, rest = line.partition(":")
            key = head.strip()
            out[key] = rest.strip()
        elif key:
            out[key] += " " + line
    # ID: x | SŁOWA: ok. n
    if "ID" in out and "|" in out["ID"]:
        head, _, tail = out["ID"].partition("|")
        out["ID"] = head.strip()
        if ":" in tail:
            out["SŁOWA"] = tail.split(":", 1)[1].strip()
    return out


def ingest(man, section_id, text):
    """Wchłania wygenerowaną sekcję: aktualizuje manifest i rejestry."""
    s = man.get(section_id)
    if s is None:
        raise ValueError(f"brak sekcji {section_id} w manifeście")
    stan = parse_stan(text)
    body = RE_STAN.sub("", text).strip()

    s.text = body
    s.words = len(body.split())
    s.summary = stan.get("STRESZCZENIE", "")
    s.status = DRAFT if "[SZKIC" in body else DONE

    for line in _split_items(stan.get("NOWE TERMINY", "")):
        if "=" in line:
            k, _, v = line.partition("=")
            man.terms[k.strip()] = v.strip()
    for line in _split_items(stan.get("NOWE ZAŁOŻENIA", "")):
        m = re.match(r"(Z\d+)\s*[:\-–]\s*(.+)", line)
        if m:
            man.assumptions[m.group(1)] = m.group(2).strip()
    for line in _split_items(stan.get("NOWE DECYZJE", "")):
        m = re.match(r"(D\d+)\s*[:\-–]\s*(.+)", line)
        if m:
            man.decisions[m.group(1)] = m.group(2).strip()

    return {
        "id": section_id,
        "slowa": s.words,
        "budzet": s.budget,
        "odchylenie_pct": B.deviation(s.words, s.budget),
        "status": s.status,
        "otwarte": stan.get("OTWARTE", ""),
        "kontrola": qa_section(s, man.mode),
    }


def _split_items(value):
    if not value or value.strip().lower() in {"brak", "—", "-"}:
        return []
    return [p.strip() for p in re.split(r";|\|", value) if p.strip()]


# ---------------------------------------------------------------- /QA

def qa_section(s, mode):
    """Audyt jednej sekcji. Zwraca listę (ranga, problem, propozycja)."""
    out = []
    dev = B.deviation(s.words, s.budget)
    if abs(dev) > 15:
        rank = "I" if abs(dev) <= 25 else "K"
        out.append((rank, f"odchylenie budżetu {dev:+.1f}%",
                    "przytnij lub zgłoś brak materiału — nie dobijaj watą"))
    for name, frag in M.risky_claims(s.text):
        out.append(("K", f"format podwyższonego ryzyka bez pokrycia: {name}",
                    f"dodaj [ŹRÓDŁO]/[WEB] albo [BRAK] — «{frag}»"))
    for phrase, frag in M.smoothed_gaps(s.text):
        out.append(("K", f"wygładzony brak: «{phrase}»",
                    "zastąp [BRAK: co | gdzie sprawdzić] albo [SZACUNEK: metoda, ±zakres]"))
    r = M.scan(s.text)
    if r["brak_malformed"] > 0:
        out.append(("I", f"{r['brak_malformed']} × [BRAK] bez wskazania, gdzie sprawdzić",
                    "format: [BRAK: co dokładnie | gdzie sprawdzić]"))
    for kind, frag in M.style_violations(s.text, mode):
        out.append(("D", f"{kind}: «{frag}»", "usuń lub zastąp liczbą"))
    if not s.summary:
        out.append(("I", "brak STRESZCZENIA w bloku <STAN>",
                    "dwa zdania: ustalenie główne + konsekwencja"))
    cov = r["coverage"]
    if not r["block_basis"] and sum(cov.values()) == 0 and mode != "prawny":
        out.append(("K", "sekcja bez jakiegokolwiek znacznika pokrycia",
                    "oznacz podstawę blokową albo znaczniki zdaniowe"))
    for tag, n in cov.items():
        if n > 3 and not r["block_basis"]:
            out.append(("D", f"znacznik [{tag}] użyty {n}× — przekroczony limit 3",
                        "przenieś na poziom blokowy: > PODSTAWA SEKCJI"))
    return sorted(out, key=lambda x: {"K": 0, "I": 1, "D": 2}[x[0]])


def qa_report(man, ids=None):
    ids = ids or [s.id for s in man.sections if s.text]
    lines, counts = [], {"K": 0, "I": 0, "D": 0}
    for sid in ids:
        s = man.get(sid)
        if not s or not s.text:
            continue
        found = qa_section(s, man.mode)
        if not found:
            lines.append(f"[--] {sid} — bez uwag")
            continue
        for rank, problem, fix in found:
            counts[rank] += 1
            lines.append(f"[{rank}] {sid} — {problem} → {fix}")
    verdict = ("DO PRZEPISANIA" if counts["K"] > 3 else
               "GOTOWY PO POPRAWKACH K" if counts["K"] else
               "GOTOWY")
    lines.append("")
    lines.append(f"USTALENIA: K={counts['K']} I={counts['I']} D={counts['D']} "
                 f"| WERDYKT: {verdict}")
    return "\n".join(lines)
