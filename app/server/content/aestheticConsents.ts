import crypto from 'node:crypto';

/**
 * Wzory zgód pisemnych i zaleceń po zabiegu — profil „Medycyna estetyczna”.
 *
 * To PROJEKTY do przeglądu: placówka zatwierdza każdy wzór (lekarz z numerem prawa wykonywania zawodu), a zatwierdzenie
 * jest związane z wersją i skrótem treści — zmiana tekstu wymaga ponownego zatwierdzenia. Treść jest ogólna; lekarz
 * omawia z pacjentem ryzyka właściwe dla preparatu (zgodnie z charakterystyką produktu leczniczego albo instrukcją
 * używania wyrobu) i dla pacjenta.
 *
 * Forma pisemna: zgoda na zabieg o podwyższonym ryzyku wymaga podpisu odręcznego albo kwalifikowanego podpisu
 * elektronicznego. Aplikacja drukuje wzór do podpisu i przechowuje skan; pacjent może przeczytać treść wcześniej,
 * ale potwierdzenie przeczytania w aplikacji NIE jest zgodą w formie pisemnej.
 */

export interface ConsentTemplate {
  id: 'toksyna' | 'wypelniacz' | 'biostymulator' | 'mezoterapia';
  version: string;
  title: string;
  sections: { heading: string; text: string[] }[];
  aftercare: string[];
}

const STATEMENTS = [
  'Lekarz wyjaśnił mi cel, przebieg i spodziewany efekt zabiegu, możliwe działania niepożądane i powikłania, przeciwwskazania oraz inne dostępne metody, w tym rezygnację z zabiegu.',
  'Miałem(-am) możliwość zadawania pytań i otrzymałem(-am) zrozumiałe odpowiedzi.',
  'Przekazałem(-am) prawdziwe informacje o stanie zdrowia, przyjmowanych lekach, uczuleniach, ciąży i wcześniejszych zabiegach.',
  'Wiem, że efekt zabiegu zależy od indywidualnych cech organizmu i nie może być zagwarantowany.',
  'Wiem, że mogę wycofać zgodę do chwili rozpoczęcia zabiegu.',
];

const ALARM_FILLER = 'Natychmiast skontaktuj się z gabinetem, a poza godzinami pracy dzwoń pod 112, jeśli pojawi się nasilający się ból, bladość, sinienie lub plamiste przebarwienie skóry w okolicy zabiegu albo jakiekolwiek zaburzenia widzenia.';

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
  {
    id: 'toksyna',
    version: 'zgoda-toksyna/2026-11-1',
    title: 'Zgoda na zabieg z użyciem toksyny botulinowej typu A',
    sections: [
      {
        heading: 'Na czym polega zabieg',
        text: [
          'Lekarz wstrzykuje niewielkie dawki toksyny botulinowej typu A (lek wydawany na receptę) w wybrane mięśnie, aby czasowo osłabić ich skurcz.',
          'Efekt pojawia się zwykle po kilku dniach (do 2 tygodni) i stopniowo przemija, najczęściej po 3–6 miesiącach.',
        ],
      },
      {
        heading: 'Możliwe działania niepożądane',
        text: [
          'Często: ból, zaczerwienienie, obrzęk lub zasinienie w miejscu wkłucia, ból głowy.',
          'Niekiedy: przejściowe opadnięcie powieki lub brwi, asymetria, uczucie ciężkości, osłabienie sąsiednich mięśni.',
          'Rzadko: reakcja alergiczna. Bardzo rzadko objawy ogólne, np. osłabienie mięśni, trudności w połykaniu, mówieniu lub oddychaniu — wymagają pilnej pomocy lekarskiej (112).',
        ],
      },
      {
        heading: 'Przeciwwskazania, które omawia lekarz',
        text: ['Ciąża i karmienie piersią, choroby nerwowo-mięśniowe (np. miastenia), stan zapalny w miejscu podania, uczulenie na składniki preparatu, niektóre leki (lekarz pyta o wszystkie przyjmowane leki).'],
      },
      { heading: 'Oświadczenia pacjenta', text: STATEMENTS },
    ],
    aftercare: [
      'Przez 4 godziny nie kładź się i nie masuj okolicy zabiegu.',
      'Przez 24 godziny unikaj intensywnego wysiłku, sauny, solarium i alkoholu.',
      'Pełny efekt oceniamy na wizycie kontrolnej po ok. 2 tygodniach.',
      'Pilnie zgłoś się do lekarza (a w nagłych przypadkach dzwoń 112), jeśli pojawią się trudności w połykaniu, mówieniu, oddychaniu lub nasilone osłabienie mięśni.',
    ],
  },
  {
    id: 'wypelniacz',
    version: 'zgoda-wypelniacz/2026-11-1',
    title: 'Zgoda na zabieg z użyciem wypełniacza z kwasem hialuronowym',
    sections: [
      {
        heading: 'Na czym polega zabieg',
        text: [
          'Lekarz podaje igłą lub kaniulą żel kwasu hialuronowego (wyrób medyczny), aby uzupełnić objętość lub wymodelować wybraną okolicę.',
          'Efekt jest widoczny od razu; utrzymuje się zwykle od kilku do kilkunastu miesięcy, zależnie od preparatu, okolicy i organizmu. Kwas hialuronowy można w razie potrzeby rozpuścić enzymem (hialuronidazą).',
        ],
      },
      {
        heading: 'Możliwe działania niepożądane i powikłania',
        text: [
          'Często: obrzęk, zasinienie, ból, zaczerwienienie, tkliwość, wyczuwalne grudki, przejściowa asymetria.',
          'Rzadko: zakażenie, reakcja zapalna lub guzki zapalne (także po dłuższym czasie), przemieszczenie preparatu, nasilenie opryszczki.',
          'Bardzo rzadko: powikłanie naczyniowe (zamknięcie naczynia przez preparat), które może prowadzić do martwicy skóry, a w okolicy twarzy wyjątkowo do zaburzeń lub utraty widzenia. Wymaga natychmiastowego postępowania.',
        ],
      },
      {
        heading: 'Przeciwwskazania, które omawia lekarz',
        text: ['Ciąża i karmienie piersią, zakażenie lub opryszczka w okolicy zabiegu, niektóre choroby autoimmunologiczne, skłonność do bliznowców, uczulenie na składniki preparatu (np. lidokainę), wcześniejsze wypełniacze nieznanego rodzaju w tej okolicy.'],
      },
      { heading: 'Oświadczenia pacjenta', text: STATEMENTS },
    ],
    aftercare: [
      'Przez 24–48 godzin unikaj makijażu w miejscu wkłuć, sauny, solarium, intensywnego wysiłku i masowania okolicy.',
      'Na obrzęk możesz stosować chłodne okłady przez cienki materiał.',
      'Wizyta kontrolna po ok. 2 tygodniach.',
      ALARM_FILLER,
    ],
  },
  {
    id: 'biostymulator',
    version: 'zgoda-biostymulator/2026-11-1',
    title: 'Zgoda na zabieg z użyciem stymulatora tkankowego',
    sections: [
      {
        heading: 'Na czym polega zabieg',
        text: [
          'Lekarz podaje preparat pobudzający tkanki do odbudowy (np. na bazie hydroksyapatytu wapnia, kwasu polimlekowego lub polinukleotydów).',
          'Efekt narasta stopniowo przez kilka tygodni; zabieg bywa wykonywany w serii.',
        ],
      },
      {
        heading: 'Możliwe działania niepożądane i powikłania',
        text: [
          'Często: obrzęk, zasinienie, ból i zaczerwienienie w miejscu podania.',
          'Niekiedy: grudki lub guzki, także pojawiające się po czasie.',
          'Rzadko: zakażenie, reakcja zapalna, powikłanie naczyniowe.',
        ],
      },
      { heading: 'Przeciwwskazania, które omawia lekarz', text: ['Ciąża i karmienie piersią, stan zapalny w okolicy zabiegu, niektóre choroby autoimmunologiczne, skłonność do bliznowców, uczulenie na składniki preparatu.'] },
      { heading: 'Oświadczenia pacjenta', text: STATEMENTS },
    ],
    aftercare: [
      'Stosuj się do zaleceń lekarza dotyczących masażu okolicy — przy niektórych preparatach jest zalecany, przy innych nie.',
      'Przez 24–48 godzin unikaj sauny, solarium i intensywnego wysiłku.',
      ALARM_FILLER,
    ],
  },
  {
    id: 'mezoterapia',
    version: 'zgoda-mezoterapia/2026-11-1',
    title: 'Zgoda na zabieg mezoterapii igłowej',
    sections: [
      {
        heading: 'Na czym polega zabieg',
        text: ['Lekarz wykonuje serię płytkich wkłuć, podając preparat (np. niesieciowany kwas hialuronowy, witaminy, aminokwasy). Zabieg zwykle wykonuje się w serii.'],
      },
      {
        heading: 'Możliwe działania niepożądane',
        text: ['Często: zaczerwienienie, drobne grudki i zasinienia w miejscach wkłuć, utrzymujące się zwykle 1–3 dni.', 'Rzadko: zakażenie, reakcja alergiczna, nasilenie opryszczki.'],
      },
      { heading: 'Przeciwwskazania, które omawia lekarz', text: ['Ciąża i karmienie piersią, stan zapalny lub zakażenie skóry w okolicy zabiegu, uczulenie na składniki preparatu.'] },
      { heading: 'Oświadczenia pacjenta', text: STATEMENTS },
    ],
    aftercare: ['Przez 24 godziny nie stosuj makijażu w okolicy zabiegu i nie dotykaj jej bez potrzeby.', 'Przez 48 godzin unikaj sauny, basenu i solarium.', 'Pilnie skontaktuj się z gabinetem, jeśli zaczerwienienie lub ból narastają po 2–3 dniach.'],
  },
];

export function consentTemplate(id: string): ConsentTemplate | undefined {
  return CONSENT_TEMPLATES.find((t) => t.id === id);
}

export function consentHash(t: ConsentTemplate): string {
  return crypto.createHash('sha256').update(JSON.stringify(t)).digest('hex').slice(0, 16);
}

/** Zgoda na utrwalanie i rozpowszechnianie wizerunku — dwa niezależne zakresy, drugi domyślnie wyłączony. */
export const IMAGE_CONSENT_TEXT = {
  documentation:
    'Zgoda na wykonywanie zdjęć okolicy zabiegu przed zabiegiem i po nim jako części dokumentacji medycznej. Zdjęcia są przechowywane jak dokumentacja medyczna i nie są analizowane automatycznie.',
  marketing:
    'Zgoda na wykorzystanie moich zdjęć w materiałach informacyjnych placówki. Ta zgoda jest dobrowolna, niezależna od zabiegu i mogę ją w każdej chwili wycofać w aplikacji.',
};
