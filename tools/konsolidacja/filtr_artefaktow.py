# -*- coding: utf-8 -*-
"""Drugi przebieg deduplikacji.

Usuwa bloki, ktorych tresc zawiera sie juz doslownie w materiale przyjetym
wczesniej (o wyzszym priorytecie). Lapie duplikaty PDF-vs-DOCX, ktorych
hash blokowy nie wykrywa, bo ekstrakcja tnie tekst w innych miejscach.
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def nrm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def txt(b):
    if b[0] != 't':
        return b[2]
    return ' | '.join(' '.join(r) for r in b[2])


for sec in sys.argv[1:]:
    parts = json.load(open('build/PARTS_%s.json' % sec))
    acc = []
    out = []
    usun = 0
    usun_ch = 0
    for idx, st, rola, bl in parts:
        base = ' '.join(acc)
        keep = []
        for b in bl:
            n = nrm(txt(b))
            if len(n) >= 40 and n in base:
                usun += 1
                usun_ch += len(txt(b))
                continue
            keep.append(b)
            acc.append(n)
        out.append([idx, st, rola, keep])
    json.dump(out, open('build/PARTS_%s.json' % sec, 'w'), ensure_ascii=False)
    tot = sum(len(x[3]) for x in out)
    print('%s: usunieto %d blokow (%d zn.) jako zawarte wczesniej -> zostaje %d'
          % (sec, usun, usun_ch, tot))
