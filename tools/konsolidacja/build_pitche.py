# -*- coding: utf-8 -*-
"""Dwa pitch decki: maly (aplikacja) i duzy (ekosystem).
Identyfikacja wizualna, logo, kontakty i adresy wg pliku #138 (oficjalny pitch deck)."""
import os
import html
import datetime

E = html.escape
TODAY = datetime.date.today().strftime('%d.%m.%Y')

WWW = "eternallife24.pages.dev"
MAIL = "office.eternal.life@gmail.com"
TEL = "+48 784 407 991"

ZESPOL = [
 ("Maksymilian Pruss", "Zalozyciel &amp; CEO",
  "Wizjoner i architekt ekosystemu Health OS. Dwa lata prac R&amp;D w trybie stealth, "
  "pelna specyfikacja techniczna, model biznesowy i strategia regulacyjna.", "Strategia i produkt (CPO)"),
 ("Adrian Holubcki", "CTO &mdash; Chief Technology Officer",
  "Technologiczny lider projektu. Ekspert w skalowaniu systemow rozproszonych.",
  "GCP Cloud Architect &middot; Cybersecurity &middot; nadzor dev"),
 ("Wiktor Zawislak", "CMO &mdash; Chief Medical Officer",
  "Medyczne sumienie projektu. Zapewnia kliniczna wiarygodnosc silnika Bio-Physics.",
  "Zgodnosc kliniczna &middot; AI triaz"),
 ("Karol Tyszka", "CAO &mdash; Chief Advisor Officer",
  "Strategiczne wsparcie zarzadu. Buduje mosty miedzy technologia a kapitalem.",
  "Relacje inwestorskie &middot; partnerstwa"),
]

CSS = """*{box-sizing:border-box}body{margin:0;background:#070f28;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#e9edf7}
.bar{position:sticky;top:0;z-index:20;background:#070f28;border-bottom:1px solid #1b2c58;padding:11px 26px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:2.4px;font-size:14px;color:#fff}
.logo i{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#7fd4e8,#3b82c4);display:inline-block;font-style:normal;
 text-align:center;line-height:22px;color:#07142e;font-weight:900;font-size:13px}
.bar a{color:#7fd4e8;font-size:12.5px;text-decoration:none}
.slide{max-width:1060px;margin:20px auto;background:#0e1a3f;border:1px solid #1b2c58;border-radius:14px;overflow:hidden}
.inner{padding:30px 34px 22px}
.kick{font-size:11px;letter-spacing:2.2px;color:#7fd4e8;font-weight:700}
h2{margin:6px 0 4px;font-size:26px;line-height:1.22;color:#fff}
.sub{color:#9fb2d8;margin:0 0 13px;font-size:15px}
.lead{font-size:16px;color:#dbe6ff}
.g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(228px,1fr));gap:12px;margin:14px 0}
.g4{display:grid;grid-template-columns:repeat(auto-fit,minmax(198px,1fr));gap:12px;margin:14px 0}
.card{background:#14224e;border:1px solid #223768;border-radius:10px;padding:14px}
.card h4{margin:0 0 6px;font-size:14.5px;color:#7fd4e8}
.card p{margin:0;font-size:13.2px;color:#c8d5f0}
.tag{margin-top:8px;display:inline-block;font-size:10.5px;letter-spacing:1px;background:#070f28;border:1px solid #2b4380;color:#9fb2d8;padding:2px 8px;border-radius:10px}
.kpis{display:flex;gap:13px;flex-wrap:wrap;margin:14px 0}
.kpi{background:#14224e;border:1px solid #223768;border-radius:10px;padding:12px 18px;min-width:148px}
.kpi b{display:block;font-size:23px;color:#7fd4e8}.kpi span{font-size:12px;color:#9fb2d8}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;display:block;overflow-x:auto}
th,td{border:1px solid #223768;padding:7px 9px;text-align:left;vertical-align:top}
th{background:#14224e;color:#7fd4e8;font-size:12px}
blockquote{border-left:3px solid #7fd4e8;margin:14px 0;padding:6px 14px;color:#bcd0f2;font-style:italic}
.note{font-size:12.5px;color:#9fb2d8;background:#0a1435;border-radius:8px;padding:9px 12px}
.kor{margin-top:14px;background:#2a1c10;border:1px solid #6b4a1e;border-left:4px solid #e0a33e;border-radius:8px;padding:11px 13px;font-size:12.8px;color:#f3ddb8}
.kor b{color:#e0a33e}
.foot{display:flex;justify-content:space-between;padding:9px 34px;background:#0a1435;border-top:1px solid #1b2c58;font-size:11px;letter-spacing:1.5px;color:#5f7cb8}
.person{background:#14224e;border:1px solid #223768;border-radius:10px;padding:14px}
.person b{color:#fff;font-size:14.5px;display:block}
.person em{color:#7fd4e8;font-style:normal;font-size:12px;letter-spacing:.6px}
.person p{font-size:12.8px;color:#c8d5f0;margin:7px 0 0}
"""


def deck(nazwa, plik, slajdy, opis):
    S = []
    for n, (kick, tit, sub, body) in enumerate(slajdy, 1):
        S.append('<section class="slide"><div class="inner"><div class="kick">%s</div>'
                 '<h2>%s</h2>%s%s</div><div class="foot"><span>ETERNALLIFE</span>'
                 '<span>%s</span><span>%02d / %02d</span></div></section>'
                 % (kick, tit, ('<p class="sub">%s</p>' % sub) if sub else '',
                    body, WWW, n, len(slajdy)))
    H = ('<!doctype html><html lang="pl"><head><meta charset="utf-8">'
         '<meta name="viewport" content="width=device-width,initial-scale=1">'
         '<title>ETERNALLIFE - %s</title><style>%s</style></head><body>'
         '<div class="bar"><span class="logo"><i>E</i>ETERNALLIFE</span>'
         '<span style="font-size:12px;color:#9fb2d8">%s</span>'
         '<span style="margin-left:auto"><a href="https://%s">%s</a> &nbsp;&middot;&nbsp; '
         '<a href="mailto:%s">%s</a> &nbsp;&middot;&nbsp; <span style="color:#5f7cb8">%s</span></span></div>'
         '%s</body></html>') % (nazwa, CSS, opis, WWW, WWW, MAIL, MAIL, TEL, ''.join(S))
    out = '/home/user/Eternal-Lite-App/out/%s' % plik
    open(out, 'w', encoding='utf-8').write(H)
    print(out, os.path.getsize(out), 'B, slajdow:', len(slajdy))


def cards(items, cls="g3"):
    return '<div class="%s">%s</div>' % (cls, ''.join(
        '<div class="card"><h4>%s</h4><p>%s</p>%s</div>'
        % (t, d, ('<div class="tag">%s</div>' % g) if g else '') for t, d, g in items))


def kpis(items):
    return '<div class="kpis">%s</div>' % ''.join(
        '<div class="kpi"><b>%s</b><span>%s</span></div>' % (v, l) for v, l in items)


def tbl(head, rows):
    return '<table><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (
        ''.join('<th>%s</th>' % h for h in head),
        ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in r) for r in rows))


def kor(t):
    return '<div class="kor"><b>Korekta wobec kanonu wewnetrznego:</b> %s</div>' % t


def zespol_html():
    return '<div class="g4">%s</div>' % ''.join(
        '<div class="person"><b>%s</b><em>%s</em><p>%s</p><div class="tag">%s</div></div>'
        % (a, b, c, d) for a, b, c, d in ZESPOL)


KONTAKT = ('<div class="g3">'
           '<div class="card"><h4>Zalozyciel &amp; CEO</h4><p>Maksymilian Pruss</p>'
           '<div class="tag">%s</div></div>'
           '<div class="card"><h4>Telefon</h4><p>%s</p><div class="tag">odpowiadamy w 24h</div></div>'
           '<div class="card"><h4>Strona</h4><p><a style="color:#7fd4e8" href="https://%s">%s</a></p>'
           '<div class="tag">Warszawa, Polska (HQ)</div></div></div>') % (MAIL, TEL, WWW, WWW)

# ---------------- PITCH APLIKACJI (maly) ----------------
APP = [
 ("PRE-SEED &middot; APLIKACJA", "Eternal App",
  "Zintegrowana platforma danych zdrowotnych &mdash; rozwiazanie problemu ostatniej mili",
  '<p class="lead">Aplikacja, ktora zbiera rozproszona historie medyczna w jedno miejsce '
  'i zamienia ja w dane, na ktorych da sie dzialac.</p>'
  + kpis([("16", "modulow A1&ndash;A16"), ("115", "funkcji w rejestrze"),
          ("6", "etapow realnych"), ("Q3 2026", "start MVP")])),
 ("PROBLEM", "80% historii medycznej jest niewidoczne dla algorytmow", None,
  cards([("Martwe dane", "Wyniki badan siedza w PDF-ach, zdjeciach i skanach. Standardowe algorytmy ich nie widza.", ""),
         ("Brak kontekstu", "Smartwatch widzi slaby sen, ale nie widzi niskiej ferrytyny ukrytej w PDF. Predykcje sa bledne.", ""),
         ("Brak dzialania", "Bez standardu FHIR nie ma wymiany danych. Pacjent dostaje informacje, nie mozliwosc dzialania.", "")])
  + '<blockquote>Obecny system jest zaprojektowany do leczenia chorob, a nie utrzymania zdrowia.</blockquote>'),
 ("ROZWIAZANIE", "Eternal Core Intelligence", "Trzy filary aplikacji",
  cards([("Import uniwersalny", "Skan dowolnego dokumentu medycznego i konwersja na dane strukturalne.", "OCR"),
         ("Synchronizacja niezalezna", "Jedno API do wszystkich wiodacych wearables.", "Terra API"),
         ("Logika medyczna", "Korelacja twardych wynikow badan z miekkimi danymi behawioralnymi.", "Bio-Correlation&trade;")])),
 ("MODULY", "Co aplikacja faktycznie robi", "16 modulow, 115 funkcji w rejestrze",
  tbl(["Modul", "Zakres", "Etap"],
      [["A1&ndash;A2", "Agregacja danych i OCR dokumentow", "MVP"],
       ["A3&ndash;A4", "Dashboard, alerty, Bio-Weather, raporty", "MVP"],
       ["A5&ndash;A6", "Telemedycyna oraz AI/RAG z guardrails", "MLP"],
       ["A7&ndash;A8", "Planowanie, rekomendacje, zdrowie psychiczne", "MLP"],
       ["A9&ndash;A12", "Spolecznosc, marketplace, regionalizacja, dokumentacja", "MLP&ndash;FINAL"],
       ["A13&ndash;A16", "Pet, powiadomienia, Fundacja/Hub, Forge", "FINAL"]])),
 ("ARCHITEKTURA", "Od sygnalu do wniosku klinicznego", None,
  tbl(["Warstwa", "Zakres"],
      [["Ingestion", "Terra API (wearables) &middot; OCR dokumentow"],
       ["Structuring", "FHIR R4B &middot; mapowanie SNOMED CT / LOINC"],
       ["Intelligence", "RAG z guardrails &middot; scoring i detekcja anomalii"],
       ["Presentation", "Dashboardy &middot; os czasu &middot; raport dla lekarza"]])
  + '<p class="note">Stos oznaczony w zrodlach jako zamkniety: Flutter + FastAPI + FHIR R4B, '
    'RAG na Qdrant + BioMistral 7B + PubMedBERT, dane surowe na urzadzeniu, hosting w UE.</p>'),
 ("GRUPY DOCELOWE", "Trzy segmenty, trzy rozne powody", None,
  cards([("Biohackerzy 30&ndash;50 lat", "Maja 3+ urzadzenia i dane w 5 aplikacjach. Szukaja korelacji.", "CAC 80 / LTV 1200 PLN"),
         ("Pacjenci metaboliczni", "Stosy PDF-ow i chaos w lekach. Potrzebuja cyfrowego archiwum.", "CAC 100 / LTV 1500 PLN"),
         ("Opiekunowie 40&ndash;60 lat", "Martwia sie o rodzicow. Potrzebuja zdalnego monitoringu.", "CAC 120 / LTV 2000 PLN")])
  + '<p class="note">Warianty produktu wskazane w zrodlach: tryb fitness, panel dla lekarza '
    'oraz tryb dla przewlekle chorych.</p>'),
 ("GRANICA REGULACYJNA", "Wellness teraz, wyrob medyczny pozniej", None,
  cards([("Warstwa A &mdash; poza MDR", "Agregacja, przechowywanie i pokazywanie wlasnych danych, eksport.", "MVP"),
         ("Warstwa B &mdash; poza MDR", "Transkrypcja, dokumentacja, umawianie wizyt, prezentacja danych.", "MLP"),
         ("Warstwa C &mdash; klasa IIa+", "Interpretacja z ocena, alerty progowe z ocena kliniczna.", "po certyfikacji")])
  + kor("Nie mozna wypuscic triazu AI ani wstepnej diagnozy przed certyfikacja. "
        "Zrodla wylaczaja 9 funkcji MDSW z zakresu niecertyfikowanego na podstawie MDCG 2019-11.")),
 ("MODEL", "Ekonomia aplikacji", None,
  tbl(["Pozycja", "Cena wg oficjalnego decku", "COGS", "Marza"],
      [["Lite App", "29,99 PLN/mies", "~10&ndash;15%", "&gt;85%"],
       ["Premium App", "49,99 PLN/mies", "~10%", "&gt;90%"],
       ["B2B Enterprise", "15&ndash;25 PLN PUPM", "&mdash;", "skalowalne"]])
  + kor("Cennik jest najbardziej rozjechana pozycja w calym korpusie: deck 29,99/49,99 &middot; "
        "checklisty 49 &middot; plan operacyjny 19&ndash;29 &middot; specyfikacja Master 5.4 mowi, "
        "ze aplikacja pacjenta jest darmowa w calosci. Do rozstrzygniecia przed prezentacja.")),
 ("ZESPOL", "Kto to buduje", None, zespol_html()),
 ("KONTAKT", "Porozmawiajmy", "Etap Pre-Seed &mdash; szukamy partnerow i inwestorow", KONTAKT),
]

# ---------------- PITCH EKOSYSTEMU (duzy) ----------------
EKO = [
 ("PRE-SEED &middot; FAZA KONCEPCYJNA", "Rewolucja w prewencji zdrowotnej",
  "Pierwszy na swiecie zintegrowany Health OS",
  '<p class="lead">Ekosystem laczacy aplikacje mobilna, diagnostyke domowa i nanotechnologie, '
  'aby przeksztalcic medycyne prewencyjna.</p>'
  + cards([("Aplikacja mobilna", "Agregacja i strukturyzacja danych do standardu FHIR.", "FAZA 1&ndash;2"),
           ("Diagnostyka domowa", "Eternal Station &mdash; lab-on-chip i system dozowania.", "FAZA 3"),
           ("Nanotechnologia", "Implanty i nanoboty &mdash; monitoring i terapia celowana.", "FAZA 4")])),
 ("PROBLEM I", "Wspolczesna medycyna jest fragmentaryczna i opozniona", None,
  cards([("Rosnace obciazenie chorobami", "Seniorzy i grupy ryzyka wymagaja stalego monitoringu; systemy opieraja sie na rzadkich wizytach.", ""),
         ("Pozne diagnozy", "Diagnozy stawiane sa zbyt pozno, gdy leczenie jest kosztowne i mniej skuteczne.", ""),
         ("Chaos informacyjny", "Dane rozproszone w wielu systemach uniemozliwiaja spojna analize.", "")])),
 ("PROBLEM II", "Bariera ostatniej mili", None,
  kpis([("~80%", "historii medycznej zamknietej w PDF i skanach"), ("0", "wspolnego kontekstu")])
  + cards([("Martwe dane", "Nieczytelne dla algorytmow.", ""), ("Brak kontekstu klinicznego", "Bledne predykcje i falszywe alarmy.", ""),
           ("Brak standaryzacji", "Bez FHIR nie ma wymiany danych.", "")])),
 ("ROZWIAZANIE", "Eternal Core Intelligence", "Uniwersalny translator danych zdrowotnych",
  cards([("Import uniwersalny", "OCR dowolnych dokumentow medycznych.", "Google Document AI"),
         ("Synchronizacja niezalezna", "Jedno API do wszystkich wearables.", "Terra API"),
         ("Logika medyczna", "Korelacja badan z danymi behawioralnymi.", "Bio-Correlation&trade;")])
  + kor("Zrodla nowsze zamykaja stos inaczej: Flutter + FastAPI + FHIR R4B oraz "
        "Qdrant + BioMistral 7B + PubMedBERT, hosting w UE. Terra API wyceniona od 399 USD/mies.")),
 ("RYNEK", "Analiza rynku i segmentacja", None,
  kpis([("1,39 bln USD", "TAM"), ("280 mld USD", "SAM &mdash; OECD"), ("~600 mln USD", "SOM w roku 5")])
  + cards([("B2C", "Biohackerzy, opiekunowie, pacjenci przewlekli.", "CAGR 22%"),
           ("B2B", "Kliniki, ubezpieczyciele, pracodawcy.", "skala"),
           ("Ekspansja", "Polska sandbox &rarr; DACH &rarr; USA.", "3 fazy")])),
 ("PRODUKT", "Cztery fazy do Health OS", None,
  tbl(["Faza", "Produkt", "Istota", "Model"],
      [["1", "Eternal Lite App", "Portfel danych &mdash; OCR i wearables", "Freemium"],
       ["2", "Eternal Premium", "Kieszonkowa klinika", "Subskrypcja"],
       ["3", "Eternal Station", "Domowe laboratorium i dispenser", "Hardware + wklady"],
       ["4", "Nanotech", "Implanty i terapia celowana", "Implant + subskrypcja"]])),
 ("FAZA 1&ndash;2", "Aplikacja: Lite i Premium", None,
  tbl(["Pozycja", "Cena", "COGS", "Marza"],
      [["Lite App", "29,99 PLN/mies", "~10&ndash;15%", "&gt;85%"],
       ["Premium App", "49,99 PLN/mies", "~10%", "&gt;90%"]])
  + kor("Master 5.4: aplikacja pacjenta darmowa w calosci. Plan operacyjny: 19&ndash;29 PLN. "
        "Budzet MVP w decku 110 tys. PLN, w specyfikacji 160&ndash;190 tys. przy orkiestracji, "
        "przy czym wczesniejsze wyceny pomijaly wynagrodzenia.")),
 ("FAZA 3", "Eternal Station &mdash; domowe laboratorium", None,
  tbl(["Model", "Cena", "Koszt", "Marza"],
      [["Zakup", "1 499 PLN", "BOM ~1 100 PLN", "20&ndash;30%"],
       ["Wklady", "149 PLN/mies", "~50 PLN", "60&ndash;70%"],
       ["HaaS 24 mies.", "249 PLN/mies", "start 1 PLN", "staly MRR"]])
  + '<p class="note">NXP i.MX 8M Plus &middot; EKG, SpO2, temperatura, cisnienie &middot; '
    'prototyp Q2 2027, produkcja masowa Q1 2028.</p>'),
 ("FAZA 3 &mdash; WYKONANIE", "OEM, ODM czy produkcja wlasna", None,
  tbl(["Sciezka", "Koszt", "Kontrola", "Szybkosc"],
      [["OEM / white-label (Shenzhen)", "nizszy CAPEX, BOM ~1 100 PLN", "niska &mdash; zalezna od dostawcy", "najszybsza"],
       ["ODM &mdash; wlasny firmware i design", "R&amp;D 4 mln PLN, formy 1,8 mln", "wysoka", "srednia"],
       ["Produkcja wlasna", "najwyzszy CAPEX", "pelna nad jakoscia i lancuchem", "najwolniejsza"],
       ["Certyfikacja cudzych urzadzen", "najnizszy", "srednia", "najszybsza"]])
  + kor("Wariant ostrozny w Master 5.4 to certyfikacja cudzych urzadzen zamiast wlasnej produkcji. "
        "Producentem AD8232 jest Analog Devices, nie Texas Instruments.")),
 ("FAZA 4", "Nanotech i implanty", None,
  cards([("Bio-Tag / Bio-Monitor", "Implanty podskorne: CGM, NFC, temperatura, HRV.", "pilotaz 2028&ndash;29"),
         ("Nanoboty", "Wczesna detekcja i terapia celowana z biodegradacja.", "R&amp;D"),
         ("Bezpieczenstwo", "Bioglass 8625 (ISO 10993), kill-switch, szyfrowanie.", "ISO 10993")])
  + kor("Master 5.4 podnosi klasy: Bio-Tag IIa&rarr;IIb, implant I&rarr;IIb/III, petla zamknieta IIb&rarr;III. "
        "Sciezka MDR klasy III to 3&ndash;8 mln PLN i certyfikacja realistycznie po 2033. "
        "Zasada projektowa: wylacznie odczyt, bez zdalnego sterowania funkcjami ciala, "
        "wylacznik sprzetowy po stronie uzytkownika, mozliwosc usuniecia.")),
 ("MOONSHOTY", "Projekty przelomowe &mdash; ocena wykonalnosci", None,
  tbl(["Projekt", "TRL", "Koszt", "Alternatywa strategiczna"],
      [["Implant Human (Closed Loop)", "wysoki", "15 mln+ PLN", "brak &mdash; zrodlo moatu"],
       ["Nanoboty (platforma)", "bardzo wysoki", "50 mln+ PLN", "poczekac i licencjonowac"],
       ["AGI Medyczna", "ekstremalny", "50 mln+ PLN", "fine-tuning modeli gigantow"],
       ["Przeniesienie swiadomosci", "sci-fi", "100 mln+ przez 20 lat", "&mdash;"]])
  + '<p class="note">Walidacja na linii zwierzecej (CVMP zamiast MDR) skraca droge o 5&ndash;10 lat '
    'i jest w zrodlach traktowana jako obowiazkowy etap posredni przed czlowiekiem.</p>'),
 ("ARCHITEKTURA", "Od sygnalow do insightow klinicznych", None,
  tbl(["Warstwa", "Zakres"],
      [["01 Ingestion", "Terra API &middot; Google Document AI"],
       ["02 Structuring", "FHIR &middot; SNOMED CT / LOINC"],
       ["03 Intelligence", "RAG &middot; scoring &middot; Bio-Correlation&trade;"],
       ["04 Presentation", "Dashboardy &middot; os czasu &middot; insighty"]])),
 ("ZAUFANIE", "Bezpieczenstwo i zgodnosc", None,
  cards([("Szyfrowanie E2E", "AES-256 i TLS 1.3 na kazdym etapie.", ""),
         ("Rejestr rozproszony", "Niezmiennosc historii medycznej.", ""),
         ("Post-quantum", "Algorytmy odporne na komputery kwantowe.", ""),
         ("Zgodnosc", "RODO, HIPAA, MDR.", "")], "g4")
  + kor("Do listy obowiazkowej dochodza pozycje nieobecne w decku: IVDR, dyrektywa 2024/2853 "
        "o odpowiedzialnosci za produkt, AI Act, EHDS oraz NIS2/KSC z kara do 10 mln EUR.")),
 ("ROADMAPA", "2026&ndash;2030+", None,
  tbl(["Rok", "Etap", "Kamienie milowe", "Cel KPI"],
      [["2026", "MVP i walidacja", "P.S.A. &middot; Lite App &middot; 500 testerow", "50 tys. uzytkownikow"],
       ["2027", "MLP i Premium", "Telemedycyna &middot; Bio-Physics &middot; prototyp Station", "100 tys."],
       ["2028", "Ekspansja UE", "DACH &middot; CE MDR &middot; nanoboty in-vitro", "1 mln"],
       ["2029", "USA i produkcja", "FDA 510(k) &middot; &gt;10 tys. stacji", "2,5 mln"],
       ["2030+", "Global i exit", "Azja &middot; IPO lub akwizycja", "wycena 200 mln USD+"]])
  + kor("Roadmapa wewnetrzna ma dwa scenariusze: A (start 2026) i B (start 2030, przesuniecie "
        "o ~3,5 roku, tansze AI i darmowy P1 dzieki EHDS, ale wyzsza konkurencja). Deck pokazuje tylko A.")),
 ("MODEL BIZNESOWY", "Monetyzacja wielofilarowa", None,
  cards([("B2C SaaS", "Freemium &rarr; premium.", "marza &gt;85%"),
         ("HaaS", "Station i wklady.", "marza 20&ndash;70%"),
         ("Marketplace", "Prowizje od telemedycyny i badan.", "~30%"),
         ("Licencje B2B", "Ubezpieczyciele, farmacja, badania.", "15&ndash;25 PLN PUPM")], "g4")),
 ("KONKURENCJA", "Fragmentacja vs integracja", None,
  tbl(["Obszar", "Gracz", "Luka wobec Eternal"],
      [["Aplikacja", "1upHealth, Redox, Human API", "brak interfejsu pacjenta / tylko middleware / brak AI"],
       ["Stacja", "Cue Health, Everlywell, Labcorp Pixel", "waski zakres / wolny proces / brak stylu zycia"],
       ["Nano", "Nanovis, Axoft, OncoRevive", "ortopedia / neuro / waskie zastosowanie"]])),
 ("PRZEWAGI", "Dlaczego wygrywamy", None,
  cards([("Zintegrowany ekosystem", "Software + hardware + wetware.", ""),
         ("Closed-Loop Care", "Measure &rarr; Diagnose &rarr; Intervene.", ""),
         ("Fosa danych", "Unikalne korelacje behawioralno-kliniczne.", ""),
         ("Regulatory-by-Design", "Projektowane pod CE MDR i FDA.", "")], "g4")),
 ("ZESPOL", "Zespol zalozycielski", None,
  zespol_html()
  + kor("Nowszy plan operacyjny opisuje sklad inaczej: Janek jako CTO, Adrian jako CTO Hardware, "
        "Wiktor jako CMO/Medical Director, Karol jako CAO. Deck lokuje HQ w Warszawie, "
        "plan operacyjny w Poznaniu. Do uzgodnienia przed wysylka.")),
 ("FINANSE", "Prognozy 5-letnie", None,
  tbl(["Rok", "Przychody", "EBITDA"],
      [["2027", "85 tys. PLN", "&minus;1,62 mln"], ["2028", "513 tys. PLN", "&minus;2,45 mln"],
       ["2029", "1,97 mln PLN", "&minus;3,19 mln"], ["2030", "6,50 mln PLN", "&minus;0,85 mln"],
       ["2031", "18,50 mln PLN", "+1,56 mln"]])),
 ("FINANSOWANIE", "Struktura finansowania", None,
  tbl(["Etap", "Kwota", "Termin", "Equity", "Cel"],
      [["Pre-Seed", "110 tys. PLN", "Q2 2026", "5&ndash;8%", "MVP software"],
       ["Seed", "6,0&ndash;6,7 mln PLN", "Q4 2026", "12&ndash;15%", "Ekosystem, runway 18&ndash;24 mies."],
       ["Runda A", "20 mln PLN", "&mdash;", "&mdash;", "Ekspansja DACH, AI Coach, B2B"],
       ["Runda B", "50 mln+ PLN", "&mdash;", "&mdash;", "USA/Azja, wearables, nanoboty"]])
  + kpis([("5&ndash;7&times;", "oczekiwane ROI"), ("200 mln USD+", "cel wyceny")])),
 ("RYZYKO", "Ryzyka i mitygacja", None,
  tbl(["Ryzyko", "Poziom", "Mitygacja"],
      [["Regulacyjne", "WYSOKIE", "Etapowo wellness &rarr; medical, wczesni eksperci RA"],
       ["Technologiczne", "WYSOKIE", "Modulowa roadmapa, outsourcing OEM"],
       ["Adopcja", "SREDNIE", "Freemium-first, wspolpraca z lekarzami"],
       ["Licencyjne", "WYSOKIE", "Gadgetbridge AGPL blokuje model komercyjny; OpenPose niekomercyjny; Unity najgorszy profil"]])
  + kor("Ryzyko licencyjne nie wystepuje w oficjalnym decku, a w zrodlach jest opisane jako realne "
        "i blokujace &mdash; fork biblioteki na AGPL nie zmienia jej licencji.")),
 ("KONTAKT", "Porozmawiajmy", "Etap Pre-Seed &mdash; szukamy partnerow strategicznych i inwestorow", KONTAKT),
]

deck("Pitch aplikacji", "ETERNAL_PITCH_APLIKACJA.html", APP,
     "Pitch deck &mdash; sama aplikacja")
deck("Pitch ekosystemu", "ETERNAL_PITCH_EKOSYSTEM.html", EKO,
     "Pitch deck &mdash; caly ekosystem")
