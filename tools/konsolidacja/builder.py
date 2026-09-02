# -*- coding: utf-8 -*-
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkdocx import *
from docx import Document
from dane_ustalenia import U, KAT
from dane_pliki import P as UPL


def _ustalenia(doc, sec):
    """Czesc 0 — ustalenia z plikow bez kodow funkcji, wlasciwe dla tej sekcji."""
    GR = {'S': ('C', 'K', 'T', 'D', 'M', 'S', 'L'), 'B': ('P', 'E', 'S', 'K', 'M', 'L'),
          'R': ('S', 'T', 'D', 'L'), 'P': ('P', 'E', 'C', 'L')}
    poz = [u for u in U if u[0][0] in GR.get(sec, ())]
    if not poz:
        return
    doc.add_heading('CZĘŚĆ 0 — USTALENIA Z PLIKÓW BEZ KODÓW FUNKCJI', 1)
    doc.add_paragraph(
        'Siedemdziesiąt cztery pliki korpusu nie zawierają kodów funkcji i przez to nie '
        'występowały w rejestrze, z którego budowano dokumenty analityczne. Ich treść była '
        'w częściach poniżej — nie była w żadnym wniosku. Ta część zbiera %d ustaleń '
        'właściwych dla tej sekcji, z numerem pliku źródłowego przy każdym. '
        'Pełny rejestr %d ustaleń: ETERNAL_USTALENIA_KORPUSU.docx.' % (len(poz), len(U)))
    rows = [['Kod', 'Kategoria', 'Ustalenie', 'Co zmienia', 'Pliki']]
    for kod, kat, tyt, ust, zm, pl in poz:
        rows.append([kod, KAT[kat][0], tyt + ' — ' + ust, zm, pl])
    add_table(doc, rows)
    doc.add_page_break()

    W = {'KOR': 'KOREKTA', 'ROZ': 'ROZSTRZYGNIĘCIE', 'NOW': 'NOWE', 'RYZ': 'RYZYKO',
         'POT': 'POTWIERDZENIE'}
    mine = [i for i, (sc, st, ro) in sorted(M.items()) if sec in sc.split(',') and i in UPL]
    if mine:
        doc.add_heading('CZĘŚĆ 0B — USTALENIE Z KAŻDEGO PLIKU TEJ SEKCJI', 1)
        doc.add_paragraph(
            'Przejście po kolei przez wszystkie %d plików przypisanych do tej sekcji, '
            'w paczkach po dziesięć. Każdy plik ma jeden wpis: co z niego wynika i jaką '
            'ma wagę. Pełny rejestr wszystkich 159 plików: '
            'ETERNAL_USTALENIA_PER_PLIK.docx.' % len(mine))
        r2 = [['#', 'Plik', 'Waga', 'Ustalenie z tego pliku']]
        for i in mine:
            u, wg = UPL[i]
            r2.append([str(i), INV[i]['name'].replace('.txt', '')[:52], W[wg], u])
        add_table(doc, r2)
        doc.add_page_break()

def build(sec, tytul, podtytul, podstawa, nota, wersje, kanon, klastry, reszta_tytul, out):
    PARTS={x[0]:(x[1],x[2],x[3]) for x in json.load(open('build/PARTS_%s.json'%sec))}
    doc=Document(); setup(doc)
    for t,sz,b in [("ETERNAL ECOSYSTEM",26,True),(tytul,16,True),(podtytul,12,False)]:
        p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        r=p.add_run(t); r.font.size=Pt(sz); r.bold=b
        if sz>=16: r.font.color.rgb=RGBColor.from_string('1F3864')
    p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    r=p.add_run("%s\nKonsolidacja %d plików źródłowych\nStan na %s"%(podstawa,len(PARTS),TODAY)); r.font.size=Pt(10)
    doc.add_page_break()
    doc.add_heading("Nota metodyczna — jak powstał ten dokument",1)
    for t in nota: doc.add_paragraph(t)
    if wersje:
        doc.add_heading("Łańcuch wersji i pliki zastąpione",2); add_table(doc,wersje)
    doc.add_page_break(); doc.add_heading("Spis treści",1); toc(doc); doc.add_page_break()
    _ustalenia(doc, sec)

    uzyte=set()
    for i,(ktyt,kopis) in kanon:
        if i not in PARTS or not PARTS[i][2]: continue
        doc.add_heading(ktyt,1); doc.add_paragraph(kopis)
        emit(doc, PARTS[i][2], base_level=2,
             src_tag="źródło: #%d %s"%(i, INV[i]['name'].replace('.txt','')))
        uzyte.add(i); doc.add_page_break()

    for tyt,opis,idxs in klastry:
        have=[i for i in idxs if i in PARTS and PARTS[i][2] and i not in uzyte]
        if not have: continue
        doc.add_heading(tyt,1); doc.add_paragraph(opis)
        for i in have:
            st,rola,blocks=PARTS[i]
            doc.add_heading("%s  [#%d]"%(INV[i]['name'].replace('.txt',''),i),2)
            p=doc.add_paragraph(); r=p.add_run("Wkład do tej sekcji: %s"%rola)
            r.font.size=Pt(8.5); r.italic=True
            emit(doc, blocks, base_level=3); uzyte.add(i)
        doc.add_page_break()

    reszta=[i for i in sorted(PARTS) if i not in uzyte and PARTS[i][2]]
    if reszta:
        doc.add_heading(reszta_tytul,1)
        for i in reszta:
            st,rola,blocks=PARTS[i]
            doc.add_heading("%s  [#%d]"%(INV[i]['name'].replace('.txt',''),i),2)
            p=doc.add_paragraph(); r=p.add_run("Wkład: %s"%rola); r.font.size=Pt(8.5); r.italic=True
            emit(doc, blocks, base_level=3)
        doc.add_page_break()

    doc.add_heading("ANEKS A — INDEKS ŹRÓDEŁ TEJ SEKCJI",1)
    doc.add_paragraph("Wszystkie pliki korpusu przypisane do tej sekcji wraz z informacją, co dokładnie "
      "z każdego zostało wzięte i czy plik jest wersją obowiązującą. Pliki ze statusem „zastąpiony” "
      "lub „duplikat” nie wnoszą treści — ich zawartość zawiera się w wersji nowszej, wskazanej w statusie.")
    rows=[["#","Plik","Status","Bloków przyjętych","Co wnosi do tej sekcji"]]
    for i,(s,st,rola) in sorted(M.items()):
        if sec not in s.split(','): continue
        n=len(PARTS[i][2]) if i in PARTS else 0
        rows.append([str(i), INV[i]['name'].replace('.txt','')[:60], st, str(n), rola])
    add_table(doc,rows)
    os.makedirs(os.path.dirname(out),exist_ok=True); doc.save(out)
    ch=sum(len(p.text) for p in doc.paragraphs)+sum(len(c.text) for t in doc.tables for r in t.rows for c in r.cells)
    print('%s -> %d B, %d akapitow, %d tabel, ~%d stron'%(out,os.path.getsize(out),
          len(doc.paragraphs),len(doc.tables),round(ch/1800)))
