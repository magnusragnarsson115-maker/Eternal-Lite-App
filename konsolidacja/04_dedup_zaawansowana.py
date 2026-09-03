#!/usr/bin/env python3
"""Deduplikacja zaawansowana/szczegolowa.

Usuwa tresc o podobnym znaczeniu i kontekscie, ale ZACHOWUJE tresc unikatowa,
ktorej nie ma w zadnym innym pliku, i dolacza ja do wersji uznanej za
najbardziej aktualna i najlepsza.

Metoda: 3-shingle slow -> MinHash (128 permutacji) -> LSH (32 pasma x 4)
-> klastry near-duplicate (union-find, prog Jaccarda 0.65)
-> reprezentant = blok z pliku o najwyzszym priorytecie wersji
-> z odrzuconych wariantow zdania nieobecne u reprezentanta trafiaja do niego
   jako uzupelnienie z podaniem pliku zrodlowego.
"""
import os
import json, sys, re, datetime
import numpy as np
BASE = os.environ.get("KONSOLIDACJA_BASE", os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_grupy import GRUPY
from lib_bloki import bloki, istotny, norm

PROG_BLOK, PROG_ZDANIE = 0.65, 0.60
NHASH, PASM = 128, 32
RZ = NHASH // PASM
MOD = (1 << 61) - 1

rec = json.load(open(f"{BASE}/work/po_zwyklej.json", encoding="utf-8"))
rec.sort(key=lambda r: -r["prio"])
poz = {r["id"]: i for i, r in enumerate(rec)}     # 0 = najlepsza wersja

# ---------- 1. bloki ----------
B = []                                            # (id_pliku, typ, tresc)
for r in rec:
    t = open(f"{BASE}/work/dz_{r['id']:03d}.md", encoding="utf-8").read()
    for typ, tresc in bloki(t):
        B.append([r["id"], typ, tresc])
print(f"blokow do analizy: {len(B):,}")

def shingles(s, k=3):
    w = norm(s).split()
    if len(w) < k:
        return {hash(" ".join(w)) & 0xFFFFFFFF} if w else set()
    return {hash(" ".join(w[i:i+k])) & 0xFFFFFFFF for i in range(len(w)-k+1)}

rng = np.random.default_rng(20260903)
A = rng.integers(1, MOD, NHASH, dtype=np.int64)
Bc = rng.integers(0, MOD, NHASH, dtype=np.int64)

sig = np.full((len(B), NHASH), np.iinfo(np.int64).max, dtype=np.int64)
shs = []
for i, (_, typ, tresc) in enumerate(B):
    sh = shingles(tresc) if istotny(typ, tresc) else set()
    shs.append(sh)
    if sh:
        x = np.fromiter(sh, dtype=np.int64, count=len(sh))
        sig[i] = ((A[None, :] * x[:, None] + Bc[None, :]) % MOD).min(axis=0)
print("sygnatury MinHash policzone")

# ---------- 2. LSH ----------
from collections import defaultdict
kandydaci = set()
for b in range(PASM):
    kub = defaultdict(list)
    seg = sig[:, b*RZ:(b+1)*RZ]
    for i in range(len(B)):
        if not shs[i]:
            continue
        kub[seg[i].tobytes()].append(i)
    for grp in kub.values():
        if 1 < len(grp) <= 400:
            for x in range(len(grp)):
                for y in range(x+1, len(grp)):
                    kandydaci.add((grp[x], grp[y]))
print(f"par kandydujacych: {len(kandydaci):,}")

# ---------- 3. weryfikacja Jaccarda + union-find ----------
par = [None]*len(B)
def find(a):
    while par[a] is not None and par[a] != a:
        par[a] = par[par[a]] if par[par[a]] is not None else par[a]
        a = par[a]
    return a
def unite(a, b):
    ra, rb = find(a), find(b)
    if ra == rb: return
    if poz[B[ra][0]] > poz[B[rb][0]]: ra, rb = rb, ra
    par[rb] = ra
for i in range(len(B)):
    par[i] = i

polaczone = 0
for i, j in kandydaci:
    si, sj = shs[i], shs[j]
    if not si or not sj: continue
    inter = len(si & sj)
    if not inter: continue
    if inter / (len(si) + len(sj) - inter) >= PROG_BLOK:
        unite(i, j); polaczone += 1
print(f"par potwierdzonych: {polaczone:,}")

klastry = defaultdict(list)
for i in range(len(B)):
    klastry[find(i)].append(i)
wielo = {k: v for k, v in klastry.items() if len(v) > 1}
print(f"klastrow near-duplicate: {len(wielo):,}, blokow w nich: {sum(len(v) for v in wielo.values()):,}")

# ---------- 4. reprezentant + scalenie unikatow ----------
ZD = re.compile(r"(?<=[.!?])\s+|\n")
def zdania(s):
    if s.lstrip().startswith("|"):
        return [x for x in s.split("\n") if x.strip()]
    return [z.strip() for z in ZD.split(s) if len(z.strip()) > 25]

nazwa = {r["id"]: r["source_name"] for r in rec}
uzup = defaultdict(list)      # idx reprezentanta -> [(zdanie, plik_id)]
usun = set()
przeplyw = {}
stat = {"klastry": 0, "warianty_usuniete": 0, "zdania_scalone": 0, "slowa_usuniete": 0}

for root, czlonkowie in wielo.items():
    # reprezentant: najlepszy plik, przy remisie najdluzszy blok
    czlonkowie.sort(key=lambda i: (poz[B[i][0]], -len(B[i][2])))
    rep = czlonkowie[0]
    rep_zd = [set(norm(z).split()) for z in zdania(B[rep][2])]
    stat["klastry"] += 1
    for w in czlonkowie[1:]:
        for z in zdania(B[w][2]):
            zs = set(norm(z).split())
            if len(zs) < 5:
                continue
            naj = 0.0
            for rz in rep_zd:
                it = len(zs & rz)
                if it:
                    naj = max(naj, it / (len(zs) + len(rz) - it))
                    if naj >= PROG_ZDANIE: break
            if naj < PROG_ZDANIE:
                uzup[rep].append((z, B[w][0]))
                rep_zd.append(zs)
                stat["zdania_scalone"] += 1
        stat["slowa_usuniete"] += len(B[w][2].split())
        przeplyw[(B[w][0], B[rep][0])] = przeplyw.get((B[w][0], B[rep][0]), 0) + len(B[w][2].split())
        usun.add(w)
        stat["warianty_usuniete"] += 1

# ---------- 5. zapis ----------
wyj = defaultdict(list)
for i, (fid, typ, tresc) in enumerate(B):
    if i in usun:
        continue
    blok = tresc
    if i in uzup:
        pary = defaultdict(list)
        for z, src in uzup[i]:
            pary[src].append(z)
        dod = ["", "> **Uzupełnienie scalone z wariantów o zbliżonym znaczeniu** "
               "(treść unikatowa, nieobecna w wersji wiodącej):"]
        for src, zs in sorted(pary.items(), key=lambda kv: poz[kv[0]]):
            for z in zs:
                dod.append(f"> - {z}  \n>   *źródło: [{src:03d}] {nazwa[src]}*")
        blok = blok + "\n" + "\n".join(dod)
    wyj[fid].append(blok)

dzis = datetime.date.today().isoformat()
slowa_przed = sum(len(open(f"{BASE}/work/dz_{r['id']:03d}.md", encoding='utf-8').read().split()) for r in rec)
tresci = {fid: "\n\n".join(bs).strip() for fid, bs in wyj.items()}
tresci = {k: v for k, v in tresci.items() if v}
slowa_po = sum(len(v.split()) for v in tresci.values())

out = [
 "# ETERNAL — DEDUPLIKACJA ZAAWANSOWANA (SEMANTYCZNA)",
 "",
 "Usunięto treść o **podobnym znaczeniu i kontekście**, zachowując treść unikatową,",
 "której nie ma w żadnym innym pliku. Wariant wiodący to wersja najbardziej aktualna",
 "(numer wersji, znaczniki FINAL / KOMPLETNA / scalona, waga dokumentu); treść unikatowa",
 "z wariantów odrzuconych została do niego **doklejona wraz ze wskazaniem pliku źródłowego**,",
 "a nie skasowana.",
 "",
 f"Data: {dzis} · próg podobieństwa bloku {PROG_BLOK} · próg podobieństwa zdania {PROG_ZDANIE}",
 "",
 "| Miara | Po dedup. zwykłej | Po dedup. zaawansowanej | Zmiana |",
 "|---|---|---|---|",
 f"| Pliki | {len(rec)} | {len(tresci)} | −{len(rec)-len(tresci)} |",
 f"| Słowa | {slowa_przed:,} | {slowa_po:,} | −{slowa_przed-slowa_po:,} "
 f"({100*(slowa_przed-slowa_po)/slowa_przed:.1f}%) |".replace(",", " "),
 f"| Bloki | {len(B):,} | {len(B)-len(usun):,} | −{len(usun):,} |".replace(",", " "),
 "",
 f"Klastry treści bliskoznacznej: **{stat['klastry']:,}**. ".replace(",", " ") +
 f"Warianty pochłonięte: **{stat['warianty_usuniete']:,}**. ".replace(",", " ") +
 f"Zdania unikatowe uratowane ze scalonych wariantów: **{stat['zdania_scalone']:,}**.".replace(",", " "),
 "", "---", "",
 "## KTÓRY PLIK POCHŁONĄŁ TREŚĆ KTÓREGO", "",
 "Wiersz czyta się tak: treść bliskoznaczna z pliku *pochłoniętego* została uznana za",
 "wariant starszy lub słabszy i usunięta, a jej fragmenty unikatowe doklejono do pliku",
 "*wiodącego* z przypisem źródła.", "",
 "| Plik pochłonięty | → Plik wiodący | Słowa scalone |", "|---|---|---|",
] + [
 f"| [{a:03d}] {nazwa[a]} | [{b:03d}] {nazwa[b]} | {w:,} |".replace(",", " ")
 for (a, b), w in sorted(((k, v) for k, v in przeplyw.items() if k[0] != k[1]),
                         key=lambda kv: -kv[1])[:40]
] + [
 "",
 "Osobno — powtórzenia **wewnątrz jednego pliku** (dokumenty scalone powielały własne sekcje):",
 "", "| Plik | Słowa usunięte jako powtórzenie wewnętrzne |", "|---|---|",
] + [
 f"| [{a:03d}] {nazwa[a]} | {w:,} |".replace(",", " ")
 for (a, b), w in sorted(((k, v) for k, v in przeplyw.items() if k[0] == k[1]),
                         key=lambda kv: -kv[1])[:15]
] + [
 "", "---", "", "## TREŚĆ SCALONA — WERSJA WIODĄCA", "",
]
for r in rec:
    if r["id"] not in tresci:
        continue
    out += [f"# [{r['id']:03d}] {r['source_name']}", "",
            f"> Grupa: {r['grupa']} — {GRUPY[r['grupa']]} · Typ: {r['ext']} · "
            f"priorytet wersji: {r['prio']:.0f}", "", tresci[r["id"]], "", "---", ""]

open(f"{BASE}/out/02_DEDUP_ZAAWANSOWANA.md", "w", encoding="utf-8").write("\n".join(out))
for fid, v in tresci.items():
    open(f"{BASE}/work/dza_{fid:03d}.md", "w", encoding="utf-8").write(v)
json.dump({"stat": stat, "pliki": sorted(tresci.keys())},
          open(f"{BASE}/work/po_zaawansowanej.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nslowa: {slowa_przed:,} -> {slowa_po:,} (-{100*(slowa_przed-slowa_po)/slowa_przed:.1f}%)")
print(f"zdania unikatowe uratowane: {stat['zdania_scalone']:,}")
