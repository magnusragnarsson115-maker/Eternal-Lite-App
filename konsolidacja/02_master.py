#!/usr/bin/env python3
"""Buduje plik glowny: cala tresc zrodlowa 149 plikow + spis."""
import os
import json, sys, datetime
from collections import Counter
BASE = os.environ.get("KONSOLIDACJA_BASE", os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_grupy import grupa, GRUPY

rec = json.load(open(f"{BASE}/work/index.json", encoding="utf-8"))
for r in rec:
    r["grupa"] = grupa(r["source_name"])
json.dump(rec, open(f"{BASE}/work/index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

rec.sort(key=lambda r: (r["grupa"], -r["words"]))
dzis = datetime.date.today().isoformat()
out = [
 "# ETERNAL — PLIK GŁÓWNY: PEŁNA TREŚĆ ŹRÓDŁOWA",
 "",
 f"Scalenie {len(rec)} plików źródłowych z 7 paczek. Bez deduplikacji — stan surowy.",
 f"Data scalenia: {dzis}. Łącznie {sum(r['words'] for r in rec):,} słów, "
 f"{sum(r['chars'] for r in rec):,} znaków.".replace(",", " "),
 "", "---", "", "## SPIS PLIKÓW ŹRÓDŁOWYCH", "",
 "| # | Plik | Typ | Grupa | Słowa | Paczka |", "|---|---|---|---|---|---|",
]
for r in rec:
    out.append(f"| {r['id']} | {r['source_name']} | {r['ext']} | "
               f"{r['grupa']} — {GRUPY[r['grupa']]} | {r['words']:,} | {r['bundle']} |".replace(",", " "))
out += ["", "### Legenda grup", ""]
c = Counter(r["grupa"] for r in rec)
for g, nazwa in GRUPY.items():
    out.append(f"- **{g}** — {nazwa} ({c.get(g,0)} plików)")
out += ["", "---", ""]

for r in rec:
    tresc = open(f"{BASE}/parts/{r['part_file']}", encoding="utf-8").read()
    out += [
      f"# [{r['id']:03d}] {r['source_name']}", "",
      f"> Grupa: {r['grupa']} — {GRUPY[r['grupa']]} · Typ: {r['ext']} · "
      f"{r['words']:,} słów · Paczka: {r['bundle']}".replace(",", " "), "",
      tresc, "", "---", "",
    ]

txt = "\n".join(out)
open(f"{BASE}/out/00_PLIK_GLOWNY_PELNA_TRESC.md", "w", encoding="utf-8").write(txt)
print(f"plik glowny: {len(txt):,} znakow, {len(txt.split()):,} slow")
print("grupy:", {f"{g} {GRUPY[g]}": c.get(g,0) for g in GRUPY})
