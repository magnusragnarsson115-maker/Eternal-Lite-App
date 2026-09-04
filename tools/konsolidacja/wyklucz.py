# -*- coding: utf-8 -*-
"""Filtr warstwy wylaczonej z dokumentacji.

Podstawa: Specyfikacja Master 5.4 sekcja 38 wylacza z dokumentacji warstwe
sterowania zachowaniem ludzi, wplywu na decyzje wyborcze, oddzialywania
podprogowego, masowej implantacji i niejawnego podawania nanotechnologii.
Ta sama granica jest zapisana niezaleznie w #145 (etapy 7-11 oznaczone
[FIKCJA]), w #150 ("motywy dystopijne, konflikty fabularne i ostrzezenia —
to nie sa realne instrukcje wdrozeniowe") oraz w Planie PWNS, ktory tych
punktow swiadomie nie zoperacjonalizowal ("nie da sie zbudowac dla nich
budzetu, listy partnerow i harmonogramu, bo to nie jest plan firmy").

Zasada filtra: usuwamy tresc, ktora te warstwe ROZWIJA — zadania, kampanie,
budzety, harmonogramy. Zachowujemy tresc, ktora ja NAZYWA I WYKLUCZA, bo to
jest zapis granicy i musi zostac widoczny.
"""
import re

# Pliki w calosci poswiecone warstwie wylaczonej — nie wchodza do dokumentow.
PLIKI = {
    141: "Plan Wladzy Nad Swiatem — etapy 7-11 + moonshoty (DeepSeek 5d6d38)",
    142: "Plan Wladzy Nad Swiatem — etapy 7-11, pelna struktura zadan (DeepSeek 5f7054)",
}

# Epiki wylaczone — nazwane, zeby nie wrocily przez pomylke.
EPIKI = [
    ("7.A.CHIP", "masowa implantacja jako standard zdrowotny"),
    ("7.A.POL", "partia IMPERIUM — infrastruktura polityczna i propagandowa"),
    ("7.B.PROP", "kampania „Chipowanie — nowy standard zdrowotny”"),
    ("7.A.AI", "centralny system kontroli AI"),
    ("7.F.EXP", "strategia przejmowania wladzy"),
    ("8.A.GOV", "globalny system zarzadzania"),
    ("8.A.GOV2", "system zarzadzania regionami i gubernatorami"),
    ("8.D.LEG", "globalne prawo i nacjonalizacja"),
    ("9.A.CON", "transfer swiadomosci — skanowanie i digitalizacja mozgu"),
    ("11.A.DIG", "cyfrowa tozsamosc i globalny system kontroli"),
    ("11.A.FIN", "globalny system finansowy bez pieniedzy"),
]

# Legalne odpowiedniki wskazane w samym korpusie (Plan PWNS).
ODPOWIEDNIKI = [
    ["Warstwa wylaczona", "Legalny odpowiednik przyjety w dokumentacji"],
    ["masowa implantacja jako standard",
     "implanty jako dobrowolne wyroby klasy III, wylacznie odczyt, z wylacznikiem sprzetowym"],
    ["centralny system kontroli AI",
     "AI jako wsparcie decyzji lekarza — human-in-the-loop, MDR klasa IIa"],
    ["infrastruktura polityczna i propagandowa",
     "public affairs i udzial w gremiach standaryzacyjnych zamiast lobbingu wplywow"],
    ["nadzor nad ludzmi w domu",
     "robotyka opiekuncza z radarem mmWave zamiast kamery"],
    ["koncentracja wladzy nad technologia",
     "Fundacja z wetem misyjnym jako gwarant misji, z obowiazkiem statutowym"],
]

_ROZWIJA = re.compile(
    r'propagand\w*\s+imperium|konstytucj\w*\s+imperium|parti[aię]\w*\s+IMPERIUM'
    r'|kampani\w*\s+.{0,30}IMPERIUM|Imperium\s+Eternal'
    r'|W[łl]adz[ay]\s+Nad\s+[ŚS]wiatem'
    r'|zachipowan|chipowanie\s+dla\s+zdrowia|Chipowanie\s+[—-]\s+nowy\s+standard'
    r'|przej[ąa][ćc]\s+zasoby|nadzor\w*\s+nad\s+masami|opor\w*\s+spo[łl]eczn'
    r'|globalny\s+system\s+kontroli|kontrol\w*\s+populacji'
    r'|kontrol\w*\s+nad\s+ludzko[śs]ci', re.I)

_NAZYWA_I_WYKLUCZA = re.compile(
    r'wy[łl][aą]cz|wykluczo|skre[śs]l|usuni[eę]t|ODMOWA|NIEWYKONALN|WYKONALNY'
    r'|nie\s+przekrocz|nie\s+operacjonaliz|nie\s+zosta[łl]y\s+zoperacjonaliz'
    r'|\[FIKCJA\]|fikcj|worldbuilding|przestrog|ostrze[żz]|motyw\w*\s+dystopij'
    r'|poza\s+zakres|nie\s+jest\s+planem|nie\s+s[aą]\s+realne|sekcj[ai]\s+38|§\s*38'
    r'|granic\w*|=====|Dobrowolno[śs][ćc]|Mechanizm|Rozbie[żz]no[śs]|Sprzeczno[śs]'
    r'|weterynar|ISO\s*11784|CVMP|ps[oó]w|zwierz|w\s+napi[eę]ciu|rozstrzyga|arytmetyk|wykonaln|SCI-FI|STRATEGICZNY|DS-A|DS-B|DS-C|PWNS|E7-11|w\s+nawiasie|wa[żz]niejsz|powie[śs]ci|literack|ruch\s+ideow', re.I)


def blok_wypada(txt):
    """True, jezeli blok rozwija warstwe wylaczona i jej nie nazywa jako wylaczonej."""
    t = str(txt)
    return bool(_ROZWIJA.search(t)) and not _NAZYWA_I_WYKLUCZA.search(t)


def filtruj(PARTS):
    """Zwraca (PARTS po filtrze, statystyka)."""
    out, stat = {}, {'pliki': [], 'bloki': 0}
    for i, (st, rola, bl) in PARTS.items():
        if i in PLIKI:
            stat['pliki'].append(i)
            continue
        keep = [b for b in bl if not blok_wypada(b[2])]
        stat['bloki'] += len(bl) - len(keep)
        out[i] = (st, rola, keep)
    return out, stat
