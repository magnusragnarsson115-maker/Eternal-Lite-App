# -*- coding: utf-8 -*-
"""Wspolne narzedzia: priorytet pliku, podzial na bloki, normalizacja."""
import os
import re, hashlib, unicodedata

def priorytet(nazwa: str, slowa: int) -> float:
    """Im wyzej, tym wersja bardziej aktualna/autorytatywna. Kopia zostaje w pliku o najwyzszym priorytecie."""
    n = nazwa.lower()
    p = 0.0
    # numer wersji w nazwie: 5_4 -> 5.4
    m = re.search(r"[_ ](\d)[_.](\d)\b", n)
    if m:
        p += 40 * (int(m.group(1)) + int(m.group(2)) / 10)
    elif re.search(r"v(\d)\b", n):
        p += 40 * int(re.search(r"v(\d)\b", n).group(1))
    if "final" in n:      p += 120
    if "kompletna" in n:  p += 80
    if "scalon" in n or "ujednolicon" in n: p += 70
    if "poprawione" in n or "_v2" in n:     p += 60
    if "master" in n:     p += 50
    if "specyfikacja" in n: p += 45
    if re.search(r"^chat ?gpt|konwersacj", n): p -= 120   # surowe rozmowy najnizej
    if "pytania" in n and "odpowiedzi" not in n: p -= 60
    p += min(slowa / 1000.0, 60)
    return p

_WS = re.compile(r"\s+")
_MD = re.compile(r"[*_`#>\[\]()]+")

def norm(s: str) -> str:
    """Normalizacja do porownania 1:1: bez znacznikow md, bez roznic bialych znakow i wielkosci liter."""
    s = unicodedata.normalize("NFKC", s)
    s = _MD.sub(" ", s)
    s = s.replace("|", " ").replace("-", " ")
    s = _WS.sub(" ", s).strip().lower()
    return s

def h(s: str) -> str:
    return hashlib.sha1(norm(s).encode()).hexdigest()

HDR = re.compile(r"^#{1,6}\s+\S")
TBL = re.compile(r"^\s*\|")

def bloki(tekst: str):
    """Dzieli na bloki: naglowek | tabela | akapit. Zwraca [(typ, tresc)]."""
    out, buf, tryb = [], [], None
    def flush():
        nonlocal buf, tryb
        if buf:
            out.append((tryb, "\n".join(buf).strip()))
        buf, tryb = [], None
    for ln in tekst.split("\n"):
        if HDR.match(ln):
            flush(); out.append(("h", ln.strip())); continue
        if not ln.strip():
            flush(); continue
        t = "t" if TBL.match(ln) else "p"
        if tryb and t != tryb:
            flush()
        tryb = t
        buf.append(ln)
    flush()
    return [(t, c) for t, c in out if c]

def istotny(typ: str, tresc: str) -> bool:
    """Czy blok jest na tyle duzy, by dedup 1:1 mial sens (chroni krotkie wiersze i separatory)."""
    n = norm(tresc)
    if typ == "h":
        return len(n) >= 12
    return len(n) >= 40 and len(n.split()) >= 8
