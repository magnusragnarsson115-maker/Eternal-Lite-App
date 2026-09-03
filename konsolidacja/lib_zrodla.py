# -*- coding: utf-8 -*-
"""Atrybucja zrodel: dla dowolnego fragmentu wskazuje pliki korpusu, ktore go potwierdzaja.

Metoda: odwrocony indeks terminow z wagami IDF. Fragment dostaje ocene wzgledem
kazdego pliku jako suma IDF terminow wspolnych, znormalizowana dlugoscia fragmentu.
Zwracane sa pliki powyzej progu — czyli te, w ktorych ta tresc realnie wystepuje.
"""
import os
import json, math, os, re, sys
from collections import defaultdict, Counter
BASE = os.environ.get("KONSOLIDACJA_BASE", os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_bloki import norm

STOP = set("""a i o u w z do na po za od nie tak to te ta ten tym tego temu ci co czy
jest sa byl byla bylo byc jak juz ale lub oraz przez pod nad przy dla ze sie sie
jego jej ich nasz nasza nasze swoje ktory ktora ktore ktorych ktorym gdy gdzie
bardzo tylko jeszcze wiec bo bez miedzy wobec wedlug kazdy kazda kazde caly cala
cale jeden jedna jedno dwa trzy przed poza raz jesli jezeli aby zeby moze mozna
nam nas one oni ona ono tez takze ni ani lecz zas czyli np itd itp""".split())

class Atrybucja:
    def __init__(self, ids):
        self.ids = list(ids)
        self.tf, self.df = {}, Counter()
        self.dl = {}
        for i in self.ids:
            p = f"{BASE}/work/dza_{i:03d}.md"
            if not os.path.exists(p):
                continue
            t = norm(open(p, encoding="utf-8").read())
            w = [x for x in t.split() if len(x) > 3 and x not in STOP and not x.isdigit()]
            c = Counter(w)
            self.tf[i] = c
            self.dl[i] = max(len(w), 1)
            for x in c:
                self.df[x] += 1
        n = max(len(self.tf), 1)
        self.idf = {x: math.log(1 + n / (1 + d)) for x, d in self.df.items()}
        # odwrocony indeks tylko dla terminow o realnej sile odrozniajacej
        self.inv = defaultdict(list)
        for i, c in self.tf.items():
            for x in c:
                if self.df[x] <= max(3, n // 3):
                    self.inv[x].append(i)

    def zrodla(self, fragment, ile=3, prog=0.16):
        w = [x for x in norm(fragment).split()
             if len(x) > 3 and x not in STOP and not x.isdigit()]
        if len(w) < 6:
            return []
        q = Counter(w)
        wagi = {x: self.idf.get(x, 0.0) for x in q}
        suma = sum(wagi.values()) or 1.0
        pkt = defaultdict(float)
        for x in q:
            for i in self.inv.get(x, ()):
                if self.tf[i].get(x):
                    pkt[i] += wagi[x]
        wyn = sorted(((v / suma, i) for i, v in pkt.items()), reverse=True)
        return [i for s, i in wyn[:ile] if s >= prog]
