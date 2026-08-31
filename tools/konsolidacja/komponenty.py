# -*- coding: utf-8 -*-
"""Przypisanie komponentow do 337 funkcji: klasa K, warstwa zgodnosci, dostawcy,
czas wyjscia, prog zmiany modelu. Realizuje polecenie z Master 5.4 wiersz 122:
"Do kazdej karty funkcji dopisac: KLASA KOMPONENTU, WARSTWA ZGODNOSCI (A/B/C),
CZAS WYJSCIA w dniach i PROG ZMIANY wyrazony liczba."
"""
import json
import re
import sys
import os
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dane_komponenty import K, WARSTWA, SZCZEBEL, WYZWALACZE, SKLADOWE

F = json.load(open('build/FUNKCJE.json'))

PROD = {'A': 'Eternal App', 'S': 'Eternal Station', 'C': 'Eternal Capsule',
        'D': 'Eternal Digital Twin', 'X': 'Eternal Matrix'}

MODUL = {
 'A1': 'Agregacja i synchronizacja', 'A2': 'OCR i digitalizacja',
 'A3': 'Dashboard, alerty, Bio-Weather', 'A4': 'Raporty i eksport',
 'A5': 'Telemedycyna i zdalna opieka', 'A6': 'AI, RAG, chatboty',
 'A7': 'Planowanie i rekomendacje', 'A8': 'Zdrowie psychiczne',
 'A9': 'Społeczność i gamifikacja', 'A10': 'Marketplace',
 'A11': 'Geolokalizacja i tłumaczenie', 'A12': 'Nagrywanie i dokumentacja',
 'A13': 'Eternal Pet', 'A14': 'Powiadomienia i eskalacja',
 'A15': 'Fundacja / Hub Innowatora', 'A16': 'Eternal Forge',
 'A17': 'Kalendarz, skanery i doradcy kontekstowi',
 'A18': 'Przejrzystość, zgody i nadzór nad wyrobem',
 'A19': 'Zgodność AI i bezpieczeństwo farmakoterapii',
 'A20': 'Leki, alergie i grupy szczególne',
 'A21': 'Wywiad rodzinny, zdrowie kobiet, rehabilitacja',
 'A22': 'Ból, sprawność i bezpieczeństwo seniora',
 'A23': 'Dostępność i wykluczenie cyfrowe',
 'A24': 'Dostęp współdzielony i konta rodzinne',
 'S1': 'Diagnostyka podstawowa', 'S2': 'Diagnostyka biochemiczna',
 'S3': 'System dozowania', 'S4': 'Telemedycyna i łączność',
 'S5': 'Środowisko i bezpieczeństwo',
 'S6': 'Dozowanie zaawansowane i pomiary bezdotykowe',
 'C1': 'Bio-Tag', 'C2': 'Bio-Monitor', 'C3': 'The Hive', 'C4': 'The Swarm',
 'C5': 'Terapia i monitoring wewnątrzustrojowy',
 'D1': 'EDM — elektroniczna dokumentacja', 'D2': 'Predykcyjny Bliźniak',
 'D3': 'Eternal Legacy', 'D4': 'Symulacja, ciało 3D, dziedziczenie cyfrowe',
 'D5': 'Twin populacyjny i benchmarki',
 'X1': 'Społeczność Matrix', 'X2': 'Immersja cyfrowa',
 'X3': 'Światy zdrowotne VR/AR',
}

# klasa komponentu wiodaca + wspierajace, per modul
KLASY_MOD = {
 'A1': ('K01', ['K02', 'K24']), 'A2': ('K04', ['K02', 'K18']),
 'A3': ('K11', ['K14', 'K23']), 'A4': ('K18', ['K02']),
 'A5': ('K08', ['K10', 'K19']), 'A6': ('K05', ['K06', 'K23']),
 'A7': ('K23', ['K15', 'K05']), 'A8': ('K30', ['K05', 'K09']),
 'A9': ('K13', ['K19']), 'A10': ('K21', ['K10']),
 'A11': ('K17', ['K05']), 'A12': ('K07', ['K05', 'K18']),
 'A13': ('K22', ['K21', 'K01']), 'A14': ('K09', ['K23', 'K24']),
 'A15': ('K27', ['K26']), 'A16': ('K26', ['K21', 'K02']),
 'A17': ('K25', ['K23', 'K24']), 'A18': ('K19', ['K23']),
 'A19': ('K23', ['K19', 'K05']), 'A20': ('K20', ['K23', 'K02']),
 'A21': ('K23', ['K16', 'K02']), 'A22': ('K23', ['K01', 'K09']),
 'A23': ('K11', ['K19']), 'A24': ('K19', ['K02']),
 'S1': ('K22', ['K01']), 'S2': ('K28', ['K22', 'K29']),
 'S3': ('K22', ['K23']), 'S4': ('K08', ['K09']),
 'S5': ('K22', ['K14']), 'S6': ('K22', ['K28', 'K23']),
 'C1': ('K22', ['K28']), 'C2': ('K28', ['K22']),
 'C3': ('K28', ['K22', 'K24']), 'C4': ('K28', ['K22']),
 'C5': ('K28', ['K22', 'K23']),
 'D1': ('K02', ['K03', 'K20']), 'D2': ('K23', ['K05', 'K06']),
 'D3': ('K03', ['K19', 'K18']), 'D4': ('K12', ['K05', 'K23']),
 'D5': ('K03', ['K06', 'K02']),
 'X1': ('K13', ['K19']), 'X2': ('K12', ['K08']), 'X3': ('K12', ['K08']),
}

# --- warstwa zgodnosci: rozstrzygana ze slow kluczowych w nazwie funkcji ----
KLIN = re.compile(
 r'interpretac|interpretuj|ocena kliniczn|ocenia ryzyk|diagnoz|triage|predykc|prognoz|'
 r'scoring|wykrywanie (?:zmian|nowotwor|infekcj|choroby|arytmi|migotan|zawa)|'
 r'wczesne wykrywanie|rozpoznawanie (?:stanu|choroby|zmian)|dobór lek|dawkowan|'
 r'autonomiczne dozowanie|insulin|farmakogenom|interakcj[ae] lek|'
 r'symulator (?:efektu|wieku)|wiek biologiczn|zegar (?:epigenet|biologicz)|'
 r'alert(?:y)? (?:progow|kliniczn|medyczn)|próg kliniczn|ocena ryzyk|'
 r'trójkolorow|trojkolorow|czerwona flaga|sygnalizacja świetln|detektor kryzys|wykrywanie upadk|priorytetyzacj[ai] kliniczn|CDSS', re.I)
KLINIKA_B = re.compile(
 r'transkrypc|dokumentacj|scribe|umawian|rejestracj|SBAR|panel (?:dla )?lekar|'
 r'karta pacjenta|wywiad|ankiet|raport dla lekar|skierowan|konsultacj|teleporad|'
 r'wideokonsultacj', re.I)
GRANICA = re.compile(
 r'pomiar|monitorowanie|monitoring|czujnik|sensor|analiza (?:głosu|ruchu|obrazu|zdj)|'
 r'skaner|EKG|glukoz|ciśnien|cisnien|saturacj|tętn|spirometr|centylow', re.I)
PRAWA = re.compile(
 r'prawo (?:do|zakwestionow)|zakwestionowan|oznaczanie treści|deklaracja przeznaczen|'
 r'log dostępu|wycofanie zgody|usunięcie danych|karta modelu|rejestr zastosowań|'
 r'tryb degradacji|dostępność podstawowa|prostego języka|czytnikiem ekranu', re.I)
# moduly, w ktorych produkt sam w sobie jest wyrobem niezaleznie od nazwy funkcji
MOD_C = {'C1', 'C2', 'C3', 'C4', 'C5', 'S2', 'D2'}


def warstwa(kod, nazwa, modul, klasa_src):
    """Warstwa zgodnosci wg definicji z Master 5.4.

    Pole 'klasa' z FUNKCJE.json (IIA/IIB/III) NIE jest uzywane: kontrola wykazala,
    ze jest artefaktem ekstrakcji — jako IIB oznaczone sa m.in. 'Dashboard glowny'
    i 'Reczne dodawanie danych', ktore wyrobem nie sa. Pole zostaje w wynikach
    wylacznie jako slad zrodlowy, z adnotacja.
    """
    n = nazwa
    # obowiazki przejrzystosci i praw uzytkownika nie sa funkcjami wyrobu,
    # nawet gdy w nazwie pada slowo 'scoring' albo 'ocena'
    if PRAWA.search(n):
        return 'A', ('obowiązek przejrzystości albo prawo użytkownika — nie jest funkcją '
                     'wyrobu, choć dotyczy funkcji, która nią jest')
    if modul in MOD_C:
        return 'C', 'implant, pomiar biochemiczny albo bliźniak predykcyjny — produkt jest wyrobem'
    if KLIN.search(n):
        return 'C', 'nazwa funkcji zawiera własną ocenę, interpretację, predykcję albo dawkowanie'
    if KLINIKA_B.search(n):
        return 'B', 'praca na dokumentacji i organizacji wizyty, bez własnej oceny klinicznej'
    if GRANICA.search(n):
        return 'B', ('GRANICA — pomiar albo prezentacja parametru bez interpretacji. '
                     'Dodanie własnej oceny albo progu klinicznego przenosi funkcję do C')
    return 'A', 'prezentacja, agregacja albo wellness bez oceny'


# --- czas wyjscia i prog zmiany -------------------------------------------
CZAS_WYJSCIA = {5: 0, 4: 30, 3: 60, 2: 14, 1: 7}


def prog_zmiany(kk):
    p = K[kk][4]
    m = re.search(r'([\d\s]+)\s*zł/mies', p)
    if m:
        return p.split('.')[0].strip()
    if 'Nigdy' in p or 'Nie wychodzimy' in p or 'Nie dotyczy' in p:
        return 'brak progu kosztowego — pozostaje reguła 33% i wyzwalacze W3–W8'
    return p


def certyfikacja(w, kk):
    if w == 'C':
        if kk == 'K28':
            return ('TAK — albo proxy do cudzego CE',
                    'Proxy (Labplus) bez modyfikacji wyniku LUB własne dossier klasy IIa/IIb')
        return ('TAK — IIa lub wyżej',
                'Dossier, jednostka notyfikowana, ISO 13485, PRRC, UDI, EUDAMED; '
                '80–150 tys. zł i 6–12 mies. dla IIa')
    if w == 'B':
        return ('NIE, dopóki nie ma własnej oceny',
                'Sprzedaż od dnia pierwszego. Wyzwalacze W3, W5 i W6 przenoszą do C')
    return ('NIE', 'Warstwa A poza MDR. Wyzwalacz W3 przenosi do C')


ROWS = []
for kod, v in sorted(F.items(), key=lambda x: (re.match(r'([A-Z]+)(\d+)', x[0]).group(1),
                                               int(re.match(r'[A-Z]+(\d+)', x[0]).group(1)),
                                               x[0])):
    m = re.match(r'([A-Z]+\d+)', kod)
    mod = m.group(1)
    nazwa = re.sub(r'\s+', ' ', v['nazwa']).strip()
    kk, wsp = KLASY_MOD.get(mod, ('K23', []))
    w, powod = warstwa(kod, nazwa, mod, v.get('klasa', ''))
    cert, cert_co = certyfikacja(w, kk)
    kl = K[kk]
    szcz = kl[7]
    ROWS.append({
     'kod': kod, 'nazwa': nazwa, 'produkt': PROD.get(mod[0], mod[0]),
     'modul': mod, 'modul_nazwa': MODUL.get(mod, mod),
     'klasa': kk, 'klasa_nazwa': kl[0], 'wspierajace': ' + '.join(wsp),
     'skladowe': ' / '.join('%s. %s' % (s, SKLADOWE[s][0]) for s in kl[8]),
     'dostawca_start': kl[6], 'wariant_a': kl[1], 'wariant_b': kl[2], 'wariant_c': kl[3],
     'warstwa': w, 'warstwa_nazwa': WARSTWA[w][0], 'warstwa_powod': powod,
     'granica': 'TAK' if 'GRANICA' in powod or 'granica' in powod else 'nie',
     'charakter': WARSTWA[w][2],
     'etap': v.get('etap') or 'MVP', 'klasa_mdr_zrodlo': (v.get('klasa', '') or '—') + ' (artefakt ekstrakcji — nieużyte)',
     'certyfikacja': cert, 'certyfikacja_co': cert_co,
     'szczebel': szcz, 'szczebel_nazwa': SZCZEBEL[szcz][0],
     'czas_wyjscia': CZAS_WYJSCIA[szcz],
     'prog_zmiany': prog_zmiany(kk),
     'kontrola': kl[5], 'zrodla': len(v.get('zrodla', [])),
    })

json.dump(ROWS, open('build/KOMPONENTY.json', 'w'), ensure_ascii=False)

c_w = collections.Counter(r['warstwa'] for r in ROWS)
c_k = collections.Counter(r['klasa'] for r in ROWS)
c_all = collections.Counter()
for r in ROWS:
    c_all[r['klasa']] += 1
    for x in r['wspierajace'].split(' + '):
        if x: c_all[x] += 1
c_e = collections.Counter(r['etap'] for r in ROWS)
print('funkcji:', len(ROWS))
print('warstwa:', dict(c_w))
print('etap:', dict(c_e))
print('certyfikacja TAK:', sum(1 for r in ROWS if r['certyfikacja'].startswith('TAK')))
print('granica B (pomiar bez interpretacji):', sum(1 for r in ROWS if r['granica']=='TAK'))
print('klasy jako wiodace:', len(c_k), '| z wspierajacymi:', len(c_all), 'z', len(K))
print('nieuzyte wcale:', sorted(set(K) - set(c_all)))
for k, n in c_k.most_common():
    print('  %s %-52s %3d' % (k, K[k][0][:52], n))
