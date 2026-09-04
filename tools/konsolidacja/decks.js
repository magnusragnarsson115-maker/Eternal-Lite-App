const pptxgen = require('pptxgenjs');

// ---- Paleta z logo Eternal Life: rdzawa pomarancz + granat ----
const RDZA = 'A1370E', RDZA_J = 'C9552A';   // rdza z logo
const GRANAT = '003071', GRANAT_C = '00224F';  // granat z logo
const ATRAMENT = '0E1B33', SZARY = '5A6B87';
const BIALY = 'FFFFFF', KOSC = 'FAF8F5', LINIA = 'E6E2DC';
const BURSZTYN = 'B07419';
const HF = 'Cambria', BF = 'Calibri';
const path = require('path');
const LOGO = path.join(__dirname, 'assets', 'eternal_logo.png');
const LOGO_D = path.join(__dirname, 'assets', 'eternal_logo_dark.png');
const WWW = 'eternallife24.pages.dev';
const MAIL = 'office.eternal.life@gmail.com';
const TEL = '+48 784 407 991';

// ---- Zrodla zewnetrzne (research, nie indeks archiwum) ----
const Z = {
  gvr: 'Grand View Research — Digital Health Market Report (raport branżowy; liczby globalne nie są podstawą naszej wyceny rynku)',
  mnm: 'MarketsandMarkets — Digital Health Market 2025-2030 (raport branżowy)',
  prec: 'Precedence Research — Digital Health Market do 2035',
  diga: 'BfArM — Digital Health Applications (DiGA): wymogi wpisu i refundacji',
  mdr: 'Rozporządzenie MDR (UE) 2017/745 — wyroby medyczne',
  mdcg: 'MDCG 2019-11 — kwalifikacja i klasyfikacja oprogramowania medycznego',
  rodo: 'RODO (UE) 2016/679 — art. 9 dane zdrowotne, art. 22 profilowanie, art. 17 usunięcie',
  aiact: 'AI Act (UE) 2024/1689 — załącznik III, systemy wysokiego ryzyka',
  ehds: 'EHDS (UE) 2025/327 — Europejska Przestrzeń Danych Zdrowotnych',
  fhir: 'HL7 FHIR — standard wymiany danych medycznych',
  iso: 'ISO 10993 — ocena biologiczna wyrobów medycznych',
  agpl: 'GNU AGPL-3.0 — licencja biblioteki Gadgetbridge',
  terra: 'Terra API — agregacja danych z urządzeń noszonych',
  p1: 'Centrum e-Zdrowia — Platforma P1 i Internetowe Konto Pacjenta',
  itaka: 'Centrum Wsparcia 116 123 — Fundacja ITAKA',
  nis2: 'Dyrektywa NIS2 (UE) 2022/2555 i ustawa o KSC',
  nfz: 'Wydatki publiczne na zdrowie 2026: 247,8 mld zł (6,81% PKB); luka finansowa 23 mld zł, prognoza 2040 — 171 mld zł',
  prof: 'Wydatki na profilaktykę w Polsce: 21,6 EUR na mieszkańca wobec 202 EUR średniej unijnej',
  eehrxf: 'EEHRxF — obowiązek CE dla systemów dokumentacji medycznej od 26.03.2029, kategoria druga od 26.03.2031',
  bp41: 'Biznesplan 4.0 i Plan Korporacyjny 5.1 — ustalenia po pełnym odczycie korpusu (159 plików, 28,6 mln znaków)',
  rej:  'Rejestr funkcji Eternal — 337 pozycji ze scalenia macierzy monetyzacji, komponentów i rejestru funkcji (ETERNAL_REJESTR_FUNKCJI.xlsx)',
  spec: 'Specyfikacja Master 5.4 FINAL — kanon techniczny, katalog granicy MDR na 183 kartach funkcji',
  kart: 'Karty funkcji Eternal — 337 kart w szablonie osiemnastopolowym (ETERNAL_KARTY_FUNKCJI.docx)',
  road: 'Roadmapa Wykonawcza 2.0 — pięć torów, kalendarz twardych dat, horyzonty 0–4',
  prod: 'Analiza produktowa Eternal — sześć produktów po 5–6 funkcji z korelacji rejestru',
  komp: 'Katalog klas komponentów K01–K28 — wariant A/B/C, próg wyjścia, mechanizm kontroli',
  cez:  'Centrum e-Zdrowia — e-Profil Pacjenta, RPWDL 2.0, certyfikat integracji (bezpłatny, ważność 2 lata)',
  pcbc: 'PCBC — cennik oceny dokumentacji technicznej MDR; Komisja Europejska — koszt oceny klinicznej',
  gus:  'Wydatki publiczne na zdrowie 2026: 247,8 mld zł (6,81% PKB); luka 23 mld zł, prognoza 2040 — 171 mld zł',
  hosp: 'Hospitalizacje możliwe do uniknięcia 8–10 mld zł rocznie; dublowanie badań 6–8 mld zł rocznie',
  neko: 'Neko Health — benchmark produktowy: skan ok. 60 min, £299, ponad 350 tys. osób na liście oczekujących',
  forw: 'Forward Health — 657 mln USD kapitału, zamknięcie działalności 13 listopada 2024',
  luna: 'LunaDNA (zamknięta 31.01.2024) i Nebula (przekształcona w 2025) — upadek kategorii sprzedaży danych',
  m42:  'M42 (Abu Zabi) oraz Ping An, Alibaba Health i JD Health — najbliżej pełnego ekosystemu',
  pwns: 'Warstwa operacyjna planu — 188 punktów z narzędziami, czasem, odpowiedzialnością, partnerami i kosztami w cenach rynkowych PL 2026',
};

function mk(title) {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'Eternal Life';
  p.company = 'Eternal Life';
  p.title = title;
  p.defineSlideMaster({
    title: 'JASNY', background: { color: KOSC },
    objects: [
      { image: { path: LOGO, x: 0.55, y: 0.24, w: 1.62, h: 1.03 * 0.62 } },
      { text: { text: WWW, options: { x: 9.9, y: 0.29, w: 2.85, h: 0.36, align: 'right', valign: 'middle',
        fontSize: 9.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true } } },
    ],
  });
  p.defineSlideMaster({
    title: 'CIEMNY', background: { color: GRANAT },
    objects: [
      { image: { path: LOGO_D, x: 0.55, y: 0.24, w: 1.62, h: 1.03 * 0.62 } },
      { text: { text: WWW, options: { x: 9.9, y: 0.29, w: 2.85, h: 0.36, align: 'right', valign: 'middle',
        fontSize: 9.5, color: '9FB2D8', fontFace: BF, margin: 0, isTextBox: true } } },
    ],
  });
  return p;
}

let NUM = 0, TOT = 0;
function slide(p, dark) {
  NUM++;
  const s = p.addSlide({ masterName: dark ? 'CIEMNY' : 'JASNY' });
  s.addText(`ETERNAL LIFE   ·   ${String(NUM).padStart(2, '0')} / ${String(TOT).padStart(2, '0')}`,
    { x: 0.55, y: 7.02, w: 6, h: 0.28, fontSize: 8.5, color: dark ? '7B90B8' : SZARY,
      fontFace: BF, charSpacing: 1.2, margin: 0, isTextBox: true });
  return s;
}

// naglowek + linia "struktura danych" pod tytulem
function head(s, kick, title, struktura, dark) {
  s.addText(kick.toUpperCase(), { x: 0.55, y: 0.85, w: 11.9, h: 0.24, fontSize: 10.5, bold: true,
    color: dark ? RDZA_J : RDZA, charSpacing: 1.8, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(title, { x: 0.55, y: 1.1, w: 12.2, h: 0.72, fontSize: 31, bold: true,
    color: dark ? BIALY : GRANAT, fontFace: HF, margin: 0, isTextBox: true });
  if (struktura) {
    s.addText([{ text: 'Struktura danych:  ', options: { bold: true, color: dark ? RDZA_J : RDZA } },
               { text: struktura, options: { color: dark ? '9FB2D8' : SZARY } }],
      { x: 0.55, y: 1.84, w: 12.2, h: 0.3, fontSize: 10.5, fontFace: BF, margin: 0, isTextBox: true });
  }
}

// zrodla na dole slajdu
function src(s, keys, dark) {
  if (!keys || !keys.length) return;
  const txt = keys.map(k => '• ' + Z[k]).join('\n');
  const h = 0.20 + keys.length * 0.17;
  s.addShape('rect', { x: 0.55, y: 7.0 - h, w: 12.2, h: h, fill: { color: dark ? GRANAT_C : 'F2EFE9' },
    line: { color: dark ? '2B4270' : LINIA, width: 0.5 } });
  s.addText('ŹRÓDŁA', { x: 0.72, y: 7.04 - h, w: 2, h: 0.16, fontSize: 7.5, bold: true,
    color: dark ? '7B90B8' : SZARY, charSpacing: 1.2, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(txt, { x: 0.72, y: 7.19 - h, w: 11.85, h: h - 0.22, fontSize: 8,
    color: dark ? 'A9BCD8' : SZARY, fontFace: BF, margin: 0, isTextBox: true, lineSpacing: 11 });
}

function cards(s, items, y, cols, dark) {
  cols = cols || items.length;
  const gap = 0.26, w = (12.2 - gap * (cols - 1)) / cols;
  items.forEach((it, i) => {
    const cx = 0.55 + (i % cols) * (w + gap);
    const cy = y + Math.floor(i / cols) * 1.92;
    s.addShape('roundRect', { x: cx, y: cy, w: w, h: 1.72,
      fill: { color: dark ? '24406E' : BIALY }, line: { color: dark ? '35538A' : LINIA, width: 1 }, rectRadius: 0.07 });
    s.addText(it[0], { x: cx + 0.2, y: cy + 0.15, w: w - 0.4, h: 0.38, fontSize: 13.5, bold: true,
      color: dark ? RDZA_J : RDZA, fontFace: BF, margin: 0, isTextBox: true });
    s.addText(it[1], { x: cx + 0.2, y: cy + 0.54, w: w - 0.4, h: 1.05, fontSize: 11,
      color: dark ? 'DBE6F5' : ATRAMENT, fontFace: BF, margin: 0, isTextBox: true, valign: 'top' });
  });
}

function kpis(s, items, y, dark) {
  const gap = 0.24, w = (12.2 - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const cx = 0.55 + i * (w + gap);
    s.addShape('roundRect', { x: cx, y: y, w: w, h: 1.05,
      fill: { color: dark ? '24406E' : BIALY }, line: { color: dark ? '35538A' : LINIA, width: 1 }, rectRadius: 0.07 });
    s.addText(it[0], { x: cx + 0.17, y: y + 0.12, w: w - 0.34, h: 0.45, fontSize: 21, bold: true,
      color: dark ? RDZA_J : GRANAT, fontFace: HF, margin: 0, isTextBox: true });
    s.addText(it[1], { x: cx + 0.17, y: y + 0.6, w: w - 0.34, h: 0.36, fontSize: 9.5,
      color: dark ? '9FB2D8' : SZARY, fontFace: BF, margin: 0, isTextBox: true });
  });
}

function table(s, head_, rows, y, colW, dark) {
  const body = [head_.map(h => ({ text: h, options: { bold: true, color: BIALY, fill: { color: GRANAT }, fontSize: 10 } }))];
  rows.forEach(r => body.push(r.map(c => ({ text: String(c),
    options: { color: dark ? 'DBE6F5' : ATRAMENT, fontSize: 9.5, fill: { color: dark ? '24406E' : BIALY } } }))));
  s.addTable(body, { x: 0.55, y: y, w: 12.2, colW: colW,
    border: { pt: 0.5, color: dark ? '35538A' : LINIA }, fontFace: BF, valign: 'top', autoPage: false });
}

function warn(s, txt, y) {
  s.addShape('roundRect', { x: 0.55, y: y, w: 12.2, h: 0.88, fill: { color: 'FDF6EA' },
    line: { color: 'EAD9B8', width: 1 }, rectRadius: 0.05 });
  s.addText([{ text: 'KOREKTA WOBEC KANONU WEWNĘTRZNEGO\n', options: { bold: true, color: BURSZTYN, fontSize: 8.5, charSpacing: 0.8 } },
             { text: txt, options: { color: '5C4A26', fontSize: 9.5 } }],
    { x: 0.75, y: y + 0.09, w: 11.8, h: 0.7, fontFace: BF, margin: 0, isTextBox: true });
}

function cover(p, kick, t1, t2, lead) {
  const s = slide(p, true);
  s.addText(kick.toUpperCase(), { x: 0.55, y: 1.9, w: 11.9, h: 0.3, fontSize: 11, bold: true,
    color: RDZA_J, charSpacing: 2.2, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(t1, { x: 0.55, y: 2.25, w: 11.6, h: 1.15, fontSize: 42, bold: true,
    color: BIALY, fontFace: HF, margin: 0, isTextBox: true });
  s.addText(t2, { x: 0.55, y: 3.42, w: 11.6, h: 0.45, fontSize: 18,
    color: RDZA_J, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(lead, { x: 0.55, y: 4.0, w: 9.4, h: 1.0, fontSize: 13.5,
    color: 'C9D6EA', fontFace: BF, margin: 0, isTextBox: true });
  s.addText(`Maksymilian Pruss — Założyciel i CEO\n${MAIL}   ·   ${TEL}   ·   ${WWW}`,
    { x: 0.55, y: 5.5, w: 9.4, h: 0.9, fontSize: 11, color: '9FB2D8', fontFace: BF, margin: 0, isTextBox: true });
  return s;
}

function team(s, y) {
  const Z2 = [
    ['Maksymilian Pruss', 'Założyciel i CEO', 'Architekt ekosystemu Health OS. Dwa lata R&D w trybie stealth, pełna specyfikacja techniczna, model biznesowy i strategia regulacyjna.'],
    ['Adrian Hołubcki', 'CTO', 'Lider technologiczny. Skalowanie systemów rozproszonych, architektura chmurowa, cyberbezpieczeństwo, nadzór nad developmentem.'],
    ['Wiktor Zawiślak', 'CMO — Chief Medical Officer', 'Wiarygodność kliniczna silnika Bio-Physics, zgodność kliniczna, nadzór nad triażem AI.'],
    ['Karol Tyszka', 'CAO — Chief Advisor Officer', 'Relacje inwestorskie, partnerstwa biznesowe, strategia kapitałowa.'],
  ];
  const gap = 0.26, w = (12.2 - gap * 3) / 4;
  Z2.forEach((z, i) => {
    const cx = 0.55 + i * (w + gap);
    s.addShape('roundRect', { x: cx, y: y, w: w, h: 2.15, fill: { color: BIALY }, line: { color: LINIA, width: 1 }, rectRadius: 0.07 });
    s.addText(z[0], { x: cx + 0.19, y: y + 0.15, w: w - 0.38, h: 0.34, fontSize: 13.5, bold: true, color: GRANAT, fontFace: HF, margin: 0, isTextBox: true });
    s.addText(z[1], { x: cx + 0.19, y: y + 0.49, w: w - 0.38, h: 0.28, fontSize: 9.5, color: RDZA, fontFace: BF, charSpacing: 0.4, margin: 0, isTextBox: true });
    s.addText(z[2], { x: cx + 0.19, y: y + 0.8, w: w - 0.38, h: 1.25, fontSize: 9.5, color: ATRAMENT, fontFace: BF, margin: 0, isTextBox: true });
  });
}

function kontakt(s) {
  cards(s, [
    ['Założyciel i CEO', 'Maksymilian Pruss\n' + MAIL],
    ['Telefon', TEL + '\nOdpowiadamy na zapytania inwestorskie w ciągu 24 godzin.'],
    ['Strona i siedziba', WWW + '\nWarszawa, Polska'],
  ], 2.6, 3, true);
  s.addText('Jesteśmy na etapie Pre-Seed i aktywnie poszukujemy partnerów strategicznych oraz inwestorów, którzy podzielają naszą wizję długowieczności.',
    { x: 0.55, y: 4.75, w: 12.2, h: 0.5, fontSize: 13, color: 'C9D6EA', fontFace: BF, margin: 0, isTextBox: true });
}

const MONET = [
  ['K0', 'Aplikacja pacjenta — DARMOWA', 'Zero opłat dla pacjenta. Warunek skali i jakości zbioru danych.'],
  ['K1', 'Subskrypcje niepacjenckie', 'Pet, Vault/Legacy, immersja premium — poza rdzeniem pacjenta.'],
  ['K2', 'Hardware i wkłady', 'Station: zakup 1 499 PLN lub HaaS 249 PLN/mies; wkłady 149 PLN/mies.'],
  ['K3', 'API i eksport danych', 'Płatny dostęp programistyczny; dane wyłącznie zagregowane i zanonimizowane.'],
  ['K4', 'Eternal Token i Forge', 'Gospodarka wewnętrzna marketplace modułów i IP.'],
  ['K5', 'Prowizje marketplace', 'Telemedycyna 20–30%, laboratoria 5–15%, apteka i suplementy.'],
  ['K6', 'Płatnicy i ubezpieczyciele', 'Scoring B2B, składka pay-as-you-live, programy prewencyjne.'],
  ['K7', 'Przychodnie i lekarze', 'Eternal Assist (AI Scribe) 99–199 PLN/mies za gabinet; PUPM 15–25 PLN.'],
  ['K8', 'Granty i dotacje', 'NCBR do 500 tys. bez wkładu własnego, PARP, FENG, Horizon Europe.'],
  ['K9', 'Licencjonowanie IP', 'Royalty 5–15% z Fundacji do spółki; white-label dla partnerów.'],
  ['K10', 'Fitness i wellness', 'Plany treningowe, suplementacja, Auto-Refill, corporate wellness.'],
  ['K11', 'Choroby przewlekłe', 'Pakiety dla diabetyków, kardiologii i zdrowia psychicznego.'],
];

// ============ DECK APLIKACJI — 14 slajdow wg nazw z oryginalnego decku ============
function deckApp() {
  NUM = 0; TOT = 14;
  const p = mk('Eternal App — pitch aplikacji');
  let s;

  // 1 ETERNAL — tytul
  cover(p, 'Pre-Seed · aplikacja Eternal', 'Eternal',
    'Zintegrowana platforma danych zdrowotnych',
    'Aplikacja zbiera rozproszoną historię medyczną w jedno miejsce i zamienia ją w dane, na których da się działać. Rozwiązujemy barierę ostatniej mili w analizie zdrowia — bez oceny, progu i zalecenia, czyli bez wchodzenia w reżim wyrobu medycznego na starcie.');

  // 2 OBECNE WYZWANIA — bariera ostatniej mili
  s = slide(p); head(s, 'Obecne wyzwania', 'Bariera ostatniej mili', 'bariera → mechanizm → skutek dla pacjenta');
  cards(s, [
    ['Martwe dane', 'Wyniki badań leżą w PDF-ach, skanach i zdjęciach. Dla algorytmu to obraz, nie dane. Bez struktury nie ma korelacji.'],
    ['Brak kontekstu', 'Opaska widzi słaby sen, ale nie widzi niskiej ferrytyny ukrytej w PDF sprzed ośmiu miesięcy. Dwa sygnały nigdy się nie spotykają.'],
    ['Brak działania', 'Pacjent dostaje informację, nie możliwość działania. Nie ma jednej osi czasu, nie ma raportu, z którym idzie się do lekarza.'],
  ], 2.3, 3);
  kpis(s, [
    ['247,8 mld zł', 'wydatki publiczne na zdrowie 2026 (6,81% PKB)'],
    ['23 mld zł', 'luka finansowa systemu, prognoza 2040 — 171 mld'],
    ['21,6 EUR', 'na profilaktykę na mieszkańca wobec 202 EUR w UE'],
    ['8–10 mld zł', 'hospitalizacje możliwe do uniknięcia rocznie'],
  ], 4.3);
  s.addText('System jest zaprojektowany do leczenia chorób, a nie do utrzymania zdrowia. Pieniądze idą na skutek, nie na przyczynę — a dane, które pozwoliłyby zawrócić, są rozproszone i nieczytelne dla maszyn.',
    { x: 0.55, y: 5.5, w: 12.2, h: 0.5, fontSize: 11, italic: true, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['gus', 'prof', 'hosp']);
  s.addNotes('Bariera ostatniej mili: dane istnieją, ale są nieczytelne dla maszyn i pozbawione kontekstu klinicznego.');

  // 3 NASZE ROZWIAZANIE — Eternal Core Intelligence
  s = slide(p); head(s, 'Nasze rozwiązanie', 'Eternal Core Intelligence', 'filar → co robi → reżim regulacyjny');
  cards(s, [
    ['Filar 1 — import uniwersalny', 'Skan dowolnego dokumentu medycznego i konwersja na dane strukturalne w standardzie FHIR R4B. Poza reżimem wyrobu.'],
    ['Filar 2 — synchronizacja', 'Jedno wejście do wiodących urządzeń noszonych: Apple, Garmin, Oura, Whoop, Fitbit. Poza reżimem wyrobu.'],
    ['Filar 3 — logika medyczna', 'Korelacja twardych wyników badań z miękkimi danymi behawioralnymi. Fakt i porównanie do własnej historii — nie ocena.'],
  ], 2.3, 3);
  kpis(s, [
    ['337', 'pozycji w rejestrze funkcji ekosystemu'],
    ['243 / 31 / 63', 'funkcji w warstwie A / B / C'],
    ['67', 'funkcji o priorytecie P0'],
    ['13', 'funkcji obowiązkowych w MVP'],
  ], 4.3);
  s.addText('Rejestr powstał ze scalenia macierzy monetyzacji, katalogu komponentów i rejestru funkcji po pełnym odczycie korpusu i usunięciu duplikatów. Warstwa A działa poza reżimem wyrobu medycznego, warstwa C wymaga certyfikacji — i dlatego jest odroczona, a nie pominięta.',
    { x: 0.55, y: 5.5, w: 12.2, h: 0.5, fontSize: 10, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['rej', 'spec', 'terra']);

  // 4 ARCHITEKTURA — pipeline danych
  s = slide(p); head(s, 'Architektura', 'Pipeline danych', 'warstwa → zakres techniczny → zasada');
  table(s, ['Warstwa', 'Zakres techniczny', 'Zasada'], [
    ['01 Ingestion', 'agregacja urządzeń noszonych · OCR dokumentów medycznych · import z e-Profilu Pacjenta', 'trzech dostawców, nie jeden'],
    ['02 Structuring', 'FHIR R4B · mapowanie SNOMED CT i LOINC · normalizacja jednostek', 'standard przed logiką'],
    ['03 Intelligence', 'RAG z guardrails i cytowaniem źródła · detekcja anomalii · Bio-Correlation', 'brak oceny i progu'],
    ['04 Presentation', 'oś czasu zdrowia · raport SBAR dla lekarza · eksport i usunięcie danych', 'wyjście zawsze możliwe'],
    ['05 Governance', 'log dostępu widoczny dla użytkownika · zgoda granularna per cel · tryb degradacji', 'wymóg i wyróżnik handlowy'],
  ], 2.3, [1.9, 7.6, 2.7]);
  s.addText('Decyzje zamknięte: Flutter i FastAPI, FHIR R4B, wektory na pgvector (odejście od Pinecone), modele językowe za adapterem, dane surowe pozostają na urządzeniu, hosting w Unii Europejskiej. Każda klasa komponentu K01–K28 ma wariant A, B i C oraz próg wyjścia — dostawca startowy nie jest zobowiązaniem na zawsze.',
    { x: 0.55, y: 4.85, w: 12.2, h: 0.7, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['fhir', 'komp', 'rodo']);

  // 5 CORE INTELLIGENCE — kluczowe funkcjonalnosci
  s = slide(p); head(s, 'Core Intelligence', 'Kluczowe funkcjonalności', 'funkcja → co daje → dlaczego obowiązkowa');
  table(s, ['Funkcja', 'Co daje użytkownikowi', 'Status'], [
    ['Agregacja i OCR', 'jedna oś czasu z opasek, PDF-ów i skanów — bez przepisywania ręcznego', 'P0 · warstwa A'],
    ['Rejestr leków, alergii, wywiad rodzinny', 'fundament farmakoterapii i najsilniejszy predyktor ryzyka za koszt jednego pola', 'P0 · warstwa A'],
    ['Mapa i skale bólu', 'najczęstszy powód wizyty u lekarza — nie występował w żadnym wcześniejszym rejestrze', 'P0 · warstwa A'],
    ['Raport SBAR i czasowe udostępnienie lekarzowi', 'lekarz widzi historię w trzy minuty zamiast w trzy wizyty', 'P0 · warstwa A'],
    ['Log dostępu, zgoda per cel, usunięcie danych', 'użytkownik widzi, kto czytał i może wycofać zgodę punktowo', 'P0 · wymóg RODO'],
    ['Oznaczanie treści generowanej przez model', 'jasność, co napisał człowiek, a co system', 'P0 · AI Act art. 50'],
    ['Redirect 116 123', 'jedyna funkcja bez ewolucji faz — dostępna na każdym etapie produktu', 'P0 · bezwarunkowa'],
  ], 2.3, [3.4, 6.4, 2.4]);
  warn(s, 'Reguła granicy obowiązuje w każdej z tych funkcji: fakt i porównanie do własnej historii są bezpieczne; ocena, próg i zalecenie nie są. Cztery sformułowania przekraczają granicę wyrobu medycznego: „Twoje…", „w normie", „powinieneś", „wskazuje na". Katalog liczy 45 reguł kwalifikacji i 52 bezpieczne sformułowania interfejsu.', 5.15);
  src(s, ['spec', 'kart', 'mdcg']);

  // 6 RYNEK I SEGMENTY — grupy docelowe
  s = slide(p); head(s, 'Rynek i segmenty', 'Grupy docelowe', 'segment → potrzeba → kto decyduje → CAC');
  table(s, ['Segment', 'Potrzeba', 'Kto decyduje', 'CAC'], [
    ['Pacjenci metaboliczni i przewlekli', 'stosy PDF-ów i chaos w lekach — potrzebują archiwum, które rozumie treść', 'sam pacjent', '250–600 zł'],
    ['Opiekunowie 40–60 lat', 'martwią się o rodziców; chcą wglądu i interpretacji bez dzwonienia po wynikach', 'opiekun, nie pacjent', '250–600 zł'],
    ['Biohackerzy 30–50 lat', 'trzy urządzenia, dane w pięciu aplikacjach — szukają korelacji, nie kolejnego wykresu', 'sam użytkownik', '100–250 zł'],
    ['Gabinety bez działu IT', 'dokumentacja zjada czas wizyty; płatnik decyzyjny to jedna osoba, nie komisja', 'właściciel gabinetu', '2–10 tys. zł'],
  ], 2.3, [3.0, 5.6, 2.2, 1.4]);
  warn(s, 'Dwie korekty wobec wcześniejszych wersji tego slajdu. CAC 80–120 zł było nierealne dla nowej marki medtech — scenariusz bazowy B2C to 250–600 zł, premium health 500–1000+, w B2B 2–10 tys. na klienta, ale klient kupuje 10–1000 stanowisk, więc B2B jest wielokrotnie efektywniejszy. LTV liczono dla płatnej subskrypcji, a aplikacja pacjenta jest darmowa — trzeba je przeliczyć od zera z marży kanałów K3–K11. Konwersja 25–35% dotyczyła użycia funkcji, nie całej bazy; konwersja freemium w healthtech to około 3,9%.', 5.15);
  src(s, ['bp41']);

  // 7 CASE STUDY — podroz uzytkownika: Piotr
  s = slide(p); head(s, 'Case study', 'Podróż użytkownika: Piotr', 'krok → co widzi Piotr → co widzi system');
  table(s, ['Krok', 'Co widzi Piotr', 'Co widzi system'], [
    ['1. Wejście', 'skanuje osiem wyników badań z trzech lat i podłącza opaskę — pięć minut, bez przepisywania', 'OCR → FHIR R4B, mapowanie LOINC, normalizacja jednostek'],
    ['2. Oś czasu', 'pierwszy raz widzi ferrytynę, sen i tętno spoczynkowe na jednej osi', 'korelacja twardych wyników z danymi behawioralnymi'],
    ['3. Sygnał', '„Twoja ferrytyna z marca była niższa niż w dwóch poprzednich badaniach" — fakt i porównanie, bez oceny', 'detekcja odchylenia od własnej historii; brak progu i zalecenia'],
    ['4. Wizyta', 'generuje raport SBAR i udostępnia go lekarzowi na 48 godzin', 'czasowy token dostępu, log widoczny dla Piotra'],
    ['5. Kontrola', 'wycofuje zgodę na jeden cel, resztę zostawia; eksportuje albo usuwa całość', 'zgoda granularna per cel, usunięcie odrębne od eksportu'],
  ], 2.3, [1.5, 6.0, 4.7]);
  s.addText('W żadnym kroku system nie mówi Piotrowi, że coś jest „w normie", ani czego „powinien" — to byłaby ocena kliniczna i wyrób medyczny klasy IIa. Mówi, co się zmierzyło i jak to wygląda wobec jego własnej historii. Rozstrzyga lekarz, z raportem, którego wcześniej nie miał.',
    { x: 0.55, y: 5.15, w: 12.2, h: 0.7, fontSize: 11, color: ATRAMENT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['spec', 'mdcg', 'rodo']);

  // 8 MONETYZACJA — model biznesowy
  s = slide(p); head(s, 'Monetyzacja', 'Model biznesowy', 'kanał → nazwa → istota i stawka');
  table(s, ['Kanał', 'Nazwa', 'Istota'], [
    MONET[0], MONET[7], MONET[6], MONET[5], MONET[2], MONET[8], MONET[3],
  ], 2.3, [1.0, 3.5, 7.7]);
  warn(s, 'Paradoks przychodowy rozstrzygnięty: funkcje niecertyfikowane są tanie i mają najsłabszą skłonność do płacenia, certyfikowane są drogie i to za nie ktoś płaci. Dojście do 10 mln zł z samego abonamentu konsumenckiego wymagałoby 1–5% populacji Polski — dlatego aplikacja pacjenta jest darmowa w całości, a przychód idzie z gabinetów, płatników, marketplace i grantów. Darmowa aplikacja nie konkuruje z systemem państwowym i nie ma konkurować: ceny zera nie da się podciąć.', 5.35);
  src(s, ['rej', 'bp41']);

  // 9 OKAZJA RYNKOWA — rynek i dlaczego teraz
  s = slide(p); head(s, 'Okazja rynkowa', 'Dlaczego teraz', 'data → co obowiązuje → skutek dla nas');
  table(s, ['Data', 'Co obowiązuje', 'Skutek dla nas'], [
    ['28.05.2026', 'EUDAMED obowiązkowy — także dla składających systemy i zestawy', 'obowiązek rejestracyjny po naszej stronie'],
    ['03.10.2026', 'samoidentyfikacja NIS2 i wpis do Wykazu KSC', 'obowiązek własny — nikt nie wezwie'],
    ['26.03.2027', 'akty wykonawcze EHDS, organy dostępu do danych', 'początek okna przewagi'],
    ['26.03.2029', 'EEHRxF kategoria 1 — CE dla systemów dokumentacji medycznej', 'jedyna data tworząca rynek na mapper'],
    ['26.03.2031', 'EEHRxF kategoria 2 — obrazowanie, wyniki, wypisy', 'do tego czasu luka pozostaje otwarta'],
  ], 2.3, [1.9, 5.9, 4.4]);
  s.addText('Kto zbuduje mapper przed 2029, sprzedaje go każdemu dostawcy systemu gabinetowego w Polsce. Kto zacznie w 2029 — nikomu. To jedyna zewnętrzna data w całym planie, która tworzy popyt niezależnie od naszych działań.',
    { x: 0.55, y: 4.85, w: 12.2, h: 0.6, fontSize: 12, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  s.addText('Celowo nie podajemy globalnych wartości rynku. Wcześniejsze materiały operowały liczbami rzędu bilionów dolarów przy strategii ograniczonej do Polski — taka rozbieżność jest w rozmowie z inwestorem sygnałem ostrzegawczym, nie atutem.',
    { x: 0.55, y: 5.5, w: 12.2, h: 0.5, fontSize: 10, italic: true, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['eehrxf', 'ehds', 'nis2']);

  // 10 KRAJOBRAZ RYNKU — konkurencja
  s = slide(p); head(s, 'Krajobraz rynku', 'Konkurencja', 'kategoria → ich przewaga → nasza pozycja');
  table(s, ['Kategoria', 'Ich przewaga', 'Nasza pozycja'], [
    ['System publiczny (IKP, P1)', 'darmowe, 20 mln kont, mandat ustawowy', 'nie konkurujemy — integrujemy się przez e-Profil Pacjenta'],
    ['Systemy gabinetowe', 'zainstalowana baza, relacje z placówkami', 'stajemy się ich dostawcą komponentu przed 2029'],
    ['Dokumentacja automatyczna (scribe)', 'kapitał, dojrzałość produktu', 'język polski, integracja lokalna, cena'],
    ['Aplikacje konsumenckie', 'budżety marketingowe', 'nie wchodzimy w tę kategorię'],
    ['Agregatory danych', 'zasięg integracji', 'stają się jednym z trzech dostawców, nie jedynym'],
    ['Globalne firmy prewencyjne', 'kapitał rzędu miliarda', 'nie wchodzą do Polski — wymaga statusu podmiotu leczniczego'],
  ], 2.3, [3.0, 3.9, 5.3]);
  s.addText('Dwa ostrzeżenia z rynku: firma prewencyjna z 657 mln USD kapitału zamknęła działalność w listopadzie 2024, a obie platformy monetyzujące sprzedaż danych genetycznych zniknęły do 2025. Kategoria „sprzedamy dane" jest martwa — nasz kanał danych to wyłącznie zbiory zagregowane i zanonimizowane.',
    { x: 0.55, y: 5.15, w: 12.2, h: 0.7, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['forw', 'luna', 'neko', 'm42']);

  // 11 TRACTION I ROADMAPA
  s = slide(p); head(s, 'Traction i roadmapa', 'Start 2026', 'termin → kamień milowy → co znaczy niepowodzenie');
  table(s, ['Termin', 'Kamień milowy', 'Co znaczy niepowodzenie'], [
    ['15.09.2026', 'dwadzieścia rozmów zamkniętych — rozmowa, nie ankieta', 'zatrzymaj budowę, zmień produkt'],
    ['15.10.2026', 'PIĘĆ PODPISANYCH ZOBOWIĄZAŃ — list, przedpłata, cokolwiek wiążącego', 'ZATRZYMAJ BUDOWĘ — dalsze budowanie jest spalaniem pieniędzy'],
    ['15.11.2026', 'produkt u pięciu użytkowników, wniosek do rejestru podmiotów leczniczych złożony', 'opóźnienie, nie porażka'],
    ['31.12.2026', 'podpisany statut Fundacji z trzema zamkami', 'po tej dacie piszesz go z gorszej pozycji negocjacyjnej'],
    ['2027', 'pierwsze licencje dokumentacyjne i subskrypcje weterynaryjne', 'brak przychodu powtarzalnego — rewizja kanału'],
    ['2029', 'mapper w oknie regulacyjnym EEHRxF', 'okno zamknięte, produkt bez rynku'],
  ], 2.3, [1.6, 6.6, 4.0]);
  s.addText('Roadmapa prowadzona jest pięcioma równoległymi torami: sprzedaż, struktura prawna, integracja państwowa, produkt i zgodność. Bramki są wiążące — przekroczenie bramki bez wyniku zatrzymuje tor produktowy, a nie przesuwa termin.',
    { x: 0.55, y: 5.5, w: 12.2, h: 0.5, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['road', 'pwns']);

  // 12 STRUKTURA ORGANIZACYJNA
  s = slide(p); head(s, 'Struktura organizacyjna', 'Kluczowy zespół i partnerzy', 'osoba → rola → zakres odpowiedzialności');
  team(s, 2.25);
  table(s, ['Partner / dostawca', 'Rola w modelu operacyjnym'], [
    ['Software house wyspecjalizowany', 'wykonanie modułów poza rdzeniem; zespół core trzyma architekturę i dane'],
    ['Partner OEM sprzętowy', 'hardware bez własnej linii produkcyjnej — wariant „kupić zamiast budować"'],
    ['Kancelaria i druga kancelaria przeglądowa', 'statut Fundacji, opinie regulacyjne, przegląd niezależny'],
    ['Konsultanci medyczni i jednostka notyfikowana', 'wiarygodność kliniczna, spotkanie przedzgłoszeniowe przed ścieżką CE'],
  ], 4.6, [4.4, 7.8]);
  src(s, ['bp41', 'komp']);

  // 13 BUDZET I EKONOMIA
  s = slide(p); head(s, 'Budżet i ekonomia', 'Finanse — budżet MVP', 'pozycja → kwota → charakter');
  table(s, ['Pozycja', 'Kwota', 'Charakter'], [
    ['Kancelaria — statut Fundacji i opinia regulacyjna', '30–60 tys. zł', 'jednorazowo, nieodwracalne'],
    ['Przegląd przez drugą kancelarię', '10–20 tys. zł', 'jednorazowo'],
    ['Opinie prawne: retencja, farmaceutyczna, ubezpieczeniowa', '15–30 tys. zł', 'jednorazowo'],
    ['Wpis do rejestru podmiotów leczniczych', '894 zł', 'warunek wejścia'],
    ['OC, lokal, opinia sanitarna', '20–40 tys. zł', 'warunek wejścia'],
    ['Bazy słownikowe i licencje branżowe', '~15 tys. zł rocznie', 'powtarzalne'],
    ['Spotkanie przedzgłoszeniowe z jednostką notyfikowaną', '5–15 tys. zł', 'jednorazowo'],
    ['RAZEM, poza kosztem zespołu', '101–191 tys. zł', 'certyfikat integracji z platformą państwową — bezpłatny'],
  ], 2.3, [6.0, 2.6, 3.6]);
  warn(s, 'Budżet MVP na poziomie 110 tys. zł nie pokrywał opisanego zakresu — wcześniejsze wyceny całkowicie pomijały wynagrodzenia, a wynagrodzenia to 70–90% struktury kosztów. Alternatywa wynikająca z pełnego odczytu korpusu: około 200 tys. zł domyka strukturę prawną, status podmiotu leczniczego i doprowadza do pierwszego przychodu bez rundy kapitałowej. Kolejność źródeł: przepływ z działalności powtarzalnej, potem granty, potem kapitał cierpliwy — kapitał wysokiego ryzyka wyłącznie do spółek celowych pod sprzęt.', 5.35);
  src(s, ['cez', 'pcbc', 'bp41']);

  // 14 KONTAKT
  s = slide(p, true); head(s, 'Kontakt', 'Porozmawiajmy', null, true); kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_APLIKACJA.pptx' });
}

// ============ DECK EKOSYSTEMU — 32 slajdy wg nazw z oryginalnego decku ============
function deckEko() {
  NUM = 0; TOT = 32;
  const p = mk('Eternal Life Ecosystem — pitch deck');
  let s;

  // 1
  cover(p, 'Pre-Seed · ekosystem', 'Eternal Life',
    'Warstwa znaczenia nad polskim systemem e-zdrowia',
    'Państwo dostarcza fakty dwudziestu milionom ludzi za darmo. Nie dostarcza interpretacji i nie może jej dostarczyć bez stania się producentem wyrobu medycznego. Ta luka nie zamknie się do 2031 roku.');

  // 2 Problem I
  s = slide(p); head(s, 'Problem I', 'Współczesna medycyna jest fragmentaryczna i opóźniona', 'gdzie leżą dane → dlaczego nie da się na nich działać');
  cards(s, [['Dokumentacja jest rozproszona', 'Placówka trzyma dokument u siebie. Do platformy państwowej trafia wyłącznie indeks — nie treść.'],
            ['Wynik jest nieczytelny', 'Pacjent dostaje liczbę bez odniesienia do własnej historii. Brak warstwy tłumaczącej w systemie publicznym.'],
            ['Reakcja zamiast prewencji', 'System jest zaprojektowany do leczenia chorób, nie do utrzymania zdrowia. Wydatki na profilaktykę: 21,6 EUR wobec 202 EUR średniej unijnej.']], 2.3, 3);
  kpis(s, [['247,8 mld zł', 'wydatki publiczne na zdrowie 2026'], ['23 mld zł', 'luka finansowa 2026'],
           ['171 mld zł', 'prognoza luki 2040'], ['9×', 'różnica w profilaktyce wobec UE']], 4.35);
  src(s, ['gus', 'prof']);
  s.addNotes('Problem jest policzony w złotówkach i w polskim systemie, nie w globalnych prognozach rynku.');

  // 3 Problem II
  s = slide(p); head(s, 'Problem II', 'Bariera ostatniej mili w analizie zdrowia', 'trzy bariery → skutek dla predykcji');
  cards(s, [['Martwe dane', 'Wyniki siedzą w plikach PDF, zdjęciach i skanach. Algorytmy ich nie widzą.'],
            ['Brak kontekstu', 'Zegarek widzi słaby sen, ale nie widzi niskiej ferrytyny ukrytej w wyniku sprzed pół roku.'],
            ['Brak rozstrzygnięcia', 'Dwa urządzenia mierzą to samo i pokazują co innego. Nikt tego nie rozstrzyga — a system, który wybiera po cichu, kłamie.']], 2.3, 3);
  kpis(s, [['8–10 mld zł', 'hospitalizacje możliwe do uniknięcia, rocznie'],
           ['6–8 mld zł', 'dublowane badania diagnostyczne, rocznie'],
           ['14–18 mld zł', 'razem — problem informacyjny, nie medyczny']], 4.35);
  src(s, ['hosp', 'gus']);

  // 4 Rozwiązanie
  s = slide(p); head(s, 'Rozwiązanie', 'Eternal Core Intelligence', 'zdolność → co robi → reżim regulacyjny');
  table(s, ['Zdolność', 'Co robi', 'Reżim'], [
    ['Dane zdrowotne', 'adaptery urządzeń, import dokumentów, normalizacja do jednego modelu', 'poza wyrobem'],
    ['Dokumentacja', 'transkrypcja wizyty, strukturyzacja notatki, kodowanie', 'poza wyrobem'],
    ['Interoperacyjność', 'mapowanie standardu krajowego na europejski', 'komponent'],
    ['Zwierzęta', 'dokumentacja, przypomnienia, transponder', 'poza MDR — odrębny reżim'],
    ['Interpretacja', 'ocena wyniku, alert progowy, predykcja', 'wyrób klasy IIa — nie w pierwszej fali'],
  ], 2.3, [2.4, 7.4, 2.4]);
  s.addText('Reguła produktowa, która sterowała całym projektem: fakt i porównanie do własnej historii są bezpieczne. Ocena, próg i zalecenie nie są. Cztery słowa przekraczają granicę: „Twoje…”, „w normie”, „powinieneś”, „wskazuje na”.',
    { x: 0.55, y: 4.6, w: 12.2, h: 0.6, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['spec', 'mdcg']);

  // 5 Propozycja wartości
  s = slide(p); head(s, 'Propozycja wartości', 'Od zapisu do rozstrzygnięcia', 'co dostaje użytkownik → czego nie ma nigdzie indziej');
  cards(s, [['Komplet', 'Dane z urządzeń, z laboratoriów i z dokumentów papierowych w jednym szeregu czasowym.'],
            ['Rozstrzygnięcie', 'Konflikt między źródłami pokazany z wagą pewności i metodą pomiaru — nie ukryty.'],
            ['Ciągłość', 'Ósma kartka po trzech latach jest bezcenna, bo nikt inny nie ma siedmiu poprzednich.'],
            ['Prawo wyjścia', 'Pełny eksport w formacie użytecznym gdzie indziej, bezpłatnie i zawsze.']], 2.3, 4);
  s.addText('Prosimy człowieka nie o zakup, tylko o powierzenie zapisu własnego ciała na dwadzieścia lat. Dlatego prawo wyjścia jest częścią produktu, nie ustępstwem.',
    { x: 0.55, y: 4.5, w: 12.2, h: 0.5, fontSize: 12, italic: true, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['prod', 'bp41']);

  // 6 Rynek i segmentacja
  s = slide(p); head(s, 'Rynek', 'Segmenty, do których realnie docieramy', 'segment → wielkość → kto decyduje');
  table(s, ['Segment', 'Wielkość', 'Nasza część', 'Uwaga'], [
    ['Podmioty lecznicze', 'dziesiątki tysięcy', 'gabinety bez działu IT', 'płatnik decyzyjny to jedna osoba, nie komisja'],
    ['Dostawcy systemów EDM', 'kilkudziesięciu', 'wszyscy', 'każdy musi spełnić wymóg do 2029'],
    ['Lecznice weterynaryjne', 'tysiące', 'wszystkie', 'zero obecności państwa'],
    ['Właściciele zwierząt', 'miliony gospodarstw', 'segment konsumencki', 'jedyny, w który wchodzimy'],
    ['Producenci wyrobów', 'setki w regionie', 'potrzebujący danych nadzoru', 'sprzedaż obowiązku, nie produktu'],
    ['Sponsorzy badań', 'dziesiątki w Polsce', 'badania zdecentralizowane', 'najwyższa marża'],
  ], 2.3, [2.6, 2.3, 3.2, 4.1]);
  warn(s, 'CELOWO NIE PODAJEMY GLOBALNYCH LICZB RYNKU. Wcześniejsze materiały operowały wartościami 946 mld USD i 1,39 bln USD przy strategii ograniczonej do Polski. Taka rozbieżność między wielkością rynku a zasięgiem działania jest w rozmowie z inwestorem sygnałem ostrzegawczym, nie atutem.', 5.15);
  src(s, ['bp41']);

  // 7 Trendy
  s = slide(p); head(s, 'Dlaczego teraz', 'Cztery daty, które tworzą rynek', 'data → co obowiązuje → skutek');
  table(s, ['Data', 'Co obowiązuje', 'Skutek dla nas'], [
    ['03.10.2026', 'rejestracja w Wykazie KSC (NIS2)', 'obowiązek własny — nikt nie wezwie'],
    ['26.03.2027', 'akty wykonawcze EHDS, organy dostępu do danych', 'początek okna przewagi'],
    ['26.03.2029', 'EEHRxF kategoria 1 — CE dla systemów dokumentacji', 'jedyna data tworząca rynek na mapper'],
    ['26.03.2031', 'EEHRxF kategoria 2 — obrazowanie, wyniki, wypisy', 'do tego czasu luka pozostaje otwarta'],
  ], 2.3, [1.9, 5.6, 4.7]);
  s.addText('Kto zbuduje mapper przed 2029, sprzedaje go każdemu dostawcy systemu gabinetowego w Polsce. Kto zacznie w 2029 — nikomu. To jedyna zewnętrzna data w całym planie, która tworzy popyt niezależnie od naszych działań.',
    { x: 0.55, y: 4.35, w: 12.2, h: 0.6, fontSize: 12, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['ehds', 'nis2', 'eehrxf']);

  // 8 Ekosystem
  s = slide(p); head(s, 'Ekosystem', 'Sześć produktów z korelacji funkcji', 'produkt → skład → kto płaci');
  table(s, ['Produkt', 'Funkcje', 'Kto płaci'], [
    ['P1 Sync — agregacja i rozstrzyganie', 'A1.1 A1.2 A1.8 A1.7 A1.5 A1.10', 'licencja API, B2B'],
    ['P2 Parser — odczyt dokumentów', 'A2.1 A2.3 A2.7 A11.4 A1.5 A2.6', 'placówka, za dokument'],
    ['P3 Scribe — dokumentacja wizyty', 'A12.1 A12.2 A12.5 A12.6 A12.7 A2.2', 'klinika, per lekarz'],
    ['P4 Pet — linia weterynaryjna', 'A13.1 A13.2 A13.4 A13.5 A13.3 A2.6', 'właściciel i lecznica'],
    ['P5 Mapper — interoperacyjność', 'D1.6 A1.5 A2.2 D1.4 A11.4 A2.8', 'dostawca systemu'],
    ['P6 Report — raport dla lekarza', 'A4.1 A4.2 A4.4 A2.5 D1.2 A2.6', 'wersja surowa bezpłatna'],
  ], 2.3, [4.3, 4.6, 3.3]);
  s.addText('Produkt to pięć albo sześć funkcji z rejestru, dobranych tak, że razem robią jedną rzecz, której żadna z nich nie robi osobno. Żaden z sześciu nie wprowadza funkcji spoza rejestru.',
    { x: 0.55, y: 5.05, w: 12.2, h: 0.5, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['prod', 'rej']);

  // 9 P1 Sync
  s = slide(p); head(s, 'Produkt', 'P1 Eternal Sync', 'funkcje → co robi → dlaczego niezastępowalny');
  cards(s, [['Sześć funkcji', 'A1.1 Terra · A1.2 open wearables · A1.8 HealthKit i Health Connect · A1.7 deduplikacja · A1.5 normalizacja · A1.10 przechowywanie'],
            ['Automatyzm', 'Synchronizacja w tle co 15 minut. Po jednorazowym podłączeniu użytkownik nie robi nic.'],
            ['Rdzeń przewagi', 'Apple, Google i Terra pobierają dane. Żaden nie rozstrzyga konfliktu odczytów między źródłami — to funkcja A1.7 i nie ma jej nikt inny.']], 2.3, 3);
  kpis(s, [['0 zł', 'HealthKit i Health Connect od dnia 1'], ['399–499 USD/mies.', 'Terra — dopiero na żądanie klienta B2B'],
           ['3 000 zł/mies.', 'próg wyjścia na własne adaptery'], ['5 000', 'albo tylu aktywnych użytkowników']], 4.35);
  src(s, ['rej', 'komp', 'terra']);

  // 10 P2 Parser
  s = slide(p); head(s, 'Produkt', 'P2 Eternal Parser', 'funkcje → co robi → dlaczego niezastępowalny');
  cards(s, [['Sześć funkcji', 'A2.1 OCR wyników · A2.3 walidacja · A2.7 OCR recept · A11.4 jednostki · A1.5 normalizacja · A2.6 eksport'],
            ['Rdzeń przewagi', 'Silnik rozpoznawania jest towarem. Własny jest parser polskiego kontekstu: ponad trzy tysiące nazw laboratoryjnych, słownik synonimów, formaty Synevo, Diagnostyki i ALAB-u.'],
            ['Rozwój', 'Każda korekta użytkownika wraca do słownika. Próg docelowy: ponad 90% pól bez korekty po tysiącu dokumentów.']], 2.3, 3);
  s.addText('Bezpieczne sformułowanie: „Odczytano: CRP 12 mg/l. Sprawdź poprawność”. Nigdy: „Twoje CRP jest podwyższone” — to druga strona granicy i kosztuje dossier.',
    { x: 0.55, y: 4.4, w: 12.2, h: 0.5, fontSize: 11.5, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['rej', 'spec', 'kart']);

  // 11 P3 Scribe
  s = slide(p); head(s, 'Produkt', 'P3 Eternal Scribe — pierwsza fala', 'funkcje → model → dlaczego pierwszy');
  cards(s, [['Sześć funkcji', 'A12.1 nagrywanie · A12.2 transkrypcja · A12.5 auto-dokumentacja · A12.6 kodowanie ICD · A12.7 integracja z systemem gabinetowym · A2.2 parsowanie'],
            ['Dlaczego pierwszy', 'Ocena 5/7 wg kryteriów własnych. Nie wymaga statusu podmiotu leczniczego, nie wymaga urządzeń, nie wymaga danych z platformy państwowej.'],
            ['Bariera wejścia', 'Język polski medyczny i integracja z polską dokumentacją. Gracz amerykański liczy około 199–250 USD za lekarza miesięcznie i nie wchodzi do Polski.']], 2.3, 3);
  s.addText('Granica: sprzedajesz narzędzie, nie usługę dokumentacyjną. W momencie, w którym to Eternal tworzy dokumentację, a nie klinika, zmienia się reżim.',
    { x: 0.55, y: 4.45, w: 12.2, h: 0.45, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['prod', 'rej', 'bp41']);

  // 12 P4 Pet
  s = slide(p); head(s, 'Produkt', 'P4 Eternal Pet — jedyna ocena 7/7', 'funkcje → rynek → luka konkurencji');
  cards(s, [['Sześć funkcji', 'A13.1 profil · A13.2 obroża GPS · A13.4 Vet AI · A13.5 transponder Bio-Tag · A13.3 Mini Station · A2.6 eksport'],
            ['Rynek nasycony', 'Dominujący gracz ma ponad 5 600 placówek, dwa rozwiązania są bezpłatne, migracja trwa kwadrans.'],
            ['Luka, której nikt nie zajmuje', 'Bezpłatny dostawca na pytanie, czy klient po zakończeniu współpracy otrzyma dane, odpowiada wprost: nie. Pełny eksport kosztuje niewiele i da się go powiedzieć jednym zdaniem.']], 2.3, 3);
  kpis(s, [['poza MDR', 'odrębny reżim, nie łatwiejsza ścieżka'], ['ISO 11784/11785', 'normy identyfikacji zwierząt'],
           ['~29 zł/mies.', 'subskrypcja po freemium'], ['tor walidacyjny', 'dla całej warstwy sprzętowej']], 4.5);
  src(s, ['rej', 'prod', 'bp41']);

  // 13 P5 i P6
  s = slide(p); head(s, 'Produkt', 'P5 Mapper i P6 Report', 'okno regulacyjne → produkt adopcyjny');
  cards(s, [['P5 Mapper — okno 2029', 'Mapper między standardem krajowym a europejskim nie istnieje jako produkt, a od 26.03.2029 potrzebuje go każdy dostawca systemu gabinetowego. Licencja per placówka plus wdrożenie, zerowy koszt krańcowy. To wyścig, nie fosa trwała.'],
            ['P6 Report — komplet dla lekarza', 'Raport łączący dane z urządzeń, z laboratoriów prywatnych i z dokumentów papierowych. Nie powstaje nigdzie indziej, bo nikt inny nie ma wszystkich trzech źródeł. Wersja surowa bezpłatna na zawsze.']], 2.3, 2);
  s.addText('Siódma pozycja świadomie nie jest produktem: karta ratunkowa działa bez sieci, z zablokowanego ekranu, bez konta po stronie ratownika. Każdy odczyt zostawia nieusuwalny ślad, pacjent dostaje powiadomienie po fakcie. Najmocniejszy argument adopcyjny w portfelu — i nie monetyzujemy jej nigdy.',
    { x: 0.55, y: 4.4, w: 12.2, h: 0.7, fontSize: 11.5, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['prod', 'eehrxf']);

  // 14 Architektura
  s = slide(p); head(s, 'Architektura', 'Od sygnału do wniosku', 'warstwa → zakres → zasada');
  table(s, ['Warstwa', 'Zakres', 'Zasada'], [
    ['Adaptery', 'urządzenia, dokumenty, laboratoria, platforma państwowa', 'rdzeń nigdy nie woła API dostawcy — zawsze przez adapter'],
    ['Model danych', 'kanoniczny model, jednostki UCUM, wersjonowanie', 'kto definiuje format, ten posiada ekosystem'],
    ['Proweniencja', 'źródło, metoda, czas, waga pewności każdego pomiaru', 'dopisanie później to migracja wszystkich danych'],
    ['Zgody', 'granularne per cel, odwoływalne natychmiast', 'warunek prawny całej reszty'],
    ['Silnik reguł', 'reguły jawne i wersjonowane', 'wymusza granicę wellness–wyrób w kodzie, nie w regulaminie'],
  ], 2.3, [2.2, 5.0, 5.0]);
  kpis(s, [['8 modułów', 'warstwa orkiestracji K1–K8'], ['395', 'osobodni'],
           ['316 tys. zł', 'przy stawce 800 zł/osobodzień'], ['28', 'klas komponentów zamiast 588 kombinacji']], 4.95);
  src(s, ['spec', 'komp']);

  // 15 Bezpieczeństwo
  s = slide(p); head(s, 'Bezpieczeństwo', 'Zaufanie jest warunkiem produktu, nie dodatkiem', 'zasada → wykonanie');
  table(s, ['Zasada', 'Wykonanie'], [
    ['Dane należą do tego, kto je wytworzył', 'pełny eksport bezpłatny i zawsze dostępny — prawo wyjścia jest albo go nie ma'],
    ['Surowe dane blisko człowieka', 'na zewnątrz idą wyniki i wielkości zbiorcze, nie zapis źródłowy'],
    ['Każdy odczyt zostawia ślad', 'dziennik audytowy od pierwszego dnia — wstecz się go nie odtworzy'],
    ['Zgoda granularna i odwoływalna', 'per cel przetwarzania, cofnięcie działa natychmiast'],
    ['Rezydencja i klucze', 'dane w Unii, klucze po naszej stronie, nie u dostawcy'],
    ['Cztery tryby dostępu', 'własny, czasowy link wygasający, opiekuńczy z wygaszeniem w 18. urodziny, ratunkowy z pełnym logiem'],
  ], 2.3, [3.7, 8.5]);
  src(s, ['rodo', 'nis2', 'spec']);

  // 16 Zgodność
  s = slide(p); head(s, 'Zgodność', 'Cztery statusy regulacyjne zamiast dwóch', 'status → funkcji → reżim');
  table(s, ['Status', 'Funkcji', 'Reżim'], [
    ['1. General software', '~30', 'RODO, prawo handlowe'],
    ['2. Health / wellness', '~38', 'RODO art. 9'],
    ['3. Regulowane poza MDR', '~17', 'działalność lecznicza, prawo farmaceutyczne, IVDR, AI Act'],
    ['4. MDSW — wyrób medyczny', '~14', 'MDR reguła 11 załącznik VIII'],
    ['GRANICZNE', '~16', 'status 2 albo 4 zależnie od jednego zdania przeznaczenia'],
  ], 2.3, [3.4, 1.6, 7.2]);
  kpis(s, [['243', 'funkcje warstwy A — poza wyrobem'], ['31', 'warstwa B — inny reżim'],
           ['63', 'warstwa C — wyrób medyczny'], ['18–36 mies.', 'realny czas dossier klasy IIa']], 4.85);
  warn(s, 'Wąskim gardłem nie jest koszt, tylko kolejka do jednostki notyfikowanej — bywa dłuższa niż zakładany czas całej certyfikacji. Dlatego spotkanie przedzgłoszeniowe umawia się przed pierwszą linią kodu, a nie po zbudowaniu produktu.', 6.0);
  src(s, ['mdr', 'mdcg', 'pcbc', 'rej']);

  // 17 Roadmapa
  s = slide(p); head(s, 'Roadmapa', 'Pięć horyzontów, jeden scenariusz', 'horyzont → co gotowe → warunek przejścia');
  table(s, ['Horyzont', 'Co ma być gotowe', 'Warunek przejścia dalej'], [
    ['Do 15.11.2026', 'pięć podpisanych zobowiązań, wniosek RPWDL, produkt u pięciu użytkowników', 'brak zobowiązań = zatrzymaj budowę'],
    ['Do 31.12.2026', 'statut Fundacji, licencja IP w dół kaskady, cztery opinie prawne', 'po tej dacie negocjujesz zamiast decydować'],
    ['2027', 'wpis do RPWDL, raportowanie do platformy, Pet i Scribe z przychodem', 'przychód pokrywający koszt zespołu w miesiącu 18'],
    ['2028–2029', 'mapper sprzedawalny, kohorta tysiąca osób, dossier warstwy oceny', 'wejście w okno przed 26.03.2029'],
    ['2030+', 'warstwa oceny dopuszczona, rejestr implantów, drugi rynek unijny', 'walidacja prospektywna modeli'],
  ], 2.3, [2.3, 6.4, 3.5]);
  src(s, ['road', 'pwns']);

  // 18 Roadmapa 2030+
  s = slide(p); head(s, 'Horyzont 4', 'Co wraca i pod jakim warunkiem', 'pozycja → data → warunek reaktywacji');
  table(s, ['Pozycja', 'Realna data', 'Warunek reaktywacji'], [
    ['Transponder weterynaryjny — produkcja własna', '2027–2028', 'przychód z linii weterynaryjnej'],
    ['Transponder u człowieka, wellness NFC', '2030–2031', 'kompetencja produkcyjna z toru weterynaryjnego'],
    ['Transponder jako wyrób klasy IIb', '2035–2037', 'partner z ISO 13485 oraz finansowanie ≥5 mln EUR'],
    ['Station jako wyrób medyczny', '2032', 'dossier'],
    ['Digital Twin jako wyrób', '2031', 'walidacja prospektywna, ścieżka ASME V&V 40'],
    ['Warstwa immersyjna', '—', 'rekomendacja: nie robić'],
  ], 2.3, [4.6, 2.4, 5.2]);
  warn(s, 'Etap bez warunku wejścia nie jest planem, tylko listą życzeń. Pozycje usunięte z dokumentacji produktowej: roje terapeutyczne, kopia świadomości, teza o wydłużeniu życia do konkretnej liczby lat, konsumencki panel biochemiczny, mieszanie preparatów przez model, ogniwa biopaliwowe i pozycjonowanie w kategorii długowieczności.', 5.4);
  src(s, ['road', 'bp41']);

  // 19 Model biznesowy
  s = slide(p); head(s, 'Model biznesowy', 'Trzy warstwy przychodu', 'warstwa → kto płaci → charakterystyka');
  table(s, ['Warstwa', 'Kto płaci', 'Ile zostaje', 'Kiedy', 'Charakterystyka'], [
    ['Prowizja od ruchu', 'laboratoria, apteki, catering', '10–30%', 'pierwszy miesiąc', 'liniowa — każda złotówka wymaga transakcji'],
    ['Licencja B2B', 'ubezpieczyciel, dostawca EDM, klinika', '100%', '2027–2029', 'zerowy koszt krańcowy'],
    ['Opłata za zgodność', 'producenci urządzeń', '100%', '2028+', 'rośnie z adopcją standardu'],
  ], 2.3, [2.3, 3.4, 1.5, 1.9, 3.1]);
  s.addText('Orkiestrator nie zarabia na prowizji — prowizja finansuje koszty bieżące. Wartość powstaje z tego, że jesteśmy jedynym miejscem, w którym dane z wielu źródeł są w komplecie, a to sprzedaje się licencyjnie.',
    { x: 0.55, y: 4.15, w: 12.2, h: 0.55, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  warn(s, 'MODEL ODRZUCONY: sprzedaż danych użytkownika z prowizją. Powód podwójny. Rynkowy: kategoria upadła — LunaDNA zamknięta 31 stycznia 2024, Nebula przekształcona w 2025. Prawny: zgoda w rozumieniu RODO nie może być kupiona ani stanowić warunku usługi (art. 7 ust. 4).', 4.85);
  src(s, ['luna', 'rodo', 'bp41']);

  // 20 Strumienie przychodów
  s = slide(p); head(s, 'Przychody', 'Dziewięć kanałów i ich ranking', 'kanał → model → marża');
  table(s, ['Kanał', 'Model', 'Kiedy pierwszy przychód', 'Marża'], [
    ['Usługi regulacyjne', 'za projekt', 'kwartał 2', 'wysoka — nie wymaga żadnego produktu'],
    ['Eternal Scribe', 'licencja per lekarz miesięcznie', 'kwartał 3', 'abonament instytucjonalny — najlepszy typ'],
    ['Eternal Pet', 'freemium → subskrypcja → sprzęt', 'kwartał 3', 'software wysoka, sprzęt 40%'],
    ['Odczyt dokumentów', 'za dokument', 'rok 3', 'bardzo wysoka'],
    ['Mapper interoperacyjności', 'licencja per placówka plus wdrożenie', 'rok 2–3', 'bardzo wysoka'],
    ['Nadzór porynkowy', 'kontrakt roczny', '2028+', 'wysoka — sprzedaż obowiązku'],
    ['Badania zdecentralizowane', 'kontrakt na badanie', '2029', 'najwyższa'],
    ['Prowizja marketplace', 'od transakcji', 'rok 1', 'średnia — dobra jako uzupełnienie'],
    ['Eksport, warstwa kryzysowa, format zapisu', 'nigdy płatne', '—', 'kupują zaufanie, na którym stoi reszta'],
  ], 2.3, [3.3, 3.5, 2.6, 2.8]);
  src(s, ['bp41', 'prod']);

  // 21 GTM
  s = slide(p); head(s, 'Go-to-market', 'Fizyka marketingu jest tu odwrotna', 'faza → kanał → co mierzymy');
  table(s, ['Faza', 'Kanał', 'Co mierzymy'], [
    ['Przed produktem', 'społeczność prowadzona przez osobę o wiarygodności medycznej, wokół konkretnej sprawy', 'wielkość i zaangażowanie'],
    ['Miesiące 1–2', 'czterdzieści rozmów: dwadzieścia lecznic, dwadzieścia gabinetów', 'pięć podpisanych zobowiązań'],
    ['Miesiące 3–6', 'konwersja zobowiązań w płatności, polecenia', 'pięciu płacących'],
    ['Rok 1–2', 'sprzedaż bezpośrednia plus kanał przez dostawców systemów', 'przychód powtarzalny'],
    ['Rok 2–3', 'mapper przez dostawców systemów gabinetowych', 'trzy płacące placówki'],
    ['Rok 3+', 'rejestr i certyfikacja — producenci przychodzą sami', 'wpisy zewnętrzne'],
  ], 2.3, [2.0, 7.0, 3.2]);
  s.addText('Im głośniej się mówi, tym mniej jest się wiarygodnym. Decyzja o powierzeniu zapisu zapada wolno, reaguje na dowód zamiast na obietnicę i karze rozmach.',
    { x: 0.55, y: 5.15, w: 12.2, h: 0.45, fontSize: 12, italic: true, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['bp41']);

  // 22 Konkurencja
  s = slide(p); head(s, 'Konkurencja', 'Siedem kategorii i nasza pozycja', 'kto → ich przewaga → nasza pozycja');
  table(s, ['Kategoria', 'Ich przewaga', 'Nasza pozycja'], [
    ['System publiczny', 'darmowe, 20 mln kont, obowiązek po stronie placówek', 'nie konkurujemy — integrujemy się'],
    ['Systemy gabinetowe', 'zainstalowana baza, relacje', 'stajemy się ich dostawcą komponentu'],
    ['Dokumentacja automatyczna', 'kapitał, dojrzałość produktu', 'język polski, integracja, cena'],
    ['Aplikacje konsumenckie', 'marketing', 'nie wchodzimy w tę kategorię'],
    ['Agregatory danych', 'zasięg integracji', 'stają się jednym z trzech dostawców, nie jedynym'],
    ['Weterynaria', 'brak', 'pole czyste, ale rynek nasycony'],
    ['Globalne firmy prewencyjne', 'kapitał rzędu miliarda', 'nie wchodzą do Polski — wymaga statusu podmiotu leczniczego'],
  ], 2.3, [3.0, 4.2, 5.0]);
  src(s, ['m42', 'neko', 'bp41']);

  // 23 Przewagi
  s = slide(p); head(s, 'Przewagi', 'Sześć elementów fosy', 'element → na czym polega → kto może powtórzyć');
  table(s, ['Element', 'Na czym polega', 'Kto może powtórzyć'], [
    ['Status podmiotu leczniczego', 'kto wytworzył dokument, ma dostęp z mocy ustawy', 'żadna aplikacja konsumencka'],
    ['Wytwarzanie własnej dokumentacji', 'zlecanie badań daje jednocześnie przychód i dane', 'tylko inny podmiot leczniczy — a te nie budują oprogramowania'],
    ['Model danych i mapper', 'Polska stoi na innym standardzie niż europejski', 'każdy, kto zacznie teraz — to wyścig, nie fosa'],
    ['Rejestr i dane wynikowe', 'producent wie, że urządzenie działa; nie wie, czy pacjentowi jest lepiej', 'nikt bez dostępu do pacjentów wielu producentów'],
    ['Ciągłość zapisu', 'ósma kartka po trzech latach', 'nikt — czasu nie da się kupić'],
    ['Kompetencja regulacyjna', 'wąska, rzadka, już zbudowana', 'kosztuje czas, nie pieniądze'],
  ], 2.3, [3.0, 5.0, 4.2]);
  src(s, ['bp41', 'spec']);

  // 24 Blue ocean
  s = slide(p); head(s, 'Pozycjonowanie', 'Cztery obszary, w które państwo nie wejdzie', 'obszar → dlaczego nie wejdzie');
  cards(s, [['Dane z urządzeń', 'To nie jest dokumentacja medyczna, więc nie ma podstawy prawnej do gromadzenia.'],
            ['Wyniki prywatnych laboratoriów w komplecie', 'Platforma pokazuje to, co zaraportowano. Laboratoria mają własne portale i własny interes.'],
            ['Zlecanie badań i handel', 'Państwo nie prowadzi działalności handlowej.'],
            ['Narzędzia zgodności dla dostawców EDM', 'Regulator definiuje standard, ale nie dostarcza narzędzi do jego spełnienia.']], 2.3, 4);
  s.addText('To nie są luki wynikające z budżetu, tylko z podstawy prawnej działania systemu publicznego. Państwo mówi, co się zdarzyło i kiedy masz przyjść. Nie mówi, co to znaczy dla ciebie.',
    { x: 0.55, y: 4.5, w: 12.2, h: 0.55, fontSize: 12, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  warn(s, 'Dowód empiryczny: Portfel Aplikacji Zdrowotnych ma warunek bezpłatności dla każdego użytkownika. Efekt — dwie aplikacje w portfelu i określenie „fiasko" w prasie branżowej. Państwo próbowało wejść w rolę prywatnych aplikacji i mu się nie udało.', 5.2);
  src(s, ['spec', 'bp41']);

  // 25 Zespół
  s = slide(p); head(s, 'Zespół', 'Kto to buduje', 'osoba → rola → zakres');
  team(s, 2.3);
  warn(s, 'Jedna rola pozostaje nieobsadzona i jest najpilniejszą rekrutacją: następca operacyjny. Wymaga dwóch do trzech lat wspólnej pracy przed przekazaniem, więc rekrutacja zaczyna się teraz, a nie wtedy, gdy będzie potrzebny.', 4.7);
  src(s, ['pwns', 'bp41']);

  // 26 Model operacyjny
  s = slide(p); head(s, 'Model operacyjny', 'Sześć modeli wykonania, włączanych w kolejności', 'model → kiedy → warunek');
  table(s, ['Model', 'Kiedy włączamy', 'Koszt i kontrola'], [
    ['Orkiestrator', 'DOMYŚLNY — od dziś', '400–540 tys. zł, 9–12 mies.; kontrola rosnąca z progami wyjścia'],
    ['Integrator systemów', 'równolegle — dzieli komponenty', '110 osobodni; wysoka nad formatem'],
    ['Podmiot leczniczy', 'po pierwszym przychodzie', '894 zł plus lokal, personel, OC — realnie druga firma'],
    ['Konsorcjum badawcze', 'gdy istnieje kohorta', 'zero pieniędzy; udział 5–15% za wkład danych'],
    ['Platforma dla twórców', 'gdy istnieje API i klienci', '40–60 tys. zł na wersję pierwszą'],
    ['Wytwórca wyrobu', 'NA KOŃCU — gdy pięciu klientów płaci za to samo', 'setki tys. do kilku mln zł, 18–36 mies.'],
  ], 2.3, [2.8, 3.6, 5.8]);
  s.addText('Najczęstszy błąd w tej kategorii to wejście w model wytwórcy przed modelem orkiestratora: dossier przed dowodem popytu. Dopuszczenie regulacyjne nie chroni przed brakiem popytu — spalono na tym miliardy.',
    { x: 0.55, y: 5.15, w: 12.2, h: 0.5, fontSize: 11.5, bold: true, color: RDZA, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['prod', 'forw']);

  // 27 Prognozy
  s = slide(p); head(s, 'Finanse', 'Założenia przychodowe bez prognozy liczbowej', 'rok → źródło → charakter');
  table(s, ['Rok', 'Źródło przychodu', 'Charakter'], [
    ['2027', 'pierwsze licencje dokumentacyjne i subskrypcje weterynaryjne', 'kilkudziesięciu klientów, przychód powtarzalny'],
    ['2028', 'rozszerzenie kanału, świadczenia własne, pierwsze kontrakty badawcze', 'pokrycie kosztu zespołu'],
    ['2029', 'mapper — okno regulacyjne', 'skokowy wzrost przy trafieniu w termin'],
    ['2030+', 'rejestr, certyfikacja, nadzór porynkowy, badania', 'przychód niezależny od liczby użytkowników'],
  ], 2.3, [1.4, 6.0, 4.8]);
  warn(s, 'Świadomie nie podajemy prognozy pięcioletniej. Poprzednia była zbudowana na modelu kosztowym bez wynagrodzeń i na konwersji konsumenckiej, która nie jest osią przychodu. Wynagrodzenia to 70–90% struktury kosztów — ich pominięcie było najpoważniejszym z siedmiu błędów tamtych wycen. Prognoza powstanie po pierwszych sześciu miesiącach sprzedaży, na danych.', 4.45);
  src(s, ['bp41']);

  // 28 Struktura finansowania
  s = slide(p); head(s, 'Finansowanie', 'Około 200 tys. zł, bez rundy kapitałowej', 'pozycja → kwota');
  table(s, ['Pozycja', 'Kwota'], [
    ['Kancelaria — statut Fundacji i opinia regulacyjna', '30–60 tys. zł'],
    ['Przegląd przez drugą kancelarię', '10–20 tys. zł'],
    ['Opinie prawne: retencja, farmaceutyczna, ubezpieczeniowa', '15–30 tys. zł'],
    ['Wpis do rejestru podmiotów leczniczych', '894 zł'],
    ['OC, lokal, opinia sanitarna', '20–40 tys. zł'],
    ['Certyfikat integracji z platformą państwową', 'bezpłatny'],
    ['Bazy słownikowe i licencje branżowe', '~15 tys. zł rocznie'],
    ['Spotkanie przedzgłoszeniowe z jednostką notyfikowaną', '5–15 tys. zł'],
    ['Podróże i spotkania — czterdzieści rozmów', '5–10 tys. zł'],
    ['RAZEM, poza kosztem zespołu', '101–191 tys. zł'],
  ], 2.3, [8.6, 3.6]);
  src(s, ['cez', 'pcbc', 'bp41']);

  // 29 Alokacja
  s = slide(p); head(s, 'Alokacja kapitału', 'Kolejność źródeł finansowania', 'źródło → uwaga');
  table(s, ['Kolejność', 'Źródło', 'Uwaga'], [
    ['1', 'przepływ z działalności powtarzalnej — Scribe i Pet', 'dostępne od pierwszego roku'],
    ['2', 'środki bezzwrotne — granty i konsorcja', 'nie rozwadniają, dają wiarygodność'],
    ['3', 'kapitał cierpliwy — biura rodzinne, fundacje, partnerzy strategiczni', ''],
    ['4', 'przychód konsumencki', 'dopiero przy zbudowanej społeczności'],
    ['NIE', 'kapitał wysokiego ryzyka do spółki-matki', 'czas życia funduszu jest krótszy niż horyzont przedsięwzięcia; wyłącznie do spółek celowych pod sprzęt'],
  ], 2.3, [1.4, 5.4, 5.4]);
  s.addText('Warunek konieczny dla warstwy badawczej: fundusz zasilany automatycznie stałym odsetkiem przychodu, poza kontrolą zarządu. Zarząd rozliczany z wyników bieżących nie sfinansuje badań o horyzoncie dwudziestoletnim — nie ze złej woli, tylko dlatego, że jest rozliczany z czegoś innego.',
    { x: 0.55, y: 4.65, w: 12.2, h: 0.6, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['bp41', 'prod']);

  // 30 Ryzyka
  s = slide(p); head(s, 'Ryzyka', 'Osiem pozycji z prawdopodobieństwem', 'ryzyko → prawdopodobieństwo → mitygacja');
  table(s, ['Ryzyko', 'Prawd.', 'Mitygacja'], [
    ['Rozproszenie uwagi na zbyt wiele frontów', 'WYSOKIE', 'zasada dwóch–trzech projektów; katalog odrzuceń zapisany'],
    ['Odejście założyciela z operacji bez następcy', 'WYSOKIE', 'rekrutacja następcy jako pozycja priorytetowa'],
    ['Brak popytu na pierwszą falę', 'średnie', 'bramka: pięć zobowiązań przed budową'],
    ['Konkurent zajmuje mapper przed nami', 'średnie', 'przychód ze Scribe i Pet niezależny'],
    ['Jednostka notyfikowana klasyfikuje wyżej', 'średnie', 'spotkanie przedzgłoszeniowe przed kodem'],
    ['Odcięcie kluczowego dostawcy', 'średnie', 'reguła jednej trzeciej, adapter, wariant zapasowy z realnym ruchem'],
    ['Termin cyberbezpieczeństwa niedotrzymany', 'niskie', 'koszt bliski zeru dziś'],
    ['Wpis do rejestru nieuzyskany', 'niskie', 'Scribe i Pet go nie wymagają — dlatego są pierwsze'],
  ], 2.3, [4.4, 1.5, 6.3]);
  src(s, ['bp41']);

  // 31 Grupy docelowe i bramki
  s = slide(p); head(s, 'Bramki decyzyjne', 'Kiedy wiemy, że to działa — i kiedy przestajemy', 'termin → kamień → co znaczy niepowodzenie');
  table(s, ['Termin', 'Kamień milowy', 'Co znaczy niepowodzenie'], [
    ['15.09.2026', 'dwadzieścia rozmów zamkniętych', 'zatrzymać budowę, zmienić produkt'],
    ['15.10.2026', 'pięć podpisanych zobowiązań', 'nie ma popytu'],
    ['31.12.2026', 'statut Fundacji podpisany', 'negocjujesz zamiast decydować'],
    ['Q1 2027', 'wpis do rejestru podmiotów leczniczych', 'przegląd strategii dostępu do danych'],
    ['Miesiąc 6', 'pięciu płacących, aktywnych klientów', 'nie umiemy sprzedać'],
    ['Miesiąc 18', 'przychód pokrywający koszt zespołu', 'zwiń do jednego produktu'],
    ['Przed 26.03.2029', 'mapper gotowy i przetestowany', 'okno zamknięte'],
  ], 2.3, [2.2, 5.4, 4.6]);
  s.addText('MAU nie rozstrzyga, czy ktoś zapłaci. Dlatego wskaźnikami są zobowiązania, płacący klienci i pokrycie kosztu zespołu — nie liczba rejestracji.',
    { x: 0.55, y: 5.3, w: 12.2, h: 0.45, fontSize: 11.5, bold: true, color: GRANAT, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['road', 'bp41']);

  // 32 Kontakt
  s = slide(p, true); head(s, 'Kontakt', 'Porozmawiajmy', null, true); kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_EKOSYSTEM.pptx' });
}


deckApp().then(f => { console.log('OK', f); return deckEko(); })
  .then(f => console.log('OK', f))
  .catch(e => { console.error('ERR', e); process.exit(1); });
