# -*- coding: utf-8 -*-
"""Zrzut paczki plikow do przegladu: naglowki + twierdzenia rozstrzygajace.
Niezalezny od formatu — nie polega na znacznikach pogrubienia."""
import json, re, sys
sys.path.insert(0, 'build')
from mapa import M
INV = {r['idx']: r for r in json.load(open('INVENTORY.json'))}

NAG = re.compile(r'^#{1,4} |^\d{1,2}(\.\d{1,2})*\.?\s+[A-ZĄĆĘŁŃÓŚŹŻ]|'
                 r'^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9 ,\-—:()/]{16,}$|^### ')
KLUCZ = re.compile(
 r'ROZSTRZYG|WERDYKT|WNIOSEK|REKOMENDACJ|KOREKTA|SPROSTOWANIE|BŁĄD|PUŁAPKA|'
 r'NIE (?:BUDOW|ROBIĆ|WCHODZIĆ|DA SIĘ|MA |JEST|WOLNO)|ZAWSZE |NIGDY |MUSI |TRZEBA |'
 r'To jest |To nie jest |Odpowiedź:|Ocena:|Uwaga:|Zasada:|Warunek:|Próg:|'
 r'najważniejsz|kluczow|decyduj|przesądza|obala|unieważnia', re.I)

lo, hi = int(sys.argv[1]), int(sys.argv[2])
for i in sorted(k for k in M if lo <= k <= hi):
    t = open(INV[i]['txt'], encoding='utf-8', errors='replace').read()
    L = [re.sub(r'\s+', ' ', x).strip() for x in t.split('\n')]
    nag = [x for x in L if 6 < len(x) < 120 and NAG.match(x)]
    kl = [x for x in L if 55 < len(x) < 380 and KLUCZ.search(x) and not x.startswith('|')]
    print('\n' + '=' * 92)
    print('#%d | %s' % (i, INV[i]['name'][:70]))
    print('   sekcja %s · %s · %s znakow' % (M[i][0], M[i][1], format(INV[i]['chars'], ',').replace(',', ' ')))
    print('   rola: %s' % M[i][2][:150])
    seen = set(); n = 0
    for x in nag:
        k = x[:40].lower()
        if k in seen: continue
        seen.add(k); print('   § ' + x[:110]); n += 1
        if n >= 12: break
    n = 0
    for x in kl:
        k = x[:50].lower()
        if k in seen: continue
        seen.add(k); print('   • ' + x[:270]); n += 1
        if n >= 8: break
