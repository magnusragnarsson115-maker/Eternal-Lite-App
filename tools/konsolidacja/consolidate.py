# -*- coding: utf-8 -*-
"""Konsolidacja korpusu Eternal w sekcje. Dedup blokowy z proweniencja."""
import os, re, json, sys, unicodedata, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import read_any
from mapa import M

INV = {r['idx']: r for r in json.load(open('INVENTORY.json'))}

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return s

def key(block):
    k, lvl, payload = block
    if k == 't':
        t = ' | '.join(' '.join(r) for r in payload)
    else:
        t = payload
    n = norm(t)
    # Krotkie bloki to etykiety pol / naglowki kart, nie tresc.
    # Ich powtarzalnosc jest strukturalna - nie wolno ich deduplikowac globalnie.
    if len(n) < 40:
        return None
    return hashlib.md5(n.encode()).hexdigest()

def load(idx):
    r = INV[idx]
    try:
        return read_any(r['orig'], r['txt'])
    except Exception as e:
        sys.stderr.write('FAIL %d %s\n' % (idx, e)); return []

def files_for(sec):
    out = []
    for i, (s, st, rola) in M.items():
        if sec in s.split(','):
            out.append((i, st, rola))
    return out

def consolidate(sec, order, skip_status=('DUPLIKAT',)):
    """order: lista idx w kolejnosci priorytetu (kanon najpierw). Reszta wg numeru."""
    fl = files_for(sec)
    prio = {i: n for n, i in enumerate(order)}
    RANK={'FINAL':0,'UNIKAT':1,'SUROWIEC':2,'ZASTAPIONY':3,'DUPLIKAT':4}
    fl.sort(key=lambda x: (prio.get(x[0], 10**6), RANK.get(x[1].split(':')[0],9), x[0]))
    seen = set(); parts = []; stats = []
    for idx, st, rola in fl:
        base = st.split(':')[0]
        if base in skip_status:
            stats.append((idx, base, 0, 0, rola)); continue
        blocks = load(idx)
        # pliki zastapione/duplikaty NIE sa pomijane: przechodza przez pomiar.
        # Zostaje z nich wylacznie tresc, ktorej nie ma w wersji nowszej.
        new = []; prev = None
        for b in blocks:
            kk = key(b)
            if kk is None:
                # zachowujemy strukture; ucinamy tylko bezposrednie powtorzenie
                sig = (b[0], str(b[2])[:200])
                if sig == prev:
                    continue
                prev = sig; new.append(b); continue
            prev = None
            if kk in seen:
                continue
            seen.add(kk); new.append(b)
        stats.append((idx, base, len(blocks), len(new), rola))
        if new:
            parts.append((idx, st, rola, new))
    return parts, stats

if __name__ == '__main__':
    sec = sys.argv[1]
    order = [int(x) for x in sys.argv[2:]]
    parts, stats = consolidate(sec, order)
    tot_new = sum(s[3] for s in stats); tot_all = sum(s[2] for s in stats)
    print('SEKCJA %s: plikow %d, blokow zrodlowych %d, unikalnych %d (redukcja %.1f%%)'
          % (sec, len(stats), tot_all, tot_new, 100 - 100.0*tot_new/max(tot_all,1)))
    for i, st, a, n, rola in stats:
        print('  #%-4d %-12s blokow %6d  nowych %6d  %s' % (i, st, a, n, INV[i]['name'][:44]))
    json.dump([[i,st,rola,bl] for i,st,rola,bl in parts],
              open('build/PARTS_%s.json'%sec,'w'), ensure_ascii=False)
