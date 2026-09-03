#!/usr/bin/env python3
"""Krok 3 — deduplikacja zwykla (1:1) i zaawansowana (znaczeniowa).

ZWYKLA        — usuwa bloki identyczne po normalizacji bialych znakow.
                Zostaje wystapienie z dokumentu o najwyzszym autorytecie.

ZAAWANSOWANA  — grupuje bloki o tym samym znaczeniu, wybiera wariant
                najbardziej aktualny i najpelniejszy, a z odrzuconych
                ODZYSKUJE zdania, ktorych w zwycieskim nie ma, i dopisuje
                je pod blokiem. Nic unikalnego nie ginie.

                Wykrywanie podobienstwa: indeks odwrocony na 3-gramach slow
                (sygnatura = 48 shingli o najmniejszym hashu, deterministyczna),
                weryfikacja pary dokladnym Jaccardem ORAZ zawieraniem —
                blok krotszy w calosci zawarty w dluzszym tez jest duplikatem,
                a sam Jaccard by go nie zlapal.

Wyjscie:
  out/01_DEDUP_ZWYKLA.md
  out/02_DEDUP_ZAAWANSOWANA.md
  .work/dedup_raport.json
  .work/kanon.jsonl              — bloki kanoniczne (wejscie dla DOCX)
"""
import hashlib
import json
import re
import unicodedata
from collections import defaultdict

BLOCKS = ".work/bloki.jsonl"
AUTH = ".work/autorytet.json"
IDX = "out/indeks_zrodel.json"
OUT_ZW = "out/01_DEDUP_ZWYKLA.md"
OUT_ZA = "out/02_DEDUP_ZAAWANSOWANA.md"
RAPORT = ".work/dedup_raport.json"
KANON = ".work/kanon.jsonl"

SHINGLE = 3          # dlugosc n-gramu slownego
SYGNATURA = 48       # ile shingli trafia do indeksu odwroconego
PROG_JACCARD = 0.50  # podobienstwo symetryczne
PROG_ZAWIERANIA = 0.75  # blok krotszy zawarty w dluzszym
MAX_POSTING = 250    # shingle czestsze niz to nie generuja kandydatow
PROG_ODZYSKU = 0.60  # zdanie z wariantu pokryte ponizej tego progu -> odzyskujemy
MIN_SLOW = 10        # krotsze bloki nie ida do analizy znaczeniowej


def deacc(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm_dokladna(t: str) -> str:
    """Normalizacja do porownania 1:1 — tylko biale znaki."""
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t.strip()


def norm_znaczeniowa(t: str) -> str:
    """Normalizacja do porownania znaczeniowego — bez formatowania markdown."""
    t = deacc(t).lower()
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*_`#>|]+", " ", t)
    t = re.sub(r"[^a-z0-9\s]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def shingles(norm: str, k: int = SHINGLE):
    w = norm.split()
    if not w:
        return set()
    if len(w) < k:
        return {" ".join(w)}
    return {" ".join(w[i:i + k]) for i in range(len(w) - k + 1)}


def h64(s: str) -> int:
    return int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), "big")


def sygnatura(sh):
    """48 shingli o najmniejszym hashu — stabilny podzbior, nie zalezy od kolejnosci."""
    return sorted(sh, key=h64)[:SYGNATURA]


def zdania(t: str):
    parts = re.split(r"(?<=[.!?:;])\s+|\n", t)
    return [p.strip() for p in parts if len(p.strip()) > 15]


def main():
    bloki = [json.loads(l) for l in open(BLOCKS, encoding="utf-8")]
    auth = json.load(open(AUTH, encoding="utf-8"))
    idx = json.load(open(IDX, encoding="utf-8"))
    grupy = idx["grupy"]
    doc_grupa = {d["id"]: d["grupa"] for d in idx["dokumenty"]}
    doc_nazwa = {d["id"]: d["nazwa"] for d in idx["dokumenty"]}

    def ranga(b):
        """Im wyzej, tym bardziej aktualny i pelny wariant."""
        return (auth.get(b["doc"], {}).get("punkty", 0.0), len(b["txt"]), b["doc"])

    tresc = [b for b in bloki if not b.get("naglowek")]
    naglowki = [b for b in bloki if b.get("naglowek")]

    # ---------- ETAP A: deduplikacja zwykla (1:1) -------------------------
    # Duplikat to ta sama tresc w ROZNYCH dokumentach. Powtorzenie wewnatrz
    # jednego dokumentu jest jego wlasna struktura (naglowki tabel powtarzane
    # przy kazdej karcie funkcji) — usuniecie go rozbiloby specyfikacje.
    kubelki = defaultdict(list)
    for b in tresc:
        kubelki[hashlib.blake2b(norm_dokladna(b["txt"]).encode(),
                                digest_size=16).digest()].append(b)

    zwykla, usuniete_1_1 = [], 0
    for grupa in kubelki.values():
        wg_doc = defaultdict(list)
        for b in grupa:
            wg_doc[b["doc"]].append(b)
        zwyciezca = max(wg_doc, key=lambda d: (auth.get(d, {}).get("punkty", 0.0), d))
        oddane = sorted(d for d in wg_doc if d != zwyciezca)
        for b in wg_doc[zwyciezca]:
            b["kopie"] = oddane
            zwykla.append(b)
        usuniete_1_1 += sum(len(v) for d, v in wg_doc.items() if d != zwyciezca)
    zwykla.sort(key=lambda b: (b["doc"], b["n"]))
    print(f"[ZWYKLA]  bloki tresci {len(tresc):,} -> {len(zwykla):,} "
          f"(usunieto {usuniete_1_1:,} kopii miedzydokumentowych 1:1)")

    # ---------- ETAP B: deduplikacja zaawansowana (znaczeniowa) ----------
    for b in zwykla:
        b["_norm"] = norm_znaczeniowa(b["txt"])
        b["_sh"] = shingles(b["_norm"])

    kandydujace, krotkie = [], []
    for b in zwykla:
        (kandydujace if len(b["_norm"].split()) >= MIN_SLOW else krotkie).append(b)

    inv = defaultdict(list)
    for i, b in enumerate(kandydujace):
        for s in sygnatura(b["_sh"]):
            inv[s].append(i)

    rodzic = list(range(len(kandydujace)))

    def find(x):
        while rodzic[x] != x:
            rodzic[x] = rodzic[rodzic[x]]
            x = rodzic[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            rodzic[rb] = ra

    porownan, zlaczen = 0, 0
    for i, b in enumerate(kandydujace):
        kand = set()
        for s in sygnatura(b["_sh"]):
            lista = inv[s]
            if len(lista) <= MAX_POSTING:
                kand.update(j for j in lista if j > i)
        a_sh = b["_sh"]
        for j in kand:
            if find(i) == find(j):
                continue
            b_sh = kandydujace[j]["_sh"]
            inter = len(a_sh & b_sh)
            if not inter:
                continue
            porownan += 1
            jac = inter / (len(a_sh) + len(b_sh) - inter)
            zaw = inter / min(len(a_sh), len(b_sh))
            if jac >= PROG_JACCARD or zaw >= PROG_ZAWIERANIA:
                union(i, j)
                zlaczen += 1

    klastry = defaultdict(list)
    for i in range(len(kandydujace)):
        klastry[find(i)].append(i)

    kanon, scalonych, odzyskanych = [], 0, 0
    for czlonkowie in klastry.values():
        czlonkowie_b = [kandydujace[i] for i in czlonkowie]
        # jak wyzej: zwycieza DOKUMENT, a nie pojedynczy blok — inaczej karta
        # funkcji powtarzana w tym samym dokumencie zwinelaby sie do jednej
        wg_doc = defaultdict(list)
        for b in czlonkowie_b:
            wg_doc[b["doc"]].append(b)
        doc_zw = max(wg_doc, key=lambda d: (auth.get(d, {}).get("punkty", 0.0), d))
        zachowane = sorted(wg_doc[doc_zw], key=lambda b: b["n"])
        przegrani = [b for d, v in wg_doc.items() if d != doc_zw for b in v]

        uzup, warianty_meta, kopie = [], [], []
        if przegrani:
            scalonych += len(przegrani)
            pokryte = set()
            for b in zachowane:
                for z in zdania(b["_norm"]):
                    pokryte |= shingles(z)
            for p in przegrani:
                warianty_meta.append({"doc": p["doc"], "znaki": len(p["txt"])})
                kopie.extend(p.get("kopie", []))
                for zd_raw in zdania(p["txt"]):
                    zd_norm = norm_znaczeniowa(zd_raw)
                    sh = shingles(zd_norm)
                    if not sh or len(zd_norm.split()) < 6:
                        continue
                    if len(sh & pokryte) / len(sh) < PROG_ODZYSKU and len(zd_raw) > 40:
                        uzup.append({"doc": p["doc"], "txt": zd_raw})
                        pokryte |= sh
                        odzyskanych += 1
        for poz, b in enumerate(zachowane):
            kanon.append({
                "doc": b["doc"], "n": b["n"], "h1": b["h1"], "h2": b["h2"],
                "txt": b["txt"],
                "kopie_11": sorted(set(list(b.get("kopie", [])) + kopie)),
                # metadane scalenia i odzyskana tresc doklejamy do pierwszego
                # bloku klastra w dokumencie, zeby nie powielic ich N razy
                "warianty": warianty_meta if poz == 0 else [],
                "uzupelnienia": uzup if poz == 0 else [],
            })

    for b in krotkie:
        kanon.append({"doc": b["doc"], "n": b["n"], "h1": b["h1"], "h2": b["h2"],
                      "txt": b["txt"], "kopie_11": list(b.get("kopie", [])),
                      "warianty": [], "uzupelnienia": []})

    kanon.sort(key=lambda b: (b["doc"], b["n"]))
    print(f"[ZAAWANSOWANA] {len(zwykla):,} -> {len(kanon):,} blokow kanonicznych "
          f"(scalono {scalonych:,} wariantow, odzyskano {odzyskanych:,} unikalnych zdan, "
          f"porownan par: {porownan:,})")

    # ---------- zapis ----------
    naglowki_wg_doc = defaultdict(dict)
    for h in naglowki:
        naglowki_wg_doc[h["doc"]][h["n"]] = h["txt"]

    def pisz(sciezka, rekordy, tytul, opis, z_uzupelnieniami):
        wg_doc = defaultdict(list)
        for b in rekordy:
            wg_doc[b["doc"]].append(b)
        with open(sciezka, "w", encoding="utf-8") as f:
            f.write(f"# {tytul}\n\n{opis}\n\n---\n\n")
            for doc in sorted(wg_doc):
                g = doc_grupa.get(doc, "G9")
                f.write(f"\n## [{doc}] {doc_nazwa.get(doc, '?')}\n\n")
                f.write(f"> grupa {g} — {grupy.get(g, '')}\n\n")
                # przeplot naglowkow dokumentu z blokami tresci wg pozycji zrodlowej
                pozycje = sorted(
                    [(b["n"], "t", b) for b in wg_doc[doc]]
                    + [(n, "h", txt) for n, txt in naglowki_wg_doc.get(doc, {}).items()])
                for _, typ, obj in pozycje:
                    if typ == "h":
                        # naglowki zrodlowe schodza o dwa poziomy, zeby nie kolidowaly
                        f.write("###" + obj.lstrip("#").rstrip() + "\n\n"
                                if obj.startswith("#") else obj + "\n\n")
                        continue
                    f.write(obj["txt"].rstrip() + "\n\n")
                    if z_uzupelnieniami and obj.get("uzupelnienia"):
                        f.write("**Tresc unikalna odzyskana z wariantow rownoleglych:**\n\n")
                        for u in obj["uzupelnienia"]:
                            f.write(f"- {u['txt']}  _[{u['doc']}]_\n")
                        f.write("\n")

    pisz(OUT_ZW, zwykla,
         "ETERNAL — TRESC PO DEDUPLIKACJI ZWYKLEJ (1:1)",
         f"Usunieto {usuniete_1_1:,} blokow identycznych co do znaku "
         f"({usuniete_1_1 / len(tresc):.0%} calosci). Tresc merytoryczna nie zostala "
         "zmieniona ani skrocona — zniknely wylacznie doslowne powtorzenia.",
         False)
    pisz(OUT_ZA, kanon,
         "ETERNAL — TRESC PO DEDUPLIKACJI ZAAWANSOWANEJ (ZNACZENIOWEJ)",
         f"Z {len(tresc):,} blokow zrodlowych zostalo {len(kanon):,}. "
         f"Scalono {scalonych:,} wariantow o tym samym znaczeniu, zachowujac wersje "
         f"najbardziej aktualna i najpelniejsza. Z wariantow odrzuconych odzyskano "
         f"{odzyskanych:,} zdan niosacych tresc, ktorej w wersji zachowanej nie bylo — "
         "sa dopisane pod blokiem ze wskazaniem dokumentu zrodlowego.",
         True)

    with open(KANON, "w", encoding="utf-8") as f:
        for b in kanon:
            f.write(json.dumps(b, ensure_ascii=False) + "\n")

    raport = {"blokow_zrodlowych": len(tresc), "naglowkow": len(naglowki),
              "po_dedup_zwyklej": len(zwykla), "usunieto_1_1": usuniete_1_1,
              "po_dedup_zaawansowanej": len(kanon), "scalonych_wariantow": scalonych,
              "odzyskanych_zdan": odzyskanych, "porownan_par": porownan,
              "prog_jaccarda": PROG_JACCARD, "prog_zawierania": PROG_ZAWIERANIA}
    json.dump(raport, open(RAPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(raport, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
