# -*- coding: utf-8 -*-
"""Wstrzykniecie ustalen z plikow bez kodow funkcji do roadmap HTML."""
import os
import sys
import html
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dane_ustalenia import U, KAT

E = html.escape
c = collections.Counter(u[1] for u in U)

CSS = """
<style id="ust-css">
#ustalenia{padding:26px 30px;max-width:1250px}
#ustalenia h2{font-size:20px;color:#1B3A6B;border-bottom:2px solid #B8431F;padding-bottom:6px}
#ustalenia .kpi{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
#ustalenia .kpi div{border:1px solid #E6E2DC;border-radius:9px;padding:11px 16px;background:#fff;min-width:150px}
#ustalenia .kpi b{display:block;font-size:22px;color:#1B3A6B;font-family:Georgia,serif}
#ustalenia .kpi span{font-size:11px;color:#5D6B8A}
#ustalenia .u{background:#fff;border:1px solid #E6E2DC;border-left:4px solid #5D6B8A;
 border-radius:0 9px 9px 0;padding:13px 17px;margin-bottom:11px}
#ustalenia .u.KOREKTA{border-left-color:#B8431F}
#ustalenia .u.ROZSTRZ{border-left-color:#1B3A6B}
#ustalenia .u.NOWE{border-left-color:#2E7D32}
#ustalenia .u.RYZYKO{border-left-color:#B07419}
#ustalenia .u h4{margin:0 0 6px;font-size:15px;color:#16233F}
#ustalenia .tag{font-size:9.5px;font-weight:800;letter-spacing:.8px;padding:2px 8px;
 border-radius:10px;color:#fff;margin-right:8px;vertical-align:2px}
#ustalenia .tag.KOREKTA{background:#B8431F}#ustalenia .tag.ROZSTRZ{background:#1B3A6B}
#ustalenia .tag.NOWE{background:#2E7D32}#ustalenia .tag.RYZYKO{background:#B07419}
#ustalenia .pl{font-size:11px;color:#5D6B8A;float:right}
#ustalenia .u p{margin:0 0 6px;font-size:13.5px;line-height:1.6}
#ustalenia .zm{background:#F6F4EF;padding:8px 11px;border-radius:6px;font-size:12.5px;margin:0}
#ustalenia .zm b{color:#B8431F;font-size:10px;letter-spacing:.6px}
#ustalenia details{margin-bottom:20px}
#ustalenia summary{cursor:pointer;font-weight:700;color:#1B3A6B;font-size:15px;padding:8px 0}
</style>
"""

GRUPY = [('C', 'Certyfikacja, agregacja i granica wyrobu'),
         ('P', 'Państwo, IKP i dokumentacja medyczna'),
         ('S', 'Struktura ekosystemu i projekty'),
         ('E', 'Ekonomia i model biznesowy'),
         ('K', 'Kontrola, ład korporacyjny i standard'),
         ('T', 'Technologia i sprzęt'),
         ('D', 'Dane, użytkownik i horyzont'),
         ('M', 'Metodyka i luki w materiale')]

body = []
for pref, tyt in GRUPY:
    poz = [u for u in U if u[0].startswith(pref)]
    if not poz:
        continue
    kart = ''.join(
        '<div class="u %s"><span class="pl">%s</span>'
        '<h4><span class="tag %s">%s</span>%s. %s</h4><p>%s</p>'
        '<p class="zm"><b>CO ZMIENIA:</b> %s</p></div>'
        % (kat, E(pl), kat, KAT[kat][0], E(kod), E(tyt_), E(ust), E(zm))
        for kod, kat, tyt_, ust, zm, pl in poz)
    body.append('<details><summary>%s (%d)</summary>%s</details>' % (E(tyt), len(poz), kart))

SEK = CSS + """
<section id="ustalenia">
<h2>Ustalenia z plików bez kodów funkcji</h2>
<p class="lead">Siedemdziesiąt cztery pliki korpusu nie zawierają kodów funkcji i przez to
nie występowały w rejestrze, z którego budowano dokumenty analityczne. Ich treść była
w specyfikacji scalonej &mdash; nie była w żadnym wniosku. Przeczytane osobno, dały
%d ustaleń z 32 plików. Numer przy każdym wskazuje plik źródłowy.</p>
<div class="kpi">
<div><b>%d</b><span>KOREKTA &mdash; obala wcześniejsze twierdzenie</span></div>
<div><b>%d</b><span>ROZSTRZYGNIĘCIE &mdash; zamyka sprawę otwartą</span></div>
<div><b>%d</b><span>NOWE &mdash; treść nieobecna gdzie indziej</span></div>
<div><b>%d</b><span>RYZYKO &mdash; spoza rejestru ryzyk</span></div>
</div>
%s
</section>
""" % (len(U), c['KOREKTA'], c['ROZSTRZ'], c['NOWE'], c['RYZYKO'], ''.join(body))

for f in ['ETERNAL_ROADMAPA_SCALONA.html', 'ETERNAL_ROADMAPA_APLIKACJA.html']:
    p = '/home/user/Eternal-Lite-App/out/' + f
    s = open(p, encoding='utf-8').read()
    if 'id="ustalenia"' in s:
        i = s.index('<style id="ust-css">')
        j = s.index('</section>', s.index('<section id="ustalenia">')) + len('</section>')
        s = s[:i] + s[j:]
    anchor = '<footer>' if '<footer>' in s else '</body>'
    s = s.replace(anchor, SEK + anchor, 1)
    if 'href="#ustalenia"' not in s:
        for a in ('<a href="#rozstrzygniecia">', '<a href="#zrodla">'):
            if a in s:
                s = s.replace(a, '<a href="#ustalenia">Ustalenia</a>' + a, 1)
                break
    open(p, 'w', encoding='utf-8').write(s)
    print('zaktualizowano %s -> %d B' % (f, os.path.getsize(p)))
