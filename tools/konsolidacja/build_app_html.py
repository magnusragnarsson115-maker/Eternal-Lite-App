# -*- coding: utf-8 -*-
"""Roadmapa SAMEJ APLIKACJI - HTML z licznikami punktow."""
import json
import os
import re
import sys
import html
import datetime
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapa import M  # noqa: E402

INV = {r['idx']: r for r in json.load(open('INVENTORY.json'))}
TODAY = datetime.date.today().strftime('%d.%m.%Y')
E = html.escape

MOD = [
 ("A1", "Agregacja i synchronizacja danych", 10),
 ("A2", "OCR i digitalizacja dokumentow", 8),
 ("A3", "Dashboard, monitoring, alerty, Bio-Weather", 9),
 ("A4", "Raporty i eksport", 5),
 ("A5", "Telemedycyna i zdalna opieka", 9),
 ("A6", "AI, RAG i chatboty", 9),
 ("A7", "Planowanie i rekomendacje", 9),
 ("A8", "Zdrowie psychiczne", 10),
 ("A9", "Spolecznosc, edukacja, gamifikacja", 6),
 ("A10", "Marketplace", 8),
 ("A11", "Geolokalizacja i tlumaczenie", 5),
 ("A12", "Nagrywanie, ankiety, dokumentacja", 5),
 ("A13", "Eternal Pet", 6),
 ("A14", "Powiadomienia i eskalacja", 3),
 ("A15", "Fundacja / Hub Innowatora", 6),
 ("A16", "Eternal Forge", 7),
]
ETAPY = [("1", "Planowanie", "MVP", "2026"), ("2", "Budowa firmy", "MVP", "2026-27"),
         ("3", "Rozwoj firmy", "MLP", "2027"), ("4", "Ekspansja", "MLP", "2027-28"),
         ("5", "Lobbing", "FINAL", "2028-29"), ("6", "Rozwoj technologiczny", "FINAL", "2029-31")]

import wyklucz  # noqa: E402

P = json.load(open('build/PARTS_R.json'))
_Q, WSTAT = wyklucz.filtruj({x[0]: (x[1], x[2], x[3]) for x in P})
P = [[i, v[0], v[1], v[2]] for i, v in sorted(_Q.items())]


def txt(b):
    if b[0] != 't':
        return b[2]
    return ' | '.join(' '.join(r) for r in b[2])


blocks = []
for idx, st, rola, bl in P:
    for b in bl:
        blocks.append((idx, st, b))

# przypisz bloki do modulow aplikacji
bym = collections.OrderedDict((m, []) for m, _, _ in MOD)
zrodla = collections.defaultdict(set)
for idx, st, b in blocks:
    t = txt(b)
    hit = set(re.findall(r'\b(A\d{1,2})\.\d{1,2}\b', t))
    hit |= set(re.findall(r'modu[lł]\s+(A\d{1,2})\b', t, re.I))
    for m in hit:
        if m in bym:
            bym[m].append((idx, st, b))
            zrodla[m].add(idx)


def render(bl, mod):
    o = []
    for idx, st, b in bl:
        t = txt(b)
        if b[0] == 't':
            rows = [r for r in b[2] if any(c.strip() for c in r)]
            if not rows:
                continue
            o.append('<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (
                ''.join('<th>%s</th>' % E(c[:160]) for c in rows[0]),
                ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % E(c[:500]) for c in r)
                        for r in rows[1:250])))
        else:
            s = t.strip()
            cls = 'p'
            if s.startswith(('- ', '* ', '• ', '– ')):
                s = s[2:].strip()
                cls = 'li'
            o.append('<div class="%s" data-src="%d">%s</div>' % (cls, idx, E(s)))
    return '\n'.join(o)


secs = []
for m, nazwa, nf in MOD:
    bl = bym[m]
    src = sorted(zrodla[m])
    srcrows = ''.join('<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
        i, E(INV[i]['name'].replace('.txt', '')[:56]), E(M[i][1]), E(M[i][2][:90]))
        for i in src)
    secs.append(
      '<details class="mod"><summary><b>%s</b> &nbsp;%s'
      '<span class="cnt">%d funkcji &middot; %d blokow &middot; %d zrodel</span></summary>'
      '%s<h4>Zrodla tego modulu</h4>'
      '<table class="src"><thead><tr><th>#</th><th>Plik</th><th>Status</th><th>Rola</th></tr></thead>'
      '<tbody>%s</tbody></table></details>'
      % (m, E(nazwa), nf, len(bl), len(src), render(bl, m), srcrows))

sumf = sum(n for _, _, n in MOD)
etrows = ''.join('<tr><td>Etap %s</td><td>%s</td><td><span class="badge">%s</span></td><td>%s</td></tr>'
                 % (a, E(b), E(c), E(d)) for a, b, c, d in ETAPY)
modrows = ''.join('<tr><td><b>%s</b></td><td>%s</td><td class="n">%d</td><td class="n">%d</td><td class="n">%d</td></tr>'
                  % (m, E(nz), nf, len(bym[m]), len(zrodla[m])) for m, nz, nf in MOD)

CSS = """*{box-sizing:border-box}body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#16233f;background:#f6f7fa}
header{background:#0d1b3e;color:#fff;padding:24px 30px}h1{margin:0 0 5px;font-size:22px}
header .s{opacity:.85;font-size:13px}
.kpis{display:flex;gap:12px;flex-wrap:wrap;padding:16px 30px;background:#fff;border-bottom:1px solid #e2e4ea}
.kpi{border:1px solid #dfe3ec;border-radius:9px;padding:11px 17px;min-width:132px;background:#fbfcfe}
.kpi b{display:block;font-size:21px;color:#0d1b3e}.kpi span{font-size:11.5px;color:#5d6b8a}
.bar{position:sticky;top:0;z-index:9;background:#fff;border-bottom:1px solid #e2e4ea;padding:9px 30px;display:flex;gap:10px;flex-wrap:wrap}
.bar input{flex:1;min-width:210px;padding:7px 10px;border:1px solid #ccd2e0;border-radius:6px}
.bar button{border:1px solid #ccd2e0;background:#fff;padding:6px 14px;border-radius:18px;cursor:pointer}
section{padding:18px 30px;max-width:1200px}h2{font-size:18px;color:#0d1b3e;border-bottom:2px solid #0d1b3e;padding-bottom:5px}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin:9px 0;display:block;overflow-x:auto}
th,td{border:1px solid #dfe3ec;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#eef1f7}.n{text-align:right}
.badge{font-size:10px;background:#dfe8fb;color:#1F3864;padding:2px 8px;border-radius:9px;font-weight:700}
details.mod{border:1px solid #e2e4ea;border-radius:9px;background:#fff;margin:9px 0}
details.mod>summary{cursor:pointer;padding:11px 15px;font-size:14px}
details.mod[open]>summary{border-bottom:1px solid #eef0f4}
details.mod>*:not(summary){margin-left:15px;margin-right:15px}
.cnt{float:right;color:#8b96ae;font-size:12px;font-weight:400}
.p{margin:4px 0}.li{margin:3px 0 3px 18px;position:relative}
.li:before{content:'\\2022';position:absolute;left:-13px;color:#3b5da8}
h4{color:#3b5da8;margin:14px 0 4px;font-size:13px}
table.src{font-size:11.5px}.hide{display:none!important}
footer{padding:20px 30px;color:#6b7794;font-size:12px;border-top:1px solid #e2e4ea}
"""
JS = """var Q='';
document.getElementById('q').oninput=function(e){
 Q=e.target.value.toLowerCase().trim();
 document.querySelectorAll('.p,.li').forEach(function(x){
   x.classList.toggle('hide', !!Q && x.textContent.toLowerCase().indexOf(Q)<0);});
 document.querySelectorAll('details.mod').forEach(function(d){
   var any=[...d.querySelectorAll('.p,.li')].some(function(x){return !x.classList.contains('hide');});
   d.classList.toggle('hide', !!Q && !any); if(Q&&any) d.open=true;});};
document.getElementById('exp').onclick=function(){document.querySelectorAll('details').forEach(function(d){d.open=true;});};
document.getElementById('col').onclick=function(){document.querySelectorAll('details').forEach(function(d){d.open=false;});};
"""
H = """<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eternal App - roadmapa aplikacji</title><style>%s</style></head><body>
<header><h1>ETERNAL APP &mdash; ROADMAPA APLIKACJI</h1>
<div class="s">Sama aplikacja, bez warstwy sprzetowej i wewnatrzustrojowej &middot; stan na %s</div></header>
<div class="kpis">
<div class="kpi"><b>%d</b><span>modulow aplikacji (A1&ndash;A16)</span></div>
<div class="kpi"><b>%d</b><span>funkcji w modulach</span></div>
<div class="kpi"><b>793</b><span>epikow w roadmapie</span></div>
<div class="kpi"><b>3 946</b><span>taskow</span></div>
<div class="kpi"><b>23 151</b><span>subtaskow</span></div>
<div class="kpi"><b>6</b><span>etapow realnych (1&ndash;6)</span></div></div>
<div class="bar"><input id="q" placeholder="Szukaj w tresci roadmapy aplikacji&hellip;">
<button id="exp">Rozwin</button><button id="col">Zwin</button></div>
<section><h2>Etapy realne</h2>
<p style="font-size:13px;color:#5d6b8a">Etapy 7&ndash;11 nie sa czescia tego dokumentu &mdash; w zrodlach sa
jawnie oznaczone jako fikcja i worldbuilding, a ta roadmapa dotyczy planu wykonawczego aplikacji.</p>
<table><thead><tr><th>Etap</th><th>Nazwa</th><th>Poziom</th><th>Horyzont</th></tr></thead><tbody>%s</tbody></table></section>
<section><h2>Moduly aplikacji &mdash; podsumowanie</h2>
<table><thead><tr><th>Modul</th><th>Nazwa</th><th class="n">Funkcji</th><th class="n">Blokow tresci</th><th class="n">Zrodel</th></tr></thead>
<tbody>%s</tbody></table></section>
<section><h2>Moduly &mdash; tresc szczegolowa</h2>%s</section>
<footer>Roadmapa aplikacji zlozona z sekcji Roadmapa korpusu Eternal. Tresc przeniesiona doslownie ze zrodel;
przy kazdym module lista plikow, z ktorych pochodzi. Liczniki epikow, taskow i subtaskow pochodza z naglowkow
sekcyjnych w plikach checklist (173 bloki z licznikami).</footer>
<script>%s</script></body></html>""" % (CSS, TODAY, len(MOD), sumf, etrows, modrows, ''.join(secs), JS)

out = '/home/user/Eternal-Lite-App/out/ETERNAL_ROADMAPA_APLIKACJA.html'
open(out, 'w', encoding='utf-8').write(H)
print(out, os.path.getsize(out), 'B, modulow:', len(MOD),
      'blokow:', sum(len(v) for v in bym.values()))
