# -*- coding: utf-8 -*-
"""Wstrzykniecie rejestru ustalen per plik do roadmap HTML."""
import os, sys, html, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkdocx import INV
from mapa import M
from dane_pliki import P
E = html.escape
W = {'KOR': ('KOREKTA', '#B8431F'), 'ROZ': ('ROZSTRZYGNIĘCIE', '#1B3A6B'),
     'NOW': ('NOWE', '#2E7D32'), 'RYZ': ('RYZYKO', '#B07419'),
     'POT': ('POTWIERDZENIE', '#5D6B8A')}
c = collections.Counter(v[1] for v in P.values())

CSS = """<style id="pliki-css">
#pliki{padding:26px 30px;max-width:1250px}
#pliki h2{font-size:20px;color:#1B3A6B;border-bottom:2px solid #B8431F;padding-bottom:6px}
#pliki .kpi{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
#pliki .kpi div{border:1px solid #E6E2DC;border-radius:9px;padding:10px 14px;background:#fff;min-width:130px}
#pliki .kpi b{display:block;font-size:21px;font-family:Georgia,serif}
#pliki .kpi span{font-size:11px;color:#5D6B8A}
#pliki details{margin-bottom:14px;border:1px solid #E6E2DC;border-radius:9px;background:#fff}
#pliki summary{cursor:pointer;font-weight:700;color:#1B3A6B;font-size:14.5px;padding:11px 15px}
#pliki table{width:100%;border-collapse:collapse;font-size:12.5px}
#pliki th{background:#1B3A6B;color:#fff;padding:7px 10px;text-align:left;font-size:11.5px}
#pliki td{padding:7px 10px;border-top:1px solid #EEE9E2;vertical-align:top}
#pliki td.w{white-space:nowrap;font-weight:700;font-size:10px;letter-spacing:.5px}
#pliki td.n{white-space:nowrap;color:#5D6B8A;font-variant-numeric:tabular-nums}
</style>"""

body = []
for lo in range(1, 160, 10):
    hi = min(lo + 9, 159)
    rows = ''.join(
        '<tr><td class="n">#%d</td><td>%s</td><td class="w" style="color:%s">%s</td>'
        '<td>%s</td></tr>'
        % (i, E(INV[i]['name'].replace('.txt', '')[:56]), W[P[i][1]][1], W[P[i][1]][0],
           E(P[i][0]))
        for i in range(lo, hi + 1) if i in P)
    body.append('<details><summary>Paczka %d — pliki #%d–#%d</summary>'
                '<table><tr><th>#</th><th>Plik</th><th>Waga</th>'
                '<th>Ustalenie z tego pliku</th></tr>%s</table></details>'
                % ((lo // 10) + 1, lo, hi, rows))

SEK = CSS + """
<section id="pliki">
<h2>Ustalenie z każdego pliku — wszystkie 159</h2>
<p class="lead">Przejście po kolei przez cały korpus, w szesnastu paczkach po dziesięć.
Każdy plik ma jeden wpis: co z niego wynika i jaką ma wagę.</p>
<div class="kpi">
<div><b>%d</b><span>KOREKTA</span></div><div><b>%d</b><span>ROZSTRZYGNIĘCIE</span></div>
<div><b>%d</b><span>NOWE</span></div><div><b>%d</b><span>RYZYKO</span></div>
<div><b>%d</b><span>POTWIERDZENIE</span></div></div>
%s</section>
""" % (c['KOR'], c['ROZ'], c['NOW'], c['RYZ'], c['POT'], ''.join(body))

for f in ['ETERNAL_ROADMAPA_SCALONA.html', 'ETERNAL_ROADMAPA_APLIKACJA.html']:
    p = '/home/user/Eternal-Lite-App/out/' + f
    s = open(p, encoding='utf-8').read()
    if 'id="pliki"' in s:
        i = s.index('<style id="pliki-css">')
        j = s.index('</section>', s.index('<section id="pliki">')) + len('</section>')
        s = s[:i] + s[j:]
    anchor = '<footer>' if '<footer>' in s else '</body>'
    s = s.replace(anchor, SEK + anchor, 1)
    if 'href="#pliki"' not in s:
        for a in ('<a href="#ustalenia">', '<a href="#zrodla">'):
            if a in s:
                s = s.replace(a, '<a href="#pliki">Pliki</a>' + a, 1); break
    open(p, 'w', encoding='utf-8').write(s)
    print('zaktualizowano %s -> %d B' % (f, os.path.getsize(p)))
