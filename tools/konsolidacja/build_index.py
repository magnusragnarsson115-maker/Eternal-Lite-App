# -*- coding: utf-8 -*-
import json, os, sys, html, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapa import M
INV={r['idx']:r for r in json.load(open('INVENTORY.json'))}
TODAY=datetime.date.today().strftime('%d.%m.%Y')
E=html.escape
SEK={'B':('BIZNESPLAN','ETERNAL_BIZNESPLAN_SCALONY.docx'),
     'R':('ROADMAPA','ETERNAL_ROADMAPA_SCALONA.html'),
     'S':('SPECYFIKACJA','ETERNAL_SPECYFIKACJA_SCALONA.docx'),
     'P':('PITCH DECK','ETERNAL_PITCH_SCALONY.html')}
PARTS={}
for k in SEK:
    try: PARTS[k]={x[0]:x[3] for x in json.load(open('build/PARTS_%s.json'%k))}
    except: PARTS[k]={}
rows=[]
for i,(s,st,rola) in sorted(M.items()):
    secs=s.split(',')
    rows.append((i,INV[i]['name'].replace('.txt',''),INV[i]['chars'],st,secs,rola))
def sec_table(k):
    nm,out=SEK[k]
    r=[x for x in rows if k in x[4]]
    body=''.join('<tr><td>%d</td><td>%s</td><td class="num">%s</td><td><span class="b %s">%s</span></td>'
      '<td class="num">%d</td><td>%s</td></tr>'%(i,E(n),format(c,',').replace(',',' '),
      st.split(':')[0].lower(),E(st),len(PARTS[k].get(i,[])),E(rola)) for i,n,c,st,ss,rola in r)
    dup=[x for x in r if x[3].split(':')[0] in ('ZASTAPIONY','DUPLIKAT')]
    return ('<section id="s%s"><h2>%s — %d plików</h2>'
      '<p class="lead">Dokument wynikowy: <code>out/%s</code>. Plików wnoszących treść: %d. '
      'Plików zastąpionych lub duplikatów: %d (ich treść zawiera się w wersji nowszej wskazanej w statusie).</p>'
      '<table><thead><tr><th>#</th><th>Plik źródłowy</th><th>Znaków</th><th>Status</th>'
      '<th>Bloków przyjętych</th><th>Co z niego wchodzi do tej sekcji</th></tr></thead>'
      '<tbody>%s</tbody></table></section>')%(k,nm,len(r),out,len(r)-len(dup),len(dup),body)
multi=[x for x in rows if len(x[4])>1]
mrows=''.join('<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>'%(i,E(n),
   ' + '.join(SEK[y][0] for y in ss),E(rola)) for i,n,c,st,ss,rola in multi)
CSS="""body{margin:0;font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#fafaf9}
header{background:#1F3864;color:#fff;padding:24px 30px}h1{margin:0 0 5px;font-size:23px}
header .s{opacity:.86;font-size:13px}
nav{padding:11px 30px;background:#f1f2f4;font-size:13px;position:sticky;top:0;border-bottom:1px solid #ddd}
nav a{color:#2E5496;margin-right:18px;text-decoration:none}
section{padding:18px 30px;max-width:1250px}h2{font-size:19px;color:#1F3864;border-bottom:2px solid #1F3864;padding-bottom:5px}
.lead{color:#555;font-size:13px}code{background:#eef1f6;padding:1px 6px;border-radius:4px;font-size:12.5px}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:10px}
th,td{border:1px solid #dcdcdc;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#eef1f6}.num{text-align:right;white-space:nowrap}
.b{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700}
.b.final{background:#d7f0dd;color:#14602c}.b.unikat{background:#dfe8fb;color:#1F3864}
.b.zastapiony{background:#f3e3c3;color:#7a5300}.b.surowiec{background:#eee;color:#555}
.b.duplikat{background:#f8d7da;color:#842029}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}
.kpi{border:1px solid #ddd;border-radius:8px;padding:10px 16px;background:#fff;min-width:140px}
.kpi b{display:block;font-size:20px;color:#1F3864}.kpi span{font-size:11.5px;color:#666}
"""
H="""<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Eternal — Indeks źródeł 159 plików</title>
<style>%s</style></head><body>
<header><h1>ETERNAL — INDEKS ŹRÓDEŁ</h1>
<div class="s">159 unikalnych plików korpusu pogrupowanych w 4 sekcje · stan na %s</div></header>
<nav><a href="#o">Metoda</a><a href="#sB">Biznesplan</a><a href="#sR">Roadmapa</a>
<a href="#sS">Specyfikacja</a><a href="#sP">Pitch</a><a href="#multi">Pliki w wielu sekcjach</a></nav>
<section id="o"><h2>Metoda porządkowania</h2>
<div class="kpis"><div class="kpi"><b>159</b><span>unikalnych plików (po dedupie MD5)</span></div>
<div class="kpi"><b>28,6 mln</b><span>znaków korpusu</span></div>
<div class="kpi"><b>4</b><span>sekcje docelowe</span></div>
<div class="kpi"><b>24</b><span>pliki zastąpione lub duplikaty</span></div></div>
<p class="lead"><b>Status pliku</b> oznacza jego miejsce w łańcuchu wersji.
<span class="b final">FINAL</span> — wersja obowiązująca, kanon dla swojego obszaru.
<span class="b unikat">UNIKAT</span> — jedyna wersja tego materiału, treść wchodzi w całości.
<span class="b zastapiony">ZASTAPIONY</span> — istnieje wersja nowsza wskazana po dwukropku; treść nie jest powielana.
<span class="b duplikat">DUPLIKAT</span> — kopia innego pliku.
<span class="b surowiec">SUROWIEC</span> — materiał źródłowy (konwersacje, listy pytań) o niższym statusie niż dokumenty scalone.</p>
<p class="lead">Zasada rozstrzygania: przy kilku wersjach tego samego dokumentu obowiązuje najnowsza,
ale wersje wcześniejsze są sprawdzane pod kątem treści, której nowsza nie zawiera — i tylko taka treść jest dobierana.
Weryfikacja jest mechaniczna: każdy blok tekstu sprowadzany jest do postaci znormalizowanej i porównywany z już przyjętymi.
Dzięki temu twierdzenie „App 5.4 zawiera się w Master 5.4” nie jest oceną, tylko wynikiem pomiaru — 89%% jej bloków powtarza się dosłownie.</p>
<p class="lead">Bloki krótsze niż 40 znaków znormalizowanych (etykiety pól kart funkcji, nagłówki tabel) są zachowywane mimo powtarzalności,
ponieważ ich powtórzenia są strukturalne — bez nich rozpadłyby się karty 185 funkcji w biznesplanie rozszerzonym.</p></section>
%s%s%s%s
<section id="multi"><h2>Pliki występujące w wielu sekcjach — %d pozycji</h2>
<p class="lead">Ten sam plik może zasilać kilka sekcji, ale każda bierze z niego co innego.
Kolumna po prawej mówi, co dokładnie jest brane pod uwagę.</p>
<table><thead><tr><th>#</th><th>Plik</th><th>Sekcje</th><th>Co jest z niego brane</th></tr></thead><tbody>%s</tbody></table></section>
</body></html>"""%(CSS,TODAY,sec_table('B'),sec_table('R'),sec_table('S'),sec_table('P'),len(multi),mrows)
out='/home/user/Eternal-Lite-App/out/ETERNAL_INDEKS_ZRODEL.html'
open(out,'w',encoding='utf-8').write(H)
print(out, os.path.getsize(out),'B, plikow w wielu sekcjach:',len(multi))
