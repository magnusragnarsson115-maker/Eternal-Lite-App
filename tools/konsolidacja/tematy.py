# -*- coding: utf-8 -*-
"""Przekrojowy indeks tematyczny.

Zamiast ukladu "wedlug pliku" buduje uklad "wedlug zagadnienia": dla kazdego
tematu zbiera bloki ze WSZYSTKICH zrodel naraz, w kolejnosci priorytetu zrodla,
z zachowaniem informacji, z ktorego pliku pochodzi kazdy fragment.
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapa import M  # noqa: E402

INV = {r['idx']: r for r in json.load(open('INVENTORY.json'))}

# Tematy wskazane wprost przez uzytkownika + rdzen specyfikacji.
TEMATY = [
    ("T01", "Moduly kontrolne i zabezpieczajace (K1-K14)",
     r"modu[lł]y? kontroln|\bK1[0-4]\b|\bK[1-9]\b(?=\s*[-–—:])|modu[lł] zabezpieczaj|failsafe|kill.?switch"),
    ("T02", "Eternal API Gateway",
     r"api gateway|bram[ay] api|rate.?limit|api key|token dost[eę]p"),
    ("T03", "Mapper i Universal Sync (normalizacja danych)",
     r"\bmapper\b|universal sync|normalization engine|normalizacj[ai] do fhir|mapowanie (pol|do) (fhir|loinc|snomed)"),
    ("T04", "Hub Innowatora (Fundacja, A15)",
     r"hub innowator|\bA15\b|nab[oó]r projekt[oó]w|rada naukowa|stypendi|mikrogrant"),
    ("T05", "Eternal Forge (marketplace IP i API, A16)",
     r"eternal forge|\bA16\b|katalog (oss|open source)|marketplace modu[lł]|eternal token|dynamiczny scoring"),
    ("T06", "Perspektywa systemu vs perspektywa uzytkownika",
     r"use case \(system|use case \(pacjent|co widzi u[zż]ytkownik|perspektywa (pacjenta|lekarza|systemu)|widok wewn[eę]trzn"),
    ("T07", "Wartosc funkcji: przychod, uzytkownik, ekosystem",
     r"zarabia|monetyzacj[ai] funkcji|przychodow|erozyjn|deflacyjn|warto[sś][cć] dla klienta|zapotrzebowanie (klienta|ekosystemow)"),
    ("T08", "Duplikacja funkcji w efekcie koncowym",
     r"duplikat|duplikacj|punkty wspoln|punkt[oó]w wsp[oó]lnych|regu[lł]a 33|ten sam efekt|pokrywaj[aą] si[eę]"),
    ("T09", "Liczba modulow i funkcji - stan rejestru",
     r"\b309 funkcji\b|\b299\b|\b42 modu|\b24 modu|\b23 modu|\b30 modu|\b185 funkcji\b|\b186\b|\b115 funkcji\b|rejestr funkcji"),
    ("T10", "Grupy docelowe i persony",
     r"grupa docelowa|persona|biohacker|przewlekle chor|senior|sportowiec|opiekun rodzin|fitness|dla lekarz"),
    ("T11", "Eternal Station: OEM, ODM, produkcja wlasna",
     r"\bOEM\b|\bODM\b|shenzhen|white.?label|hard tooling|soft tooling|\bEMS\b|BOM\b"),
    ("T12", "Eternal Station: ocena technologii diagnostycznych",
     r"lab.?on.?chip|mikrofluid|spektrofotometr|\bBIA\b|lipidogram|analiza moczu|pulsoksymetr|\bEKG\b"),
    ("T13", "Eternal Capsule: ocena wykonania i granice",
     r"bio.?tag|bio.?monitor|the hive|the swarm|bio.?glass|anti.?migration|wy[lł][aą]cznie odczyt|tylko odczyt|MEMS"),
    ("T14", "Moonshoty: wykonalnosc i TRL",
     r"moonshot|\bTRL\b|wykonalno[sś][cć] naukow|deep tech|nanobot|CRISPR|przeniesienie [sś]wiadomo[sś]ci"),
    ("T15", "Granica regulacyjna: wellness vs wyrob medyczny",
     r"MDCG 2019|MDSW|wellness vs|warstw[ay] (A|B|C)\b|klas[ay] (I{1,3}a?b?)\b|przeznaczenie medyczn"),
    ("T16", "Stos technologiczny i decyzje zamkniete",
     r"flutter|fastapi|qdrant|biomistral|pubmedbert|locked|decyzje zamkni[eę]t|sqlcipher|hetzner|OVH"),
]


def nrm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(c for c in s if not unicodedata.combining(c))


def txt(b):
    if b[0] != 't':
        return b[2]
    return ' | '.join(' '.join(r) for r in b[2])


def build(secs=('S', 'B', 'R')):
    blocks = []
    for sec in secs:
        for idx, st, rola, bl in json.load(open('build/PARTS_%s.json' % sec)):
            for b in bl:
                blocks.append((idx, st, b))
    # deduplikacja miedzy sekcjami po tresci
    seen = set()
    uniq = []
    for idx, st, b in blocks:
        k = nrm(txt(b))[:400]
        if len(k) >= 40:
            if k in seen:
                continue
            seen.add(k)
        uniq.append((idx, st, b))
    out = []
    przypisane = set()
    for tid, nazwa, pat in TEMATY:
        rx = re.compile(pat, re.I)
        hit = [(i, st, b) for i, st, b in uniq if rx.search(nrm(txt(b)))]
        zrodla = {}
        for i, st, b in hit:
            zrodla[i] = zrodla.get(i, 0) + 1
        for i, st, b in hit:
            przypisane.add(id(b))
        out.append(dict(id=tid, nazwa=nazwa, n=len(hit),
                        zrodla=sorted(zrodla.items(), key=lambda x: -x[1]),
                        bloki=[[i, st, b] for i, st, b in hit]))
    return out, uniq


if __name__ == '__main__':
    out, uniq = build()
    json.dump(out, open('build/TEMATY.json', 'w'), ensure_ascii=False)
    print('blokow unikalnych w S+B+R: %d' % len(uniq))
    print('%-5s %-52s %8s %7s' % ('ID', 'TEMAT', 'blokow', 'zrodel'))
    print('-' * 76)
    for t in out:
        print('%-5s %-52s %8d %7d' % (t['id'], t['nazwa'][:52], t['n'], len(t['zrodla'])))
