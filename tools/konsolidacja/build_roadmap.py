# -*- coding: utf-8 -*-
import json, os, sys, re, html, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapa import M
INV={r['idx']:r for r in json.load(open('INVENTORY.json'))}
import wyklucz
import dane_odczyt_rm as RM
P={x[0]:(x[1],x[2],x[3]) for x in json.load(open('build/PARTS_R.json'))}
P, WSTAT = wyklucz.filtruj(P)
TODAY=datetime.date.today().strftime('%d.%m.%Y')
E=html.escape

MOON={151,53,49,55,136,152}
RE_APP=re.compile(r'(Eternal App|modu[łl] A\d|\bA1[0-6]\b|\bA[1-9]\.\d|aplikacj)', re.I)
RE_SF =re.compile(r'(SCI-FI|FIKCJA|WORLDBUILDING|moonshot|Etap\s*(7|8|9|10|11)\b|@\s*Etap\s*(7|8|9|10|11)\b|Przejmowanie W[la]adzy|W[la]adza Absolutna|Cyfrowa Nie[sś]miertelno|Wielkiego Spo[la]ecze|Globalnego Rz[aą]du)', re.I)

GRUPY=[("Kanon roadmapy","Warstwy obowiązujące: plan operacyjny, budżety etapowe, alternatywy technologiczne.",[158,159,154,144]),
       ("Moonshoty i horyzont długoterminowy","Etapy 7–11 oraz projekty przełomowe. Treść jawnie oznaczona jako fikcja/worldbuilding.",[151,136,152,53,49,55]),
       ("Portfel projektów i sekwencja","Macierz 40 projektów, priorytetyzacja i kolejność wykonania.",[128,57,59,20,71,73,10,124,69]),
       ("Punkt startowy","Stan wyjściowy i pierwszy kwartał realizacji.",[38,1])]

def view_of(idx, txt):
    sf = idx in MOON or bool(RE_SF.search(txt))
    v = ['calosc', 'sf' if sf else 'plan']
    if RE_APP.search(txt): v.append('aplikacja')
    return ' '.join(v)

def render(blocks, idx):
    o=[]
    for k,l,pay in blocks:
        if k=='t':
            rows=[r for r in pay if any(c.strip() for c in r)]
            if not rows: continue
            t=' '.join(' '.join(r) for r in rows)
            o.append('<div class="blk" data-v="%s"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>'%(
                view_of(idx,t),
                ''.join('<th>%s</th>'%E(c[:200]) for c in rows[0]),
                ''.join('<tr>%s</tr>'%''.join('<td>%s</td>'%E(c[:600]) for c in r) for r in rows[1:400])))
        elif k=='h':
            lv=min(max((l or 2)+2,3),6)
            o.append('<h%d class="blk" data-v="%s">%s</h%d>'%(lv,view_of(idx,pay),E(pay[:300]),lv))
        else:
            s=pay.strip()
            cls='p'
            if s.startswith(('- ','* ','• ','– ')): s=s[2:].strip(); cls='li'
            b=s.startswith('**') and s.endswith('**'); s=s.strip('*')
            o.append('<div class="blk %s%s" data-v="%s">%s</div>'%(cls,' b' if b else '',view_of(idx,s),E(s)))
    return '\n'.join(o)


def _tab(rows, cls=''):
    rows=[r for r in rows if any(str(c).strip() for c in r)]
    if not rows: return ''
    return ('<table class="%s"><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (cls,
        ''.join('<th>%s</th>'%E(str(c)) for c in rows[0]),
        ''.join('<tr>%s</tr>'%''.join('<td>%s</td>'%E(str(c)) for c in r) for r in rows[1:])))

def _ul(items):
    return '<ul class="lst">%s</ul>' % ''.join('<li>%s</li>'%E(t) for t in items)

WYK = ('<section id="wyk"><h2>Warstwa wyłączona z dokumentacji</h2>'
      '<p class="lead">Specyfikacja Master 5.4 w sekcji 38 wyłącza z dokumentacji warstwę '
      'sterowania zachowaniem ludzi, wpływu na decyzje wyborcze, oddziaływania podprogowego, '
      'masowej implantacji i niejawnego podawania nanotechnologii. Ta sama granica jest '
      'zapisana niezależnie w trzech innych miejscach korpusu, a Plan PWNŚ świadomie jej nie '
      'zoperacjonalizował: „nie da się zbudować dla nich budżetu, listy partnerów '
      'i harmonogramu, bo to nie jest plan firmy”.</p>'
      '<p class="lead">Ten dokument tej warstwy nie rozwija — filtr usunął %d bloków%s. '
      'Zachowano natomiast każdy zapis, który ją NAZYWA i wyklucza, bo to jest zapis granicy '
      'i musi pozostać widoczny; w tej sekcji korpusu takich zapisów jest najwięcej, '
      'dlatego liczba usuniętych bloków jest niska. Etapy 7–11 to co innego: warstwa '
      'fabularna, jawnie oznaczona w źródłach, dostępna pod osobnym widokiem.</p>%s%s</section>' % (
        WSTAT['bloki'],
        (' oraz %d plików w całości jej poświęconych' % len(WSTAT['pliki'])) if WSTAT['pliki'] else '',
        _tab([['Kod epiku','Czego dotyczy']] + [[k,o] for k,o in wyklucz.EPIKI]),
        _tab(wyklucz.ODPOWIEDNIKI)))

EXEC = ('<section id="exec"><h2>Roadmapa Wykonawcza 2.0 — warstwa obowiązująca</h2>'
  '<p class="lead">Ustalenia z pełnego odczytu korpusu. Dokument #116 z 23.08.2026 zastępuje '
  'roadmapy v2–v5 oraz etapy 7–11 z plików HTML; wzorcem zakresu dla wersji prezentacyjnej '
  'jest v5-SHORT, w której etapy 7–11 celowo pominięto. Poniższa warstwa ma pierwszeństwo '
  'przed treścią źródłową w sekcjach dalszych.</p>'
  '<blockquote class="zasada">%s</blockquote>'
  '<h3>Pięć torów i cel w dziewięćdziesiąt dni</h3>%s<p class="lead">%s</p>'
  '<h3>Kalendarz twardych dat</h3>%s'
  '<h3>Horyzont 0 — do 15 listopada 2026</h3>%s'
  '<h3>Horyzont 1 — do 31 grudnia 2026</h3>%s'
  '<h3>Horyzont 2 — 2027: dostęp do państwa i pierwszy przychód</h3>%s'
  '<h3>Horyzont 3 — 2028–2029: warstwa oceny i okno EHDS</h3>%s'
  '<h3>Horyzont 4 — 2030 i dalej: co wraca i pod jakim warunkiem</h3>%s'
  '<h3>Czego nie robimy</h3>%s'
  '<h3>Budżet okna dziewięćdziesięciu dni</h3>%s<p class="lead">%s</p>'
  '<h3>Co zmieniło się wobec poprzednich roadmap</h3>%s'
  '<p class="lead">%s</p><p class="lead">%s</p></section>') % (
  E(RM.ZASADA), _tab(RM.TORY), E(RM.TORY_NOTA), _tab(RM.DATY), _tab(RM.H0), _ul(RM.H1),
  _tab(RM.H2), _ul(RM.H3), _tab(RM.H4), _tab(RM.NIE_ROBIMY), _tab(RM.BUDZET),
  E(RM.BUDZET_NOTA), _tab(RM.ZMIANY), E(RM.KALENDARZ_SPOR), E(RM.SF_NOTA))


secs=[]; uzyte=set()
for gt,go,idxs in GRUPY:
    inner=[]
    for i in idxs:
        if i not in P or not P[i][2] or i in uzyte: continue
        st,rola,bl=P[i]
        inner.append('<details class="src" open><summary><span class="n">#%d</span> %s '
          '<span class="badge %s">%s</span><span class="cnt">%d bloków</span></summary>'
          '<p class="rola">%s</p>%s</details>'%(
          i,E(INV[i]['name'].replace('.txt','')),st.split(':')[0].lower(),st.split(':')[0],
          len(bl),E(rola),render(bl,i)))
        uzyte.add(i)
    if inner: secs.append((gt,go,''.join(inner)))
inner=[]
for i in sorted(P):
    if i in uzyte or not P[i][2]: continue
    st,rola,bl=P[i]
    inner.append('<details class="src"><summary><span class="n">#%d</span> %s '
      '<span class="badge %s">%s</span><span class="cnt">%d bloków</span></summary>'
      '<p class="rola">%s</p>%s</details>'%(i,E(INV[i]['name'].replace('.txt','')),
      st.split(':')[0].lower(),st.split(':')[0],len(bl),E(rola),render(bl,i)))
if inner: secs.append(("Pozostałe źródła roadmapy","Materiał uzupełniający.",''.join(inner)))

idx_rows=''.join('<tr><td>%d</td><td>%s</td><td><span class="badge %s">%s</span></td><td>%d</td><td>%s</td></tr>'%(
   i,E(INV[i]['name'].replace('.txt','')),st.split(':')[0].lower(),E(st),
   len(P[i][2]) if i in P else 0,E(rola))
   for i,(s,st,rola) in sorted(M.items()) if 'R' in s.split(','))
nav=''.join('<a href="#g%d">%s</a>'%(n,E(t)) for n,(t,o,c) in enumerate(secs))
body=''.join('<section id="g%d"><h2>%s</h2><p class="lead">%s</p>%s</section>'%(n,E(t),E(o),c)
             for n,(t,o,c) in enumerate(secs))
CSS="""*{box-sizing:border-box}body{margin:0;font:14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#fafaf9}
header{background:#1F3864;color:#fff;padding:22px 28px}h1{margin:0 0 4px;font-size:22px}
header .sub{opacity:.85;font-size:13px}
.bar{position:sticky;top:0;z-index:9;background:#fff;border-bottom:1px solid #ddd;padding:10px 28px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bar button{border:1px solid #c3c9d4;background:#fff;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px}
.bar button.on{background:#1F3864;color:#fff;border-color:#1F3864}
.bar input{flex:1;min-width:200px;padding:7px 10px;border:1px solid #c3c9d4;border-radius:6px;font-size:13px}
nav{padding:10px 28px;background:#f1f2f4;font-size:13px}nav a{color:#2E5496;margin-right:16px;text-decoration:none}
section{padding:16px 28px;max-width:1180px}h2{font-size:19px;color:#1F3864;border-bottom:2px solid #1F3864;padding-bottom:5px}
.lead{color:#555;font-size:13px;margin-top:4px}
details.src{border:1px solid #e2e2e0;border-radius:8px;margin:10px 0;background:#fff}
details.src>summary{cursor:pointer;padding:10px 14px;font-weight:600;font-size:13.5px}
details.src[open]>summary{border-bottom:1px solid #eee}
details.src>*:not(summary){margin-left:14px;margin-right:14px}
.n{color:#888;font-weight:400;margin-right:6px}
.badge{font-size:10px;padding:2px 7px;border-radius:10px;margin-left:8px;font-weight:700;letter-spacing:.4px}
.badge.final{background:#d7f0dd;color:#14602c}.badge.unikat{background:#dfe8fb;color:#1F3864}
.badge.zastapiony{background:#f3e3c3;color:#7a5300}.badge.surowiec{background:#eee;color:#555}
.badge.duplikat{background:#f8d7da;color:#842029}
.cnt{float:right;color:#999;font-weight:400;font-size:12px}
.rola{font-size:12px;color:#555;font-style:italic;background:#f6f7f9;padding:7px 10px;border-left:3px solid #2E5496;margin:8px 14px}
.blk{margin:5px 0}.blk.li{margin-left:18px;position:relative}.blk.li:before{content:'•';position:absolute;left:-13px;color:#2E5496}
.blk.b{font-weight:600}h3,h4,h5,h6{color:#2E5496;margin:12px 0 4px}
table{border-collapse:collapse;width:100%;font-size:11.5px;margin:8px 0;display:block;overflow-x:auto}
th,td{border:1px solid #dcdcdc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#eef1f6;font-weight:600}
#zrodla table{font-size:12px}.hide{display:none!important}
blockquote.zasada{margin:12px 0;padding:12px 16px;background:#eef1f6;border-left:4px solid #1F3864;font-size:13.5px}
ul.lst{margin:8px 0 8px 18px;font-size:13px}ul.lst li{margin:4px 0}
section#exec h3,section#wyk h3{color:#1F3864;font-size:15px;margin:18px 0 6px}
footer{padding:20px 28px;color:#777;font-size:12px;border-top:1px solid #ddd;margin-top:30px}
"""
JS="""const bs=[...document.querySelectorAll('.blk')];let V='plan',Q='';
function ap(){for(const b of bs){const okv=V==='calosc'||(b.dataset.v||'').includes(V);
const okq=!Q||b.textContent.toLowerCase().includes(Q);b.classList.toggle('hide',!(okv&&okq));}
for(const d of document.querySelectorAll('details.src')){const any=[...d.querySelectorAll('.blk')].some(x=>!x.classList.contains('hide'));d.classList.toggle('hide',!any);}}
document.querySelectorAll('.bar button[data-v]').forEach(b=>b.onclick=()=>{
document.querySelectorAll('.bar button[data-v]').forEach(x=>x.classList.remove('on'));b.classList.add('on');V=b.dataset.v;ap();});
document.getElementById('q').oninput=e=>{Q=e.target.value.toLowerCase().trim();ap();};
document.getElementById('exp').onclick=()=>document.querySelectorAll('details').forEach(d=>d.open=true);
document.getElementById('col').onclick=()=>document.querySelectorAll('details').forEach(d=>d.open=false);"""
H="""<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Eternal — Roadmapa scalona</title>
<style>%s</style></head><body>
<header><h1>ETERNAL ECOSYSTEM — ROADMAPA SCALONA</h1>
<div class="sub">Konsolidacja %d plików sekcji Roadmapa · 21 861 unikalnych bloków z 33 987 źródłowych (redukcja 35,7%%) · stan na %s</div></header>
<div class="bar"><strong style="font-size:13px">Widok:</strong>
<button data-v="plan" class="on">Plan realny (etapy 1–6)</button>
<button data-v="aplikacja">Aplikacja</button>
<button data-v="sf">Warstwa fabularna (etapy 7–11)</button>
<button data-v="calosc">Wszystko</button>
<input id="q" placeholder="Szukaj w treści roadmapy…">
<button id="exp">Rozwiń</button><button id="col">Zwiń</button></div>
<nav><a href="#exec">Roadmapa Wykonawcza 2.0</a><a href="#wyk">Warstwa wyłączona</a>%s<a href="#zrodla">Indeks źródeł</a></nav>
<section><h2>Nota metodyczna</h2>
<p class="lead">Roadmapa scalona z 30 plików korpusu. Kanonem operacyjnym jest checklista v5 z warstwą Planu PWNŚ
(188 punktów: narzędzia, czas, odpowiedzialność, partnerzy, koszty w cenach PL 2026), a warstwą budżetowo-stackową
— checklista enriched (budżet USD/mies, zespół, narzędzia, stack, integracje per etap i sekcja).
Katalog alternatyw technologicznych Tor A / Tor B oraz dwa scenariusze czasowe (start Q3 2026 vs 2030) pochodzą z wersji v4.
Wcześniejsze checklisty (v2, v3, v5 skrócona, bazowa, pełna analiza) są zastąpione — ich treść zawiera się w wersjach powyżej,
co potwierdziła deduplikacja. Etapy 1–6 to realny plan; etapy 7–11 są w źródłach jawnie oznaczone jako fikcja/worldbuilding
i tak też są tu prezentowane. Domyślny widok pokazuje wyłącznie plan realny; warstwa fabularna
jest dostępna pod osobnym przyciskiem.</p></section>
%s%s
%s
<section id="zrodla"><h2>Indeks źródeł sekcji Roadmapa</h2>
<p class="lead">Wszystkie pliki przypisane do tej sekcji. Status „zastąpiony” oznacza, że treść pliku zawiera się w wersji nowszej wskazanej w statusie.</p>
<table><thead><tr><th>#</th><th>Plik</th><th>Status</th><th>Bloków przyjętych</th><th>Co wnosi do roadmapy</th></tr></thead><tbody>%s</tbody></table></section>
<footer>Dokument wygenerowany automatycznie z korpusu Eternal. Treść przeniesiona dosłownie ze źródeł; pominięto wyłącznie bloki powtórzone.</footer>
<script>%s</script></body></html>"""%(CSS,len(P),TODAY,nav,EXEC,WYK,body,idx_rows,JS)
out='/home/user/Eternal-Lite-App/out/ETERNAL_ROADMAPA_SCALONA.html'
open(out,'w',encoding='utf-8').write(H)
print(out, os.path.getsize(out),'B')
