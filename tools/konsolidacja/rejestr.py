# -*- coding: utf-8 -*-
"""Jedno zrodlo prawdy o funkcjach — scalenie MACIERZ + KOMPONENTY + FUNKCJE.

Rejestr ma 337 pozycji. Kazda ma komplet pol potrzebnych do karty funkcji
i do skladania produktow. Rozbieznosci miedzy zrodlami rozstrzygane
w kolejnosci: KOMPONENTY (warstwa, klasa komponentu, build/buy) >
MACIERZ (produkt, modul, kanal, waznosc) > FUNKCJE (etap, klasa MDR).
"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_M = {x['kod']: x for x in json.load(open('build/MACIERZ.json'))}
_K = {x['kod']: x for x in json.load(open('build/KOMPONENTY.json'))}
_F = json.load(open('build/FUNKCJE.json'))

# warstwa -> co to znaczy regulacyjnie
WARSTWA = {
    'A': ('poza rezimem wyrobu', 'Zbiera, przechowuje, pokazuje wlasne dane. Fakt i porownanie '
          'do wlasnej historii.'),
    'B': ('poza rezimem wyrobu, inny rezim', 'Dokumentacja, teleporada, integracja z P1. '
          'Wymaga statusu podmiotu leczniczego albo umowy powierzenia, nie dossier.'),
    'C': ('wyrob medyczny MDSW', 'Ocena, prog, zalecenie, predykcja. Wymaga dossier, '
          'PRRC i jednostki notyfikowanej.'),
}

PRIORYTET = {'MVP': 'P0', 'MLP': 'P1', 'FINAL': 'P2', 'SCI-FI': 'P2', 'n/d': 'P2'}


def _clean(v, default='—'):
    v = str(v).strip() if v not in (None, '') else ''
    return v if v else default


def zbuduj():
    R = {}
    for kod, m in _M.items():
        k = _K.get(kod, {})
        f = _F.get(m['nazwa'], {})
        warstwa = k.get('warstwa') or ''
        R[kod] = {
            'kod': kod,
            'nazwa': m['nazwa'],
            'produkt': m['produkt'],
            'modul': m['modul'],
            'modul_kod': k.get('modul') or m['modul'].split()[0],
            'etap': m['etap'],
            'priorytet': PRIORYTET.get(m['etap'], 'P2'),
            'klasa_mdr': m['klasa'] if m['klasa'] != 'n/d' else '—',
            'warstwa': warstwa,
            'warstwa_opis': WARSTWA.get(warstwa, ('—', '—'))[0],
            'warstwa_reg': WARSTWA.get(warstwa, ('—', '—'))[1],
            'medical_device': 'TAK' if warstwa == 'C' else 'NIE',
            'charakter': _clean(k.get('charakter')),
            'granica': _clean(k.get('granica')),
            'kanal': _clean(m['kanal'], 'brak wlasnego kanalu — funkcja fundamentowa'),
            'zarabia': m['zarabia'],
            'waga_user': m['uzytkownik'],
            'waga_eko': m['ekosystem'],
            'klasa_komp': _clean(k.get('klasa')),
            'klasa_komp_nazwa': _clean(k.get('klasa_nazwa')),
            'wspierajace': _clean(k.get('wspierajace')),
            'wariant_a': _clean(k.get('wariant_a')),
            'wariant_b': _clean(k.get('wariant_b')),
            'wariant_c': _clean(k.get('wariant_c')),
            'dostawca_start': _clean(k.get('dostawca_start')),
            'prog_zmiany': _clean(k.get('prog_zmiany')),
            'czas_wyjscia': _clean(k.get('czas_wyjscia')),
            'kontrola': _clean(k.get('kontrola')),
            'certyfikacja': _clean(k.get('certyfikacja')),
            'certyfikacja_co': _clean(k.get('certyfikacja_co')),
            'szczebel': _clean(k.get('szczebel_nazwa') or k.get('szczebel')),
            'skladowe': _clean(k.get('skladowe')),
            'dup_z': _clean(m.get('dup_z'), ''),
            'dup_opis': _clean(m.get('dup_opis'), ''),
            'zrodla': m.get('zrodla', ''),
            'n_zrodel': m.get('n_zrodel', 0),
        }
    return R


R = zbuduj()


def stat():
    return {
        'funkcji': len(R),
        'produkty': collections.Counter(v['produkt'] for v in R.values()),
        'warstwy': collections.Counter(v['warstwa'] for v in R.values()),
        'etapy': collections.Counter(v['etap'] for v in R.values()),
        'medical': collections.Counter(v['medical_device'] for v in R.values()),
        'duplikaty': sum(1 for v in R.values() if v['dup_z']),
        'klasy_komp': len(set(v['klasa_komp'] for v in R.values())),
    }


if __name__ == '__main__':
    s = stat()
    print('funkcji w rejestrze:', s['funkcji'])
    print('produkty:', dict(s['produkty']))
    print('warstwy:', dict(s['warstwy']))
    print('etapy:', dict(s['etapy']))
    print('wyrob medyczny:', dict(s['medical']))
    print('pozycje ze wskazanym duplikatem:', s['duplikaty'])
    print('klas komponentow:', s['klasy_komp'])
    braki = [k for k, v in R.items() if v['warstwa'] == '']
    print('bez warstwy:', len(braki), braki[:5])
