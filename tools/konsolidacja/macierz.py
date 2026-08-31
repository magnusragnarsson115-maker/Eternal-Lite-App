# -*- coding: utf-8 -*-
"""Macierz funkcji: monetyzacja / potrzeba uzytkownika / potrzeba ekosystemu /
duplikacja w efekcie koncowym. Buduje XLSX + JSON do wstawienia do DOCX."""
import json
import re
import collections

F = json.load(open('build/FUNKCJE.json'))

PROD = {'A': 'Eternal App', 'S': 'Eternal Station', 'C': 'Eternal Capsule',
        'D': 'Eternal Digital Twin', 'X': 'Eternal Matrix'}

MODUL = {
 'A1': 'Agregacja i synchronizacja', 'A2': 'OCR i digitalizacja',
 'A3': 'Dashboard, alerty, Bio-Weather', 'A4': 'Raporty i eksport',
 'A5': 'Telemedycyna i zdalna opieka', 'A6': 'AI, RAG, chatboty',
 'A7': 'Planowanie i rekomendacje', 'A8': 'Zdrowie psychiczne',
 'A9': 'Spolecznosc i gamifikacja', 'A10': 'Marketplace',
 'A11': 'Geolokalizacja i tlumaczenie', 'A12': 'Nagrywanie i dokumentacja',
 'A13': 'Eternal Pet', 'A14': 'Powiadomienia i eskalacja',
 'A15': 'Fundacja / Hub Innowatora', 'A16': 'Eternal Forge',
 'S1': 'Diagnostyka podstawowa', 'S2': 'Diagnostyka biochemiczna',
 'S3': 'System dozowania', 'S4': 'Telemedycyna i lacznosc', 'S5': 'Srodowisko i bezpieczenstwo',
 'C1': 'Bio-Tag', 'C2': 'Bio-Monitor', 'C3': 'The Hive', 'C4': 'The Swarm',
 'D1': 'EDM', 'D2': 'Predykcyjny Blizniak', 'D3': 'Eternal Legacy',
 'X1': 'Spolecznosc Matrix', 'X2': 'Immersja cyfrowa',
}

# kanal monetyzacji per modul (K1..K11 wg modelu rekomendowanego)
KANAL = {
 'A1': 'K3 API/eksport danych (posrednio) - fundament, sam nie zarabia',
 'A2': 'K3 API + K7 B2B przychodnie (OCR jako usluga)',
 'A3': 'K0 darmowe - naped retencji',
 'A4': 'K7 B2B lekarze (raport SBAR) + K6 platnicy',
 'A5': 'K5 prowizja telemedyczna 20-30%',
 'A6': 'K7 B2B (CDSS po certyfikacji) + K10 fitness/coaching',
 'A7': 'K10 fitness i suplementacja (Auto-Refill)',
 'A8': 'K11 choroby przewlekle i zdrowie psychiczne (B2B klinika)',
 'A9': 'K0 darmowe - spolecznosc buduje dane',
 'A10': 'K5 prowizja marketplace 5-15%',
 'A11': 'K0 darmowe - warunek ekspansji',
 'A12': 'K7 B2B przychodnie (AI Scribe / Eternal Assist)',
 'A13': 'K1 subskrypcja Pet + K5 prowizja weterynaryjna',
 'A14': 'K0 darmowe - funkcja bezpieczenstwa',
 'A15': 'K8 granty i licencjonowanie IP do spolki',
 'A16': 'K9 licencje IP/API + K4 token',
 'S1': 'K2 hardware + wklady', 'S2': 'K2 hardware + wklady',
 'S3': 'K2 wklady i Auto-Refill', 'S4': 'K5 prowizja telemedyczna',
 'S5': 'K2 hardware',
 'C1': 'K2 implant jednorazowy', 'C2': 'K1 subskrypcja implantu',
 'C3': 'K1 subskrypcja + K7 B2B', 'C4': 'K7 B2B szpitale (procedura)',
 'D1': 'K3 eksport danych + K6 platnicy',
 'D2': 'K6 platnicy/ubezpieczyciele (scoring) + K3 dane zagregowane',
 'D3': 'K1 subskrypcja Vault (Legacy)',
 'X1': 'K4 token i spolecznosc', 'X2': 'K1 subskrypcja premium immersja',
}

# czy funkcja jest potrzebna uzytkownikowi (U) i ekosystemowi (E)
UZYT = {'A1': 3, 'A2': 3, 'A3': 3, 'A4': 3, 'A5': 3, 'A6': 3, 'A7': 2, 'A8': 3,
        'A9': 2, 'A10': 2, 'A11': 2, 'A12': 1, 'A13': 2, 'A14': 3, 'A15': 1, 'A16': 1,
        'S1': 3, 'S2': 2, 'S3': 2, 'S4': 3, 'S5': 2,
        'C1': 2, 'C2': 3, 'C3': 2, 'C4': 3, 'D1': 3, 'D2': 2, 'D3': 1, 'X1': 1, 'X2': 1}
EKOS = {'A1': 3, 'A2': 3, 'A3': 2, 'A4': 2, 'A5': 2, 'A6': 3, 'A7': 2, 'A8': 1,
        'A9': 2, 'A10': 2, 'A11': 2, 'A12': 2, 'A13': 2, 'A14': 2, 'A15': 3, 'A16': 3,
        'S1': 2, 'S2': 2, 'S3': 3, 'S4': 1, 'S5': 1,
        'C1': 2, 'C2': 3, 'C3': 3, 'C4': 2, 'D1': 3, 'D2': 3, 'D3': 2, 'X1': 1, 'X2': 1}
SK = {3: 'wysoka', 2: 'srednia', 1: 'niska'}

# duplikacja w EFEKCIE koncowym: rozne mechanizmy, ten sam rezultat dla uzytkownika
EFEKT = [
 ("Pomiar glukozy", ["S1.5", "C2.1"], "Station mierzy punktowo, Capsule ciagle. Ten sam wynik dla uzytkownika."),
 ("Telemedycyna / wideokonsultacja", ["A5.1", "S4.1"], "Ta sama konsultacja z aplikacji i ze stacji."),
 ("Alert i eskalacja ratunkowa", ["A5.3", "A14.1", "S4.2"], "Trzy drogi do tego samego: wezwanie pomocy."),
 ("Tlumaczenie wyniku na jezyk naturalny", ["A2.4", "A6.4"], "Opisane jako osobne funkcje, efekt identyczny."),
 ("Wizualizacja ciala 2D/3D", ["A3.9", "D2.1"], "Podglad w aplikacji i pelny Twin - ten sam obraz dla pacjenta."),
 ("Nagrywanie konsultacji", ["A5.4", "A12.1"], "Zdublowane miedzy modulem telemedycyny a dokumentacji."),
 ("Ankiety / zdalny wywiad AI", ["A5.5", "A12.3", "A12.4"], "Trzy kody, jeden efekt: zebranie wywiadu."),
 ("Baza wiedzy i spolecznosc", ["A9.1", "A9.2", "X1.1", "X1.2"], "Matrix powiela spolecznosc z aplikacji."),
 ("Gamifikacja i odznaki", ["A9.3", "A9.5", "X1.3"], "NFT/odznaki opisane dwukrotnie."),
 ("Eksport danych medycznych", ["A2.6", "A4.4", "D1.4"], "Trzy sciezki eksportu do FHIR/PDF."),
 ("Przypomnienia o suplementach", ["A14.3", "A7.4", "S3.4"], "Auto-Refill jako przypomnienie, sugestia i zamowienie."),
 ("Webinaria / szkolenia", ["A9.4", "X1.4"], "Powielone miedzy aplikacja a Matrix."),
]
DUP = {}
for nazwa, kody, opis in EFEKT:
    for k in kody:
        DUP[k] = (nazwa, [x for x in kody if x != k], opis)


def sortkey(k):
    m = re.match(r'([A-Z])(\d+)\.(\d+)', k)
    return (m.group(1), int(m.group(2)), int(m.group(3)))


rows = []
for kod in sorted(F, key=sortkey):
    d = F[kod]
    mod = re.match(r'([A-Z]\d+)', kod).group(1)
    dup = DUP.get(kod)
    rows.append({
     'kod': kod,
     'nazwa': d['nazwa'] or '(nazwa nieustalona w zrodlach)',
     'produkt': PROD.get(kod[0], '?'),
     'modul': '%s %s' % (mod, MODUL.get(mod, '')),
     'etap': d['etap'] or 'n/d',
     'klasa': d['klasa'] or 'n/d',
     'kanal': KANAL.get(mod, 'n/d'),
     'zarabia': 'NIE (fundament)' if KANAL.get(mod, '').startswith('K0') else 'TAK',
     'uzytkownik': SK.get(UZYT.get(mod, 2), 'srednia'),
     'ekosystem': SK.get(EKOS.get(mod, 2), 'srednia'),
     'dup_efekt': dup[0] if dup else '',
     'dup_z': ', '.join(dup[1]) if dup else '',
     'dup_opis': dup[2] if dup else '',
     'zrodla': ', '.join('#%d' % i for i in d['zrodla'][:12]),
     'n_zrodel': len(d['zrodla']),
    })
json.dump(rows, open('build/MACIERZ.json', 'w'), ensure_ascii=False)

print('funkcji w macierzy:', len(rows))
print('zarabiajacych bezposrednio:', sum(1 for r in rows if r['zarabia'] == 'TAK'))
print('fundamentowych (K0, nie zarabiaja wprost):', sum(1 for r in rows if r['zarabia'] != 'TAK'))
print('objetych duplikacja w efekcie:', sum(1 for r in rows if r['dup_efekt']),
      'w', len(EFEKT), 'grupach')
c = collections.Counter(r['produkt'] for r in rows)
print('wg produktu:', dict(c))
