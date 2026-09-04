# -*- coding: utf-8 -*-
"""Generator kart funkcji wg szablonu CEO.

Osiemnascie pol szablonu plus warstwa rozszerzona. Pola wyprowadzane
deterministycznie z rejestru; dla funkcji rdzeniowych (te, ktore wchodza
do szesciu produktow) tresc jest pisana recznie w OVERRIDE.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rejestr import R
import dane_produkty as PR

RDZEN = sorted({f for p in PR.PRODUKTY for f in p['funkcje']})
PRODUKT_FUNKCJI = {}
for p in PR.PRODUKTY:
    for f in p['funkcje']:
        PRODUKT_FUNKCJI.setdefault(f, []).append('%s %s' % (p['kod'], p['nazwa']))

# ------------------------------------------------- wyprowadzenia deterministyczne
_INPUT = {
 'K01': 'strumien z adaptera urzadzenia: probki czasowe z sygnatura zrodla i wersja adaptera',
 'K02': 'zasob w modelu kanonicznym albo dokument w formacie zrodlowym',
 'K03': 'rekord do zapisu wraz z polityka retencji',
 'K04': 'obraz albo plik PDF dokumentu medycznego',
 'K05': 'zapytanie w jezyku naturalnym plus kontekst dopuszczony przez warstwe zgod',
 'K06': 'fragment korpusu wraz z metadanymi zrodla',
 'K07': 'strumien audio z konsultacji',
 'K08': 'strumien wideo i audio dwoch stron',
 'K09': 'zdarzenie systemowe z priorytetem',
 'K11': 'szereg czasowy jednego parametru',
 'K17': 'wartosc z jednostka zrodlowa',
 'K18': 'zakres dat i wybrany format',
 'K22': 'ramka BLE albo MQTT z urzadzenia',
 'K28': 'wynik pomiaru wraz z identyfikatorem wyrobu',
}
_OUTPUT = {
 'K01': 'znormalizowany zasob Observation w modelu kanonicznym, z proweniencja i waga pewnosci',
 'K02': 'zasob zapisany i zwersjonowany, z wpisem w dzienniku audytowym',
 'K03': 'potwierdzenie zapisu wraz z identyfikatorem i czasem',
 'K04': 'pola rozpoznane z pewnoscia per pole oraz lista pol do potwierdzenia',
 'K05': 'odpowiedz z cytowaniem zrodla i oznaczeniem, ze wygenerowal ja model',
 'K06': 'lista fragmentow z ocena trafnosci',
 'K07': 'transkrypcja z podzialem na mowcow',
 'K08': 'polaczenie zestawione, zapis na zadanie',
 'K09': 'komunikat dostarczony wraz z potwierdzeniem',
 'K11': 'wykres i zestawienie tabelaryczne bez podsumowania oceniajacego',
 'K17': 'wartosc w jednostce kanonicznej wraz z wspolczynnikiem przeliczenia',
 'K18': 'plik do pobrania albo link wygasajacy po dobie',
 'K22': 'pomiar zapisany pod identyfikatorem uzytkownika',
 'K28': 'wynik oznaczony producentem wyrobu i wersja wyrobu',
}

# funkcje obowiazkowe w MVP wskazane w pelnym odczycie korpusu — zawsze P0
OBOWIAZKOWE = {'A8.10', 'A2.6', 'A1.5', 'A1.7', 'A2.1'}

def _priorytet(v):
    kod = v['kod']
    if kod in OBOWIAZKOWE:
        return 'P0'
    if v['etap'] == 'MVP' and (kod in RDZEN or v['waga_eko'] == 'wysoka'):
        return 'P0'
    if v['etap'] == 'MVP' or (v['etap'] == 'MLP' and v['waga_eko'] == 'wysoka'):
        return 'P1'
    return 'P2'

def _owner(v):
    m = v['modul_kod']
    if m in ('A1', 'A2', 'D1', 'A11'):        return 'Architektura i integracje'
    if m in ('A12', 'A5', 'A4'):              return 'Produkt kliniczny'
    if m in ('A13',):                          return 'Linia weterynaryjna'
    if m in ('A6', 'D2'):                      return 'AI i modele'
    if m.startswith('S') or m.startswith('C'): return 'Sprzet'
    if m in ('A15', 'A16'):                    return 'Fundacja i Forge'
    if m in ('A17', 'A18', 'A19'):             return 'Zgodnosc'
    return 'Produkt'

def _status(v):
    if v['etap'] == 'MVP':   return 'w zakresie pierwszej wersji'
    if v['etap'] == 'MLP':   return 'zaplanowana, po dowodzie popytu'
    if v['etap'] == 'FINAL': return 'warunkowa — warunek wejscia w karcie produktu'
    if v['etap'] == 'SCI-FI':return 'poza horyzontem produktu — obserwacja, nie plan'
    return 'do rozstrzygniecia'

def _regulacje(v):
    b = ['RODO art. 9 — dane szczegolnej kategorii']
    if v['warstwa'] == 'C':
        b.append('MDR regula 11 zal. VIII — wyrob klasy %s' % (v['klasa_mdr'] or 'IIa'))
        b.append('ocena kwalifikacji wg MDCG 2019-11 rev.1 przed napisaniem kodu')
    if v['warstwa'] == 'B':
        b.append('ustawa o dzialalnosci leczniczej albo umowa powierzenia przetwarzania')
    if v['modul_kod'] in ('A6', 'D2') or 'AI' in v['nazwa'] or 'RAG' in v['nazwa']:
        b.append('AI Act art. 50 — oznaczanie tresci generowanej przez model')
    if v['modul_kod'] in ('A1', 'A2', 'D1'):
        b.append('EEHRxF — kategoria pierwsza od 26.03.2029')
    b.append('NIS2 — rejestracja w Wykazie KSC do 03.10.2026')
    return b

def _bezpieczenstwo(v):
    b = ['dane surowe jak najblizej czlowieka; na zewnatrz wychodza wyniki i wielkosci zbiorcze',
         'kazdy odczyt zostawia wpis w dzienniku audytowym — kto, co, kiedy, na jakiej podstawie',
         'zgoda granularna per cel przetwarzania, odwolywalna natychmiast',
         'rezydencja danych w Unii; klucze po naszej stronie, nie u dostawcy']
    if v['warstwa'] == 'C':
        b.append('tryb degradacji przy niedostepnosci modelu albo chmury — funkcja nie zgaduje')
    if v['modul_kod'] in ('A13',):
        b.append('dane zwierzecia nie sa danymi osobowymi wlasciciela — rozdzielone zbiory')
    return b

def _kryteria(v):
    k = []
    if v['klasa_komp'] == 'K04':
        k.append('ponad 90% pol rozpoznanych bez korekty na tysiacu dokumentow')
        k.append('kazde pole ma wlasna wage pewnosci widoczna dla uzytkownika')
    if v['klasa_komp'] == 'K01':
        k.append('dwa zrodla mierzace ten sam parametr daja jeden zapis z proweniencja obu')
        k.append('wymiana dostawcy nie wymaga zmiany poza plikiem adaptera')
    if v['klasa_komp'] == 'K07':
        k.append('transkrypcja gotowa przed wyjsciem pacjenta z gabinetu')
    if v['warstwa'] == 'A':
        k.append('komunikat nie zawiera oceny, progu ani zalecenia — kontrola na tekstach interfejsu')
    if v['warstwa'] == 'C':
        k.append('przeznaczenie zapisane jednym zdaniem przed pierwsza linia kodu')
        k.append('modul wydzielony z wlasnym cyklem wydawniczym i walidowanym interfejsem')
    k.append('eksport danych tej funkcji dziala i jest bezplatny')
    k.append('dziennik audytowy zapisuje kazde uzycie')
    return k

def _architektura(v):
    return ('Zrodlo, adapter, model kanoniczny, rdzen. Kierunek nigdy odwrotny: rdzen nie '
            'wola API dostawcy, tylko adapter. Funkcja nalezy do klasy komponentu %s (%s), '
            'wspierana przez %s. Warstwa regulacyjna %s — %s'
            % (v['klasa_komp'], v['klasa_komp_nazwa'], v['wspierajace'],
               v['warstwa'], v['warstwa_reg']))

def _buildbuy(v):
    return ('Wariant open source: %s. Wariant platny: %s. Wariant wlasny: %s. '
            'Na start: %s. Prog przejscia na wlasne: %s.'
            % (v['wariant_a'], v['wariant_b'], v['wariant_c'],
               v['dostawca_start'], v['prog_zmiany']))

# --------------------------------------------------------------- overrides
OVERRIDE = {
 'A1.1': {
  'cel': 'Pobrac dane z urzadzen, ktorych uzytkownik juz uzywa, bez proszenia go o zmiane '
         'ekosystemu.',
  'problem': 'Dane sa w pieciu aplikacjach i zadna nie widzi pozostalych. Zegarek widzi slaby '
             'sen, ale nie widzi niskiej ferrytyny ukrytej w pliku PDF.',
  'opis': 'Adapter pobiera dane z Apple, Garmina, Oury i pozostalych przez jedno API, mapuje '
          'je na model kanoniczny i zapisuje z proweniencja. Rdzen nie wie, skad przyszly dane '
          '— to jest wlasnie warunek wymienialnosci dostawcy.',
  'przebieg': 'Uzytkownik loguje sie do swojego konta u producenta raz. Od tego momentu dane '
              'pojawiaja sie same co pietnascie minut. Przy odlaczeniu urzadzenia historia '
              'zostaje.',
  'monetyzacja': 'Sam nie zarabia. Jest warunkiem P1, P2 i P6 oraz przedmiotem licencji API '
                 'dla klientow B2B.',
 },
 'A1.7': {
  'cel': 'Rozstrzygnac, co jest prawda, gdy dwa urzadzenia mierza to samo i pokazuja co innego.',
  'problem': 'Agregacja bez rozstrzygania konfliktu daje smietnik. Uzytkownik widzi dwie '
             'wartosci i nie wie, ktorej wierzyc — a system, ktory wybiera po cichu, klamie.',
  'opis': 'Deduplikacja techniczna usuwa te same pomiary z tego samego zrodla. Konflikt miedzy '
          'zrodlami nie jest rozstrzygany automatycznie: pokazujemy oba odczyty z waga pewnosci '
          'i z metoda pomiaru. Rozstrzyganie merytoryczne przekroczyloby granice wyrobu.',
  'przebieg': 'Uzytkownik widzi: „Dwa wyniki z 12.03, rozne metody — pokazujemy oba”. '
              'Moze oznaczyc, ktore zrodlo uwaza za wiarygodniejsze; system zapamietuje '
              'preferencje, ale nie ukrywa drugiego odczytu.',
  'monetyzacja': 'Fundament. Rozniczka, ktorej nie ma zaden agregator na rynku.',
 },
 'A2.1': {
  'cel': 'Zamienic zdjecie polskiego wyniku badania w dane, ktore da sie porownac z poprzednimi.',
  'problem': 'Osiemdziesiat procent historii medycznej siedzi w plikach PDF i skanach. '
             'Algorytmy tego nie widza, a panstwowa platforma pokazuje wylacznie to, co '
             'placowka zaraportowala.',
  'opis': 'Silnik rozpoznawania jest kupiony i wymienialny. Wlasny jest parser kontekstu '
          'medycznego: ponad trzy tysiace nazw laboratoryjnych, slownik synonimow, jednostki '
          'oraz dopasowanie rozmyte korygujace bledy rozpoznawania znakow.',
  'przebieg': 'Zdjecie, podglad rozpoznanych pol z waga pewnosci przy kazdym, potwierdzenie '
              'pol niepewnych, zapis do historii. Komunikat brzmi „Odczytano: CRP 12 mg/l. '
              'Sprawdz poprawnosc” — nigdy „Twoje CRP jest podwyzszone”.',
  'monetyzacja': 'Driver konwersji w B2C i rozliczenie za dokument w B2B. Marza bardzo wysoka, '
                 'bo koszt krancowy jest bliski zeru po zbudowaniu slownika.',
 },
 'A12.5': {
  'cel': 'Zamienic nagranie wizyty w dokumentacje, ktora lekarz akceptuje jednym kliknieciem.',
  'problem': 'Lekarz traci czas na dokumentacje zamiast na pacjenta. To powod istnienia calej '
             'kategorii produktow, ale zaden gracz miedzynarodowy nie ma polskiego jezyka '
             'medycznego ani integracji z polska dokumentacja.',
  'opis': 'Transkrypcja jest strukturyzowana do pol dokumentacji: wywiad, badanie, rozpoznanie, '
          'zalecenia. Kodowanie ICD proponuje, nie decyduje. Lekarz akceptuje albo poprawia '
          '— i to on jest wytworca dokumentacji, nie my.',
  'przebieg': 'Lekarz wlacza nagrywanie, prowadzi wizyte, konczy. Dokument czeka gotowy do '
              'akceptacji, zanim pacjent wyjdzie.',
  'monetyzacja': 'Licencja per lekarz miesiecznie — abonament instytucjonalny, najlepszy typ '
                 'przychodu w calym zestawieniu, bo decyduje jedna osoba, nie komisja.',
 },
 'A13.5': {
  'cel': 'Dac zwierzeciu trwaly identyfikator, ktory laczy je z jego wlasna historia zdrowia.',
  'problem': 'Transponder identyfikuje zwierze, ale nie prowadzi jego zapisu. Systemy '
             'weterynaryjne prowadza zapis, ale nie oddaja go wlascicielowi.',
  'opis': 'Transponder w standardzie ISO 11784 i 11785 plus warstwa zapisu po naszej stronie. '
          'Lecznica odczytuje ten sam numer, ktorego uzywa dzis; nowa jest tylko ciaglosc '
          'historii i mozliwosc jej zabrania.',
  'przebieg': 'Lecznica skanuje czytnikiem, ktory juz ma. Wlasciciel widzi wpis w aplikacji '
              'i moze wyeksportowac calosc w kazdej chwili, bezplatnie.',
  'monetyzacja': 'Sprzedaz transpondera z marza plus subskrypcja. Tor walidacyjny dla '
                 'pozniejszej warstwy sprzetowej, bez sciany MDR.',
 },
 'D1.6': {
  'cel': 'Przetlumaczyc polski dokument kliniczny na format europejski, zanim stanie sie to '
         'obowiazkiem.',
  'problem': 'Polska dokumentacja stoi na innym standardzie niz europejski. Mapper miedzy nimi '
             'nie istnieje jako produkt, a od 26 marca 2029 potrzebuje go kazdy dostawca '
             'systemu gabinetowego w kraju.',
  'opis': 'Transformacja z walidacja: dokument wchodzi w formacie krajowym, wychodzi w formacie '
          'europejskim, a raport rozbieznosci mowi, ktore pola nie maja odpowiednika. '
          'Uslugi terminologiczna i mapujaca sprzedaja sie razem.',
  'przebieg': 'Placowka nie zmienia niczego u siebie. Mapper stoi obok i tlumaczy w locie; '
              'raport zgodnosci jest dowodem na potrzeby audytu.',
  'monetyzacja': 'Licencja per placowka plus wdrozenie. Zerowy koszt krancowy — marza rosnie '
                 'z kazdym kolejnym klientem.',
 },
}


def karta(kod):
    v = R[kod]
    o = OVERRIDE.get(kod, {})
    kk = v['klasa_komp']
    return {
     'kod': kod, 'nazwa': v['nazwa'], 'produkt_rdzenny': PRODUKT_FUNKCJI.get(kod, []),
     'cel': o.get('cel', 'Realizowac zdolnosc „%s” w sposob, ktory zostawia dane po stronie '
                  'uzytkownika i nie przekracza granicy wyrobu.' % v['nazwa'].lower()),
     'problem': o.get('problem', 'Bez tej funkcji zdolnosc modulu %s jest niekompletna, '
                      'a dane pozostaja rozproszone miedzy zrodlami.' % v['modul']),
     'uzytkownik': 'Waga dla uzytkownika: %s. Waga dla ekosystemu: %s. %s'
                   % (v['waga_user'], v['waga_eko'],
                      'Funkcja rdzeniowa produktow: ' + ', '.join(PRODUKT_FUNKCJI[kod])
                      if kod in PRODUKT_FUNKCJI else 'Funkcja wspierajaca.'),
     'opis': o.get('opis', v['granica'] if v['granica'] != '—' else
                   'Zdolnosc modulu %s w klasie komponentu %s (%s).'
                   % (v['modul'], kk, v['klasa_komp_nazwa'])),
     'input': _INPUT.get(kk, 'dane wejsciowe wlasciwe dla klasy komponentu %s' % kk),
     'output': _OUTPUT.get(kk, 'wynik zapisany w modelu kanonicznym z proweniencja'),
     'przebieg': o.get('przebieg', 'Uzytkownik uruchamia funkcje z glownego widoku modulu %s; '
                       'wynik zapisuje sie w historii i jest dostepny do eksportu.' % v['modul']),
     'integracje': '%s. Wspierajace klasy: %s.' % (v['dostawca_start'], v['wspierajace']),
     'api': 'Interfejs wewnetrzny ekosystemu; na zewnatrz przez brame API z uwierzytelnieniem '
            'i zakresem zgody. Format wymiany: model kanoniczny oparty na FHIR R4.',
     'dane': 'Sklada sie z: %s. Retencja i polityka usuniecia zgodne z decyzja uzytkownika; '
             'eksport bezplatny i zawsze dostepny.' % v['skladowe'],
     'uprawnienia': 'Wlasny dostep uzytkownika; udostepnienie czasowe linkiem wygasajacym; '
                    'dostep opiekunczy z automatycznym wygaszeniem w osiemnaste urodziny; '
                    'dostep ratunkowy bez zgody w stanie naglym, z pelnym logiem '
                    'i powiadomieniem po fakcie.',
     'bezpieczenstwo': _bezpieczenstwo(v),
     'regulacje': _regulacje(v),
     'medical': v['medical_device'],
     'medical_uzas': v['warstwa_reg'],
     'kryteria': _kryteria(v),
     'priorytet': _priorytet(v),
     'status': _status(v),
     'owner': _owner(v),
     # warstwa rozszerzona
     'monetyzacja': o.get('monetyzacja', v['kanal']),
     'efekt': _OUTPUT.get(kk, 'wynik zapisany w modelu kanonicznym'),
     'widzi_user': 'wynik funkcji bez oceny, progu i zalecenia' if v['warstwa'] == 'A'
                   else 'wynik wraz z oznaczeniem producenta i wersji wyrobu',
     'widzimy_my': 'wersja adaptera, kolejka zadan, konflikty miedzy zrodlami, pewnosc per pole, '
                   'ktora regula sie wyzwolila i ile razy zostala zignorowana',
     'komponenty': '%s — %s' % (kk, v['klasa_komp_nazwa']),
     'architektura': _architektura(v),
     'stack': _buildbuy(v),
     'etapy': 'Etap: %s. Certyfikacja: %s. %s'
              % (v['etap'], v['certyfikacja'], v['certyfikacja_co']),
     'kontrola': v['kontrola'],
     'med_wellness': '%s — %s' % (v['charakter'], v['warstwa_opis']),
     'modul': v['modul'],
     'samodzielnosc': ('dziala samodzielnie — jest czescia produktu %s'
                       % ', '.join(PRODUKT_FUNKCJI[kod]) if kod in PRODUKT_FUNKCJI
                       else 'dziala w ekosystemie, nie jako osobny produkt'),
     'czas_wyjscia': v['czas_wyjscia'],
     'zrodla': v['zrodla'],
    }


def wszystkie():
    return [karta(k) for k in sorted(R, key=lambda x: (R[x]['produkt'], R[x]['modul_kod'],
            [int(n) for n in x[1:].split('.') if n.isdigit()] or [0]))]


if __name__ == '__main__':
    K = wszystkie()
    print('kart:', len(K))
    print('rdzeniowych:', len(RDZEN), '| z trescia recznie pisana:', len(OVERRIDE))
    print('P0:', sum(1 for k in K if k['priorytet'] == 'P0'),
          '| P1:', sum(1 for k in K if k['priorytet'] == 'P1'),
          '| P2:', sum(1 for k in K if k['priorytet'] == 'P2'))
    print('wyrob medyczny TAK:', sum(1 for k in K if k['medical'] == 'TAK'))
