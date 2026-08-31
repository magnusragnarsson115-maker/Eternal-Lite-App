# -*- coding: utf-8 -*-
"""Specyfikacja w ukladzie TEMATYCZNYM (jeden rozdzial = jedno zagadnienie)."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkdocx import (Document, setup, toc, add_table, emit, Pt, RGBColor,
                    WD_ALIGN_PARAGRAPH, INV, M, TODAY)  # noqa: E402

T = json.load(open('build/TEMATY.json'))

OPIS = {
 "T01": "Warstwa nadzoru nad funkcjami: co system blokuje, co eskaluje i co wylacza. "
        "Obejmuje modul kontrolny na kazda funkcje ryzykowna oraz mechanizmy failsafe.",
 "T02": "Brama API ekosystemu: kto i na jakich zasadach dostaje dostep do danych, "
        "jak dziala limitowanie i audyt wywolan.",
 "T03": "Warstwa, ktora sprowadza dane z roznych urzadzen i dokumentow do jednego modelu (FHIR). "
        "To ona spina alternatywne sciezki diagnostyczne w jeden produkt.",
 "T04": "Fundacja jako sciezka wejscia dla innowatorow: nabor, ocena, stypendia, licencjonowanie do spolki.",
 "T05": "Platforma posredniczaca: katalog IP i OSS, marketplace modulow i API, gospodarka tokenowa. "
        "UWAGA: zrodla nie sa zgodne co do tego, czym Forge jest - patrz rozbieznosc na koncu rozdzialu.",
 "T06": "Rozdzielenie tego, co widzi uzytkownik, od tego, co dzieje sie w systemie. "
        "Kazda funkcja ma opisane oba przebiegi osobno.",
 "T07": "Klasyfikacja funkcji wedlug tego, czy przynosi przychod, czy jest potrzebna uzytkownikowi, "
        "czy tylko ekosystemowi. Tu mieszcza sie pojecia funkcji erozyjnych i deflacyjnych.",
 "T08": "Duplikacja liczona efektem koncowym, nie mechanizmem: dwie rozne technicznie funkcje "
        "moga dawac ten sam rezultat dla uzytkownika. Obejmuje system punktow wspolnych i regule 33%.",
 "T09": "Aktualny stan rejestru: ile jest funkcji, ile modulow i jak te liczby zmienialy sie miedzy wersjami.",
 "T10": "Segmenty i persony, wraz z wariantami aplikacji dla fitnessu, dla lekarza i dla przewlekle chorych.",
 "T11": "Jak faktycznie wyprodukowac Station: OEM, ODM, white-label czy produkcja wlasna - z kosztami i konsekwencjami.",
 "T12": "Ocena technologii diagnostycznych dostepnych dzis: mikrofluidyka, spektrofotometria, BIA, EKG.",
 "T13": "Warstwa wewnatrzustrojowa: co jest wykonalne, w jakiej klasie i gdzie przebiega granica sterowania.",
 "T14": "Projekty przelomowe wraz z ocena dojrzalosci technologicznej i realnym horyzontem.",
 "T15": "Gdzie przebiega granica wyrobu medycznego i ktore funkcje sa po ktorej jej stronie.",
 "T16": "Decyzje technologiczne oznaczone w zrodlach jako zamkniete, wraz z rozbieznosciami miedzy wersjami.",
}

doc = Document()
setup(doc)
for t, sz, b in [("ETERNAL ECOSYSTEM", 26, True),
                 ("SPECYFIKACJA W UKLADZIE TEMATYCZNYM", 16, True),
                 ("Jeden rozdzial = jedno zagadnienie, zlozone ze wszystkich zrodel naraz", 12, False)]:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(t)
    r.font.size = Pt(sz)
    r.bold = b
    if sz >= 16:
        r.font.color.rgb = RGBColor.from_string('1F3864')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("16 zagadnien przekrojowych\nStan na %s" % TODAY)
r.font.size = Pt(10)
doc.add_page_break()

doc.add_heading("Nota metodyczna", 1)
for t in [
 "Ten dokument jest odpowiedzia na zarzut, ze poprzednia wersja specyfikacji byla ulozona wedlug plikow "
 "zrodlowych, a nie wedlug zagadnien. Zeby przeczytac o bramie API, trzeba bylo skakac miedzy trzema miejscami.",
 "Tutaj kolejnosc jest odwrocona. Kazdy rozdzial to jedno zagadnienie, a jego tresc jest zebrana ze WSZYSTKICH "
 "plikow korpusu naraz - uporzadkowana wedlug wiarygodnosci zrodla, nie wedlug tego, w ktorym pliku sie znalazla. "
 "Przy kazdym fragmencie stoi numer pliku, z ktorego pochodzi, a na koncu rozdzialu jest lista wszystkich zrodel.",
 "Zmiana wobec poprzedniej wersji: pliki oznaczone jako zastapione nie sa juz pomijane przez etykiete. "
 "Kazdy jest wczytywany i porownywany blok po bloku - zostaje z niego wylacznie tresc, ktorej nie ma w wersji nowszej. "
 "Odzyskalo to 4 017 blokow, z czego najwiecej z checklisty v2, ktora uzywa zupelnie innej taksonomii modulow "
 "(M1-M16 z funkcjami numerowanymi F) i zawiera funkcje nieobecne w nowszych plikach.",
 "Drugi przebieg deduplikacji porownuje tresc jako podciag, nie jako hash bloku. Wychwytuje to duplikaty "
 "miedzy formatami: ten sam dokument w PDF i w DOCX tnie sie inaczej, wiec hashe blokow sie nie zgadzaja, "
 "choc tresc jest identyczna.",
 "Czego ten dokument NIE robi: nie rozstrzyga sprzecznosci miedzy zrodlami. Tam, gdzie zrodla mowia rozne rzeczy, "
 "obie wersje sa pokazane obok siebie z zaznaczeniem, ktore zrodlo jest nowsze. Rozstrzygniecie jest decyzja "
 "biznesowa, nie redakcyjna.",
] :
    doc.add_paragraph(t)
doc.add_page_break()
doc.add_heading("Spis tresci", 1)
toc(doc)
doc.add_page_break()

doc.add_heading("Mapa zagadnien", 1)
rows = [["ID", "Zagadnienie", "Blokow tresci", "Zrodel"]]
for t in T:
    rows.append([t['id'], t['nazwa'], str(t['n']), str(len(t['zrodla']))])
add_table(doc, rows)
doc.add_page_break()

for t in T:
    doc.add_heading("%s. %s" % (t['id'], t['nazwa']), 1)
    doc.add_paragraph(OPIS.get(t['id'], ''))
    p = doc.add_paragraph()
    r = p.add_run("Zebrane z %d plikow zrodlowych, %d blokow tresci. "
                  "Kolejnosc: najpierw zrodla o statusie FINAL, potem unikaty, na koncu wersje wczesniejsze."
                  % (len(t['zrodla']), t['n']))
    r.font.size = Pt(8.5)
    r.italic = True
    last = None
    for idx, st, b in t['bloki']:
        if idx != last:
            q = doc.add_paragraph()
            rr = q.add_run("— zrodlo #%d %s [%s]" % (idx, INV[idx]['name'].replace('.txt', '')[:56], st))
            rr.font.size = Pt(7.5)
            rr.font.color.rgb = RGBColor.from_string('808080')
            rr.italic = True
            last = idx
        emit(doc, [b], base_level=2)
    doc.add_heading("Zrodla tego rozdzialu", 2)
    sr = [["#", "Plik", "Status", "Blokow w tym rozdziale", "Rola pliku"]]
    for i, n in t['zrodla']:
        sr.append([str(i), INV[i]['name'].replace('.txt', '')[:58], M[i][1], str(n), M[i][2]])
    add_table(doc, sr)
    doc.add_page_break()

out = '/home/user/Eternal-Lite-App/out/ETERNAL_SPECYFIKACJA_TEMATYCZNA.docx'
doc.save(out)
ch = (sum(len(p.text) for p in doc.paragraphs)
      + sum(len(c.text) for tb in doc.tables for r in tb.rows for c in r.cells))
print('%s -> %d B, %d akapitow, %d tabel, ~%d stron'
      % (out, os.path.getsize(out), len(doc.paragraphs), len(doc.tables), round(ch / 1800)))
