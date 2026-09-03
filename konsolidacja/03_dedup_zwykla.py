#!/usr/bin/env python3
"""Deduplikacja zwykla: usuwa tresc identyczna 1:1 (cale pliki i pojedyncze bloki)."""
import os
import json, sys, datetime
from collections import defaultdict
BASE = os.environ.get("KONSOLIDACJA_BASE", os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_grupy import GRUPY
from lib_bloki import priorytet, bloki, istotny, h

rec = json.load(open(f"{BASE}/work/index.json", encoding="utf-8"))
for r in rec:
    r["prio"] = priorytet(r["source_name"], r["words"])
    r["tresc"] = open(f"{BASE}/parts/{r['part_file']}", encoding="utf-8").read()

# --- krok 1: pliki identyczne 1:1 (ten sam sha256 calej tresci) ---
wg_hash = defaultdict(list)
for r in rec:
    wg_hash[r["sha256"]].append(r)
usuniete_pliki, zachowane = [], []
for grp in wg_hash.values():
    grp.sort(key=lambda r: (-r["prio"], r["id"]))
    zachowane.append(grp[0])
    for d in grp[1:]:
        d["duplikat_of"] = grp[0]["id"]
        usuniete_pliki.append(d)
zachowane.sort(key=lambda r: -r["prio"])

# --- krok 2: bloki identyczne 1:1 miedzy plikami ---
widziane, wynik = {}, []
stat_blok = {"bloki_wej": 0, "bloki_usuniete": 0, "slowa_usuniete": 0}
for r in zachowane:
    bs = bloki(r["tresc"])
    keep, ostatni_naglowek_pusty = [], None
    for typ, tresc in bs:
        stat_blok["bloki_wej"] += 1
        if not istotny(typ, tresc):
            keep.append((typ, tresc)); continue
        k = h(tresc)
        if k in widziane:
            stat_blok["bloki_usuniete"] += 1
            stat_blok["slowa_usuniete"] += len(tresc.split())
            continue
        widziane[k] = r["id"]
        keep.append((typ, tresc))
    # usun naglowki, pod ktorymi nic nie zostalo
    czysty = []
    for i, (typ, tresc) in enumerate(keep):
        if typ == "h":
            nast = next((t for t, _ in keep[i+1:] if True), None)
            if nast == "h" or nast is None:
                # naglowek bez tresci pod spodem — zostaw tylko jesli to naglowek sekcji z podsekcjami
                pass
        czysty.append((typ, tresc))
    r["tresc_dedup"] = "\n\n".join(c for _, c in czysty).strip()
    if r["tresc_dedup"]:
        wynik.append(r)

dzis = datetime.date.today().isoformat()
slowa_po = sum(len(r["tresc_dedup"].split()) for r in wynik)
slowa_przed = sum(r["words"] for r in rec)

out = [
 "# ETERNAL — DEDUPLIKACJA ZWYKŁA (1:1)",
 "",
 "Usunięto wyłącznie treść **identyczną znak w znak** po normalizacji białych znaków,",
 "znaczników markdown i wielkości liter. Nic nie zostało przeredagowane ani skrócone",
 "z powodu podobieństwa — to robi dopiero deduplikacja zaawansowana.",
 "",
 f"Data: {dzis}",
 "",
 "| Miara | Przed | Po | Usunięto |",
 "|---|---|---|---|",
 f"| Pliki | {len(rec)} | {len(wynik)} | {len(usuniete_pliki)} |",
 f"| Słowa | {slowa_przed:,} | {slowa_po:,} | {slowa_przed - slowa_po:,} "
 f"({100*(slowa_przed-slowa_po)/slowa_przed:.1f}%) |".replace(",", " "),
 f"| Bloki treści | {stat_blok['bloki_wej']:,} | "
 f"{stat_blok['bloki_wej']-stat_blok['bloki_usuniete']:,} | "
 f"{stat_blok['bloki_usuniete']:,} |".replace(",", " "),
 "", "---", "",
 "## PLIKI USUNIĘTE JAKO KOPIE IDENTYCZNE", "",
 "| Usunięty plik | ID | Identyczny z ID | Słowa |", "|---|---|---|---|",
]
for d in sorted(usuniete_pliki, key=lambda r: r["id"]):
    out.append(f"| {d['source_name']} | {d['id']} | {d['duplikat_of']} | {d['words']:,} |".replace(",", " "))
out += ["", "---", "", "## TREŚĆ PO DEDUPLIKACJI ZWYKŁEJ", ""]
for r in wynik:
    out += [f"# [{r['id']:03d}] {r['source_name']}", "",
            f"> Grupa: {r['grupa']} — {GRUPY[r['grupa']]} · Typ: {r['ext']}", "",
            r["tresc_dedup"], "", "---", ""]

open(f"{BASE}/out/01_DEDUP_ZWYKLA.md", "w", encoding="utf-8").write("\n".join(out))
json.dump([{k: v for k, v in r.items() if k not in ("tresc", "tresc_dedup")} for r in wynik],
          open(f"{BASE}/work/po_zwyklej.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for r in wynik:
    open(f"{BASE}/work/dz_{r['id']:03d}.md", "w", encoding="utf-8").write(r["tresc_dedup"])

print(f"pliki: {len(rec)} -> {len(wynik)} (usunieto {len(usuniete_pliki)} kopii 1:1)")
print(f"slowa: {slowa_przed:,} -> {slowa_po:,} (-{100*(slowa_przed-slowa_po)/slowa_przed:.1f}%)")
print(f"bloki usuniete: {stat_blok['bloki_usuniete']:,} / {stat_blok['bloki_wej']:,}")
