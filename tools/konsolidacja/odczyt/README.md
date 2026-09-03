# Odczyt korpusu — materiał źródłowy dokumentów wyjściowych

Katalog przechowuje wynik pełnego odczytu korpusu (159 plików, 28 618 387 znaków
surowo → 13 020 154 po deduplikacji) prowadzonego zgodnie z poleceniem:
*„cała treść z każdego pliku, następnie usuń duplikaty i powtarzającą się 1:1 treść"*.

| Plik | Zawartość |
|---|---|
| `USTALENIA_ODCZYT.md` | Dziennik ustaleń — wyłącznie treść nowa względem wcześniejszych fragmentów; powtórzenia odfiltrowane. Źródło danych dla `dane_*.py`. |
| `korpus_odczyt.tar.gz` | Strumień odczytu po deduplikacji: `rest/D001–D076`, po ok. 38 000 znaków. Pozwala wznowić odczyt bez ponownego przetwarzania korpusu. |

## Stan odczytu

**ZAKOŃCZONY.** Przeczytano i zalogowano cały strumień **D001–D076**.

### Dokumenty obowiązujące dla materiałów wyjściowych

| Zakres | Dokument obowiązujący | Zastępuje |
|---|---|---|
| Specyfikacja | #90 Master 3.1 (odniesienia do Master 4.1 w #122) | Master 3.0 (#148) |
| Funkcje App ze statusem | #95 + katalog granicy MDR (D074–D076) | karty #129, #148 |
| Rejestr funkcji ekosystemu | #51 — 299 funkcji / 42 moduły | wersje 265, 239, 309 |
| Liczby aplikacji | #83 — 160 funkcji / 23 moduły | „141", „161", „115", „169" |
| Biznesplan | #122 Biznesplan 4.0 | biznesplan 2.0 i 3.0 |
| Roadmapa | #116 Roadmapa Wykonawcza 2.0; zakres HTML wg #155 v5-SHORT | roadmapy v2–v5, etapy 7–11 |
| Klasy komponentów | #KARTY K01–K28 | tabele w #90 i #81 |
| Moduły techniczne | #134 — 16 modułów | — |

## Wykluczenie

Materiał dotyczący sterowania zachowaniem ludzi, wpływu na decyzje wyborcze,
oddziaływania podprogowego, chipa behawioralnego i niejawnego podawania
nanotechnologii pozostaje poza zakresem opracowania. Pliki #141–#143 oraz części
#137 i #130 odnotowano wyłącznie jako notę wykluczeniową — nie były opracowywane
merytorycznie. Wykluczone epiki: 7.A.CHIP, 7.A.POL, 7.B.PROP, 7.A.AI, 7.F.EXP,
8.A.GOV, 8.A.GOV2, 8.D.LEG, 9.A.CON, 11.A.DIG, 11.A.FIN.
