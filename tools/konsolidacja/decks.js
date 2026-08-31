const pptxgen = require('pptxgenjs');

// ---- Paleta z logo Eternal Life: rdzawa pomarancz + granat ----
const RDZA = 'B8431F', RDZA_J = 'D46A3E';
const GRANAT = '1B3A6B', GRANAT_C = '122845';
const ATRAMENT = '16233F', SZARY = '5D6B8A';
const BIALY = 'FFFFFF', KOSC = 'FAF8F5', LINIA = 'E6E2DC';
const BURSZTYN = 'B07419';
const HF = 'Cambria', BF = 'Calibri';
const WWW = 'eternallife24.pages.dev';
const MAIL = 'office.eternal.life@gmail.com';
const TEL = '+48 784 407 991';

// ---- Zrodla zewnetrzne (research, nie indeks archiwum) ----
const Z = {
  gvr: 'Grand View Research — Digital Health Market Report (946 mld USD w 2030, CAGR 22,2%)',
  mnm: 'MarketsandMarkets — Digital Health Market 2025-2030 (573,5 mld USD w 2030)',
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
      // logo: blok E + wordmark
      { rect: { x: 0.55, y: 0.3, w: 0.30, h: 0.085, fill: { color: RDZA }, line: { color: RDZA } } },
      { rect: { x: 0.55, y: 0.3, w: 0.085, h: 0.34, fill: { color: RDZA }, line: { color: RDZA } } },
      { rect: { x: 0.55, y: 0.555, w: 0.30, h: 0.085, fill: { color: RDZA }, line: { color: RDZA } } },
      { rect: { x: 0.55, y: 0.428, w: 0.20, h: 0.075, fill: { color: RDZA }, line: { color: RDZA } } },
      { text: { text: 'TERNAL LIFE', options: { x: 0.90, y: 0.29, w: 2.6, h: 0.36, valign: 'middle',
        fontSize: 15, bold: true, color: GRANAT, fontFace: HF, charSpacing: 1, margin: 0, isTextBox: true } } },
      { text: { text: WWW, options: { x: 9.9, y: 0.29, w: 2.85, h: 0.36, align: 'right', valign: 'middle',
        fontSize: 9.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true } } },
    ],
  });
  p.defineSlideMaster({
    title: 'CIEMNY', background: { color: GRANAT },
    objects: [
      { rect: { x: 0.55, y: 0.3, w: 0.30, h: 0.085, fill: { color: RDZA_J }, line: { color: RDZA_J } } },
      { rect: { x: 0.55, y: 0.3, w: 0.085, h: 0.34, fill: { color: RDZA_J }, line: { color: RDZA_J } } },
      { rect: { x: 0.55, y: 0.555, w: 0.30, h: 0.085, fill: { color: RDZA_J }, line: { color: RDZA_J } } },
      { rect: { x: 0.55, y: 0.428, w: 0.20, h: 0.075, fill: { color: RDZA_J }, line: { color: RDZA_J } } },
      { text: { text: 'TERNAL LIFE', options: { x: 0.90, y: 0.29, w: 2.6, h: 0.36, valign: 'middle',
        fontSize: 15, bold: true, color: BIALY, fontFace: HF, charSpacing: 1, margin: 0, isTextBox: true } } },
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

// ============ DECK APLIKACJI (12 slajdow) ============
function deckApp() {
  NUM = 0; TOT = 12;
  const p = mk('Eternal App — pitch aplikacji');
  let s;

  cover(p, 'Pre-Seed · aplikacja', 'Eternal App', 'Zintegrowana platforma danych zdrowotnych',
    'Aplikacja zbiera rozproszoną historię medyczną w jedno miejsce i zamienia ją w dane, na których da się działać. Rozwiązujemy problem ostatniej mili w analizie zdrowia.');

  s = slide(p); head(s, 'Problem', '80% historii medycznej jest niewidoczne dla algorytmów', 'trzy bariery → skutek dla predykcji');
  cards(s, [['Martwe dane', 'Wyniki badań siedzą w PDF-ach, zdjęciach i skanach. Standardowe algorytmy ich nie widzą.'],
            ['Brak kontekstu', 'Smartwatch widzi słaby sen, ale nie widzi niskiej ferrytyny ukrytej w PDF.'],
            ['Brak działania', 'Bez standardu FHIR nie ma wymiany danych. Pacjent dostaje informację, nie możliwość działania.']], 2.3, 3);
  s.addText('„Obecny system jest zaprojektowany do leczenia chorób, a nie utrzymania zdrowia."',
    { x: 0.55, y: 4.25, w: 12.2, h: 0.4, fontSize: 13, italic: true, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['fhir', 'ehds']);
  s.addNotes('Problem ostatniej mili: dane istnieją, ale są nieczytelne dla maszyn i pozbawione kontekstu klinicznego.');

  s = slide(p); head(s, 'Rozwiązanie', 'Eternal Core Intelligence', 'filar → technologia → zakres integracji');
  cards(s, [['Filar 1 — import uniwersalny', 'Skan dowolnego dokumentu medycznego i konwersja na dane strukturalne w standardzie FHIR.'],
            ['Filar 2 — synchronizacja', 'Jedno API do wszystkich wiodących wearables: Apple, Garmin, Oura, Whoop, Fitbit.'],
            ['Filar 3 — logika medyczna', 'Korelacja twardych wyników badań z miękkimi danymi behawioralnymi.']], 2.3, 3);
  kpis(s, [['16', 'modułów A1–A16'], ['337', 'funkcji w macierzy'], ['201', 'funkcji aplikacji'], ['Q3 2026', 'start MVP']], 4.3);
  src(s, ['terra', 'fhir']);

  s = slide(p); head(s, 'Moduły', 'Co aplikacja faktycznie robi', 'moduł → zakres → etap dojrzałości');
  table(s, ['Moduły', 'Zakres', 'Etap'], [
    ['A1–A2', 'Agregacja danych z wearables i OCR dokumentów medycznych', 'MVP'],
    ['A3–A4', 'Dashboard, alerty, Bio-Weather, raporty i eksport', 'MVP'],
    ['A5–A6', 'Telemedycyna oraz AI/RAG z guardrails i cytowaniem źródeł', 'MLP'],
    ['A7–A8', 'Planowanie, rekomendacje, zdrowie psychiczne z Crisis Redirect 116 123', 'MLP'],
    ['A9–A12', 'Społeczność, marketplace, regionalizacja, automatyczna dokumentacja', 'MLP–FINAL'],
    ['A13–A16', 'Pet, powiadomienia i eskalacja, Fundacja/Hub, Eternal Forge', 'FINAL'],
  ], 2.3, [1.5, 8.5, 2.2]);
  src(s, ['itaka']);

  s = slide(p); head(s, 'Architektura', 'Od sygnału do wniosku klinicznego', 'warstwa → zakres techniczny');
  table(s, ['Warstwa', 'Zakres'], [
    ['01 Ingestion', 'Terra API dla urządzeń noszonych · OCR dokumentów medycznych'],
    ['02 Structuring', 'FHIR R4B · mapowanie SNOMED CT i LOINC'],
    ['03 Intelligence', 'RAG z guardrails · scoring i detekcja anomalii · Bio-Correlation'],
    ['04 Presentation', 'Dashboardy · oś czasu zdrowia · raport SBAR dla lekarza'],
  ], 2.3, [2.4, 9.8]);
  s.addText('Decyzje oznaczone w źródłach jako zamknięte: Flutter + FastAPI + FHIR R4B, RAG na Qdrant, BioMistral 7B i PubMedBERT, dane surowe pozostają na urządzeniu, hosting w Unii Europejskiej.',
    { x: 0.55, y: 4.5, w: 12.2, h: 0.55, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['fhir', 'rodo']);

  s = slide(p); head(s, 'Monetyzacja', 'Aplikacja pacjenta jest darmowa', 'kanał → nazwa → istota i stawka');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(0, 6), 2.3, [1.0, 3.5, 7.7]);
  warn(s, 'Cennik to najbardziej rozjechana pozycja w korpusie: oficjalny deck 29,99/49,99 PLN, checklisty 49 PLN, plan operacyjny 19–29 PLN, a Specyfikacja Master 5.4 mówi, że aplikacja pacjenta jest darmowa w całości. Przyjęto wersję z Master 5.4 jako najnowszą.', 4.75);
  src(s, ['rodo']);

  s = slide(p); head(s, 'Monetyzacja', 'Kanały K6–K11 — tam, gdzie są pieniądze', 'kanał → nazwa → istota i stawka');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(6), 2.3, [1.0, 3.5, 7.7]);
  warn(s, 'Kanał K6 jest najbardziej ryzykowny prawnie: różnicowanie składki na podstawie danych zdrowotnych to profilowanie z art. 22 RODO w połączeniu z art. 9. Wymaga osobnej, w pełni opcjonalnej zgody i ścieżki odwoławczej do człowieka.', 4.9);
  src(s, ['rodo', 'ehds']);

  s = slide(p); head(s, 'Grupy docelowe', 'Trzy segmenty, trzy różne powody', 'segment → potrzeba → wielkość rynku → CAC → LTV');
  table(s, ['Segment', 'Potrzeba', 'Wielkość PL/UE', 'CAC', 'LTV'], [
    ['Biohackerzy 30–50 lat', 'Mają 3+ urządzenia, dane w 5 aplikacjach. Szukają korelacji.', '200 tys. / 2 mln', '80 PLN', '1 200 PLN'],
    ['Pacjenci metaboliczni', 'Stosy PDF-ów i chaos w lekach. Potrzebują cyfrowego archiwum.', '500 tys. / 5 mln+', '100 PLN', '1 500 PLN'],
    ['Opiekunowie 40–60 lat', 'Martwią się o rodziców. Zdalny monitoring i interpretacja wyników.', '800 tys. / 8 mln+', '120 PLN', '2 000 PLN'],
  ], 2.3, [2.5, 5.0, 2.0, 1.2, 1.5]);
  s.addText('Warianty produktu wskazane w źródłach: tryb fitness, panel dla lekarza, tryb dla przewlekle chorych.',
    { x: 0.55, y: 4.35, w: 12.2, h: 0.35, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  warn(s, 'LTV liczone było dla płatnej subskrypcji. Po przyjęciu modelu darmowego trzeba je przeliczyć od zera — z marży kanałów K3–K11 przypadającej na użytkownika, a nie z abonamentu.', 4.8);
  src(s, ['gvr']);

  s = slide(p); head(s, 'Granica regulacyjna', 'Wellness teraz, wyrób medyczny później', 'warstwa przeznaczenia → zakres funkcji → wymóg certyfikacji');
  cards(s, [['Warstwa A — poza MDR', 'Agregacja, przechowywanie i pokazywanie własnych danych, eksport. Zakres MVP.'],
            ['Warstwa B — poza MDR', 'Transkrypcja, dokumentacja, umawianie wizyt, prezentacja danych. Zakres MLP.'],
            ['Warstwa C — klasa IIa+', 'Interpretacja z oceną, alerty progowe z oceną kliniczną. Po certyfikacji.']], 2.3, 3);
  warn(s, 'Dziewięć funkcji MDSW pozostaje wyłączonych z zakresu niecertyfikowanego na podstawie MDCG 2019-11. Triaż AI i wstępna diagnoza nie mogą trafić do wersji przed certyfikacją. Osobno obowiązuje AI Act — system zdrowotny to wysokie ryzyko z załącznika III.', 4.3);
  src(s, ['mdcg', 'mdr', 'aiact']);

  s = slide(p); head(s, 'Zespół', 'Kto to buduje', 'osoba → rola → zakres odpowiedzialności');
  team(s, 2.3);
  s.addText('Model operacyjny lean: zespół core plus wyspecjalizowane software house\'y, hardware przez partnerów OEM, konsultanci medyczni rozliczani projektowo.',
    { x: 0.55, y: 4.65, w: 12.2, h: 0.5, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });

  s = slide(p); head(s, 'Finansowanie', 'Czego szukamy', 'etap → kwota → termin → equity → cel');
  table(s, ['Etap', 'Kwota', 'Termin', 'Equity', 'Cel'], [
    ['Pre-Seed', '110 tys. PLN', 'Q2 2026', '5–8%', 'MVP aplikacji: agregacja, OCR, dashboard'],
    ['Seed', '6,0–6,7 mln PLN', 'Q4 2026', '12–15%', 'Premium, telemedycyna, runway 18–24 mies.'],
  ], 2.3, [1.6, 2.3, 1.6, 1.4, 5.3]);
  warn(s, 'Budżet MVP 110 tys. PLN nie pokrywa opisanego zakresu. Master 5.4 wycenia go na 160–190 tys. przy orkiestracji i zaznacza, że wcześniejsze wyceny całkowicie pomijały wynagrodzenia. Do rozstrzygnięcia: albo zawęzić zakres, albo podnieść kwotę.', 4.1);
  src(s, ['gvr']);

  s = slide(p, true); head(s, 'Kontakt', 'Porozmawiajmy', null, true); kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_APLIKACJA.pptx' });
}

// ============ DECK EKOSYSTEMU (24 slajdy, struktura wg oficjalnego decku) ============
function deckEko() {
  NUM = 0; TOT = 26;
  const p = mk('Eternal Life — pitch ekosystemu');
  let s;

  cover(p, 'Pre-Seed · faza koncepcyjna', 'Rewolucja w prewencji zdrowotnej',
    'Pierwszy na świecie zintegrowany Health OS',
    'Ekosystem łączący aplikację mobilną, diagnostykę domową i nanotechnologię, aby przekształcić medycynę prewencyjną z reaktywnej w proaktywną.');

  s = slide(p); head(s, 'Problem I', 'Współczesna medycyna jest fragmentaryczna i opóźniona', 'trzy osie problemu → konsekwencja systemowa');
  cards(s, [['Rosnące obciążenie chorobami', 'Seniorzy i grupy ryzyka wymagają stałego monitoringu, a systemy opierają się na rzadkich wizytach.'],
            ['Późne diagnozy i brak prewencji', 'Diagnozy stawiane zbyt późno, gdy leczenie jest kosztowne i mniej skuteczne. Brak ostrzegania 24/7.'],
            ['Chaos informacyjny', 'Dane rozproszone w wielu systemach uniemożliwiają spójną analizę i ciągłość opieki.']], 2.3, 3);
  src(s, ['ehds']);

  s = slide(p); head(s, 'Problem II', 'Bariera ostatniej mili w analizie zdrowia', 'udział danych nieustrukturyzowanych → skutek dla predykcji');
  kpis(s, [['~80%', 'historii medycznej w PDF i skanach'], ['0', 'wspólnego kontekstu klinicznego'],
           ['5+', 'aplikacji na użytkownika'], ['brak', 'standardu wymiany danych']], 2.3);
  cards(s, [['Martwe dane', 'Nieczytelne dla algorytmów analitycznych, niewidoczne dla predykcji.'],
            ['Brak kontekstu klinicznego', 'Błędne predykcje i fałszywe alarmy, ignorujące przyczyny biomedyczne.'],
            ['Brak standaryzacji', 'Bez FHIR nie ma wymiany. Pacjent zostaje z informacją, bez możliwości działania.']], 3.6, 3);
  src(s, ['fhir', 'ehds']);

  s = slide(p); head(s, 'Rozwiązanie', 'Eternal Core Intelligence', 'filar → technologia → zakres integracji');
  cards(s, [['Import uniwersalny', 'OCR dowolnych dokumentów medycznych i konwersja na dane strukturalne.'],
            ['Synchronizacja niezależna', 'Jedno API integrujące dane ze wszystkich wiodących urządzeń noszonych.'],
            ['Logika medyczna', 'Korelacja wyników badań z danymi behawioralnymi — pełny kontekst kliniczny.']], 2.3, 3);
  warn(s, 'Źródła nowsze zamykają stos inaczej niż oficjalny deck: Flutter + FastAPI + FHIR R4B oraz Qdrant, BioMistral 7B i PubMedBERT, hosting w UE. Terra API wyceniona od 399 USD/mies., a nie jako koszt pomijalny.', 4.3);
  src(s, ['terra', 'fhir']);

  s = slide(p); head(s, 'Propozycja wartości', 'Od monitoringu do predykcji', 'wymiar wartości → co daje użytkownikowi');
  cards(s, [['Kompleksowość', 'Wszystkie narzędzia zdrowotne w jednym ekosystemie — od prewencji, przez diagnostykę, po terapię.'],
            ['Personalizacja', 'Algorytmy analizują unikalne dane biometryczne i dostarczają dopasowane rekomendacje.'],
            ['Prewencja', 'Przejście z reaktywnego leczenia na proaktywne zapobieganie, zanim wystąpią objawy.'],
            ['Dostępność', 'Zdalna opieka i diagnostyka w domu przez całą dobę, dla każdego pacjenta.']], 2.3, 4);
  src(s, ['ehds']);

  s = slide(p); head(s, 'Rynek', 'Analiza rynku i segmentacja', 'TAM → SAM → SOM · segmenty B2C i B2B · ekspansja');
  kpis(s, [['946 mld USD', 'rynek zdrowia cyfrowego w 2030'], ['22,2%', 'CAGR 2025–2030'],
           ['280 mld USD', 'SAM — rynki OECD'], ['~600 mln USD', 'SOM w roku piątym']], 2.3);
  cards(s, [['B2C — rynek konsumencki', 'Biohackerzy, opiekunowie pokolenia sandwich, pacjenci przewlekli.'],
            ['B2B — partnerzy instytucjonalni', 'Kliniki, ubezpieczyciele, pracodawcy i programy corporate wellness.'],
            ['Ekspansja geograficzna', 'Polska jako sandbox, następnie UE i DACH, potem USA dla skali.']], 3.6, 3);
  warn(s, 'Oficjalny deck podaje TAM 1,39 bln USD. Prognozy na 2030 mieszczą się w przedziale 573–946 mld USD; poziom 1,39 bln pojawia się dopiero w prognozach na lata 2032–2033. Slajd używa liczby zweryfikowanej wraz z rokiem, którego dotyczy.', 5.5);
  src(s, ['gvr', 'mnm', 'prec']);

  s = slide(p); head(s, 'Trendy rynkowe', 'Cztery siły kształtujące przyszłość medycyny', 'trend → mechanizm → wskaźnik');
  cards(s, [['Normalizacja telemedycyny', 'Pacjenci oczekują dostępu do specjalisty bez wychodzenia z domu. To standard, nie nowinka.'],
            ['AI w diagnostyce', 'Algorytmy analizują miliony punktów danych, wykrywając anomalie przed objawami.'],
            ['Wszechobecność IoT', 'Wearables przechodzą od gadżetów fitness do certyfikowanych narzędzi medycznych.'],
            ['Medycyna precyzyjna', 'Koniec podejścia jednego rozmiaru dla wszystkich — opieka oparta na danych.']], 2.3, 4);
  src(s, ['gvr', 'prec']);

  s = slide(p); head(s, 'Produkt', 'Cztery fazy do Health OS', 'faza → produkt → istota → model przychodu');
  table(s, ['Faza', 'Produkt', 'Istota', 'Model przychodu'], [
    ['1', 'Eternal Lite App', 'Portfel danych — OCR i integracja wearables', 'Darmowa; przychód z K3 i K7'],
    ['2', 'Eternal Premium', 'Kieszonkowa klinika — Bio-Physics, telemedycyna', 'K5 prowizje, K7 B2B'],
    ['3', 'Eternal Station', 'Domowe laboratorium i system dozowania', 'K2 hardware i wkłady'],
    ['4', 'Nanotech', 'Implanty i nanoboty — terapia celowana', 'K2 implant, K1 subskrypcja'],
  ], 2.3, [0.9, 2.8, 5.3, 3.2]);
  s.addText('Każda faza podnosi ARPU, barierę wejścia i unikalność danych. Wspólnym mianownikiem jest zintegrowana platforma AI.',
    { x: 0.55, y: 4.35, w: 12.2, h: 0.4, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });

  s = slide(p); head(s, 'Faza 1–2', 'Eternal Lite App i Premium', 'produkt → funkcje kluczowe → ekonomia');
  cards(s, [['Lite — portfel danych', 'Inteligentny parser OCR, uniwersalna synchronizacja, oś czasu zdrowia.'],
            ['Premium — centrum dowodzenia', 'Silnik Bio-Physics, telemedycyna, e-recepty przez P1, pulpit lekarza.'],
            ['Model', 'Aplikacja pacjenta darmowa; przychód z kanałów wokół niej.']], 2.3, 3);
  warn(s, 'Master 5.4: aplikacja pacjenta darmowa w całości. Plan operacyjny: 19–29 PLN. Oficjalny deck: 29,99/49,99 PLN. Budżet MVP w decku 110 tys. PLN, w specyfikacji 160–190 tys. przy orkiestracji, przy czym wcześniejsze wyceny pomijały wynagrodzenia.', 4.3);
  src(s, ['p1', 'mdcg']);

  s = slide(p); head(s, 'Faza 3', 'Eternal Station — domowe laboratorium', 'model sprzedaży → cena → koszt → marża');
  table(s, ['Model', 'Cena', 'Koszt', 'Marża'], [
    ['Zakup urządzenia', '1 499 PLN', 'BOM i montaż ~1 100 PLN', '20–30%'],
    ['Wkłady (subskrypcja)', '149 PLN/mies', 'odczynniki ~50 PLN', '60–70%'],
    ['HaaS — wynajem 24 mies.', '249 PLN/mies', 'opłata startowa 1 PLN', 'stały MRR'],
  ], 2.3, [3.3, 2.9, 3.7, 2.3]);
  s.addText('NXP i.MX 8M Plus z Edge AI · sensory EKG, SpO2, temperatura, ciśnienie · laboratorium mikrofluidyczne i spektrofotometria · prototyp Q2 2027, produkcja masowa Q1 2028.',
    { x: 0.55, y: 4.15, w: 12.2, h: 0.55, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  warn(s, 'Wariant ostrożny w Master 5.4 to certyfikacja cudzych urządzeń zamiast własnej produkcji. Producentem układu AD8232 jest Analog Devices, a nie Texas Instruments.', 4.8);
  src(s, ['mdr']);

  s = slide(p); head(s, 'Faza 3 — wykonanie', 'OEM, ODM czy produkcja własna', 'ścieżka → koszt → kontrola → szybkość');
  table(s, ['Ścieżka', 'Koszt', 'Kontrola', 'Szybkość'], [
    ['OEM / white-label (Shenzhen)', 'niższy CAPEX, BOM ~1 100 PLN', 'niska — zależna od dostawcy', 'najszybsza'],
    ['ODM — własny firmware i design', 'R&D 4 mln PLN, formy 1,8 mln PLN', 'wysoka', 'średnia'],
    ['Produkcja własna', 'najwyższy CAPEX, hard tooling', 'pełna nad jakością i łańcuchem', 'najwolniejsza'],
    ['Certyfikacja cudzych urządzeń', 'najniższy', 'średnia', 'najszybsza'],
  ], 2.3, [3.7, 3.6, 3.3, 1.6]);
  src(s, ['mdr']);

  s = slide(p); head(s, 'Faza 4', 'Nanotech i implanty', 'produkt → funkcja → zabezpieczenie → klasa MDR');
  cards(s, [['Bio-Tag / Bio-Monitor', 'Implanty podskórne: CGM glukozy i kortyzolu, NFC dla temperatury i HRV.'],
            ['Nanoboty (R&D)', 'Wczesna detekcja patogenów i terapia celowana z biodegradacją.'],
            ['Bezpieczeństwo', 'Bioglass 8625 wg ISO 10993, kill-switch sprzętowy, szyfrowanie transmisji.']], 2.3, 3);
  warn(s, 'Master 5.4 podnosi klasy: Bio-Tag z IIa na IIb, implant z I na IIb/III, pętla zamknięta z IIb na III. Ścieżka MDR klasy III to 3–8 mln PLN i certyfikacja realistycznie po 2033 — cztery lata później niż pilotaż deklarowany w decku. Zasada: wyłącznie odczyt, bez zdalnego sterowania funkcjami ciała.', 4.3);
  src(s, ['mdr', 'iso']);

  s = slide(p); head(s, 'Moonshoty', 'Projekty przełomowe — ocena wykonalności', 'projekt → TRL → koszt → alternatywa strategiczna');
  table(s, ['Projekt', 'TRL', 'Koszt', 'Alternatywa strategiczna'], [
    ['Implant Human (Closed Loop)', 'wysoki', '15 mln+ PLN', 'brak — źródło moatu, wymaga partnera Big Pharma'],
    ['Nanoboty (platforma)', 'bardzo wysoki', '50 mln+ PLN', 'poczekać, aż technologia dojrzeje, i licencjonować'],
    ['AGI Medyczna', 'ekstremalny', '50 mln+ PLN', 'fine-tuning modeli gigantów zamiast budowy od zera'],
    ['Przeniesienie świadomości', 'sci-fi', '100 mln+ przez 20 lat', 'konsorcja naukowe; poza horyzontem planu'],
  ], 2.3, [3.5, 1.7, 2.5, 4.5]);
  s.addText('Walidacja na linii zwierzęcej w reżimie CVMP zamiast MDR skraca drogę o 5–10 lat i jest traktowana jako obowiązkowy etap pośredni przed człowiekiem.',
    { x: 0.55, y: 4.65, w: 12.2, h: 0.5, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['mdr']);

  s = slide(p); head(s, 'Architektura', 'Od sygnałów do insightów klinicznych', 'warstwa → zakres techniczny');
  table(s, ['Warstwa', 'Zakres'], [
    ['01 Ingestion', 'Terra API dla urządzeń noszonych · OCR dokumentów medycznych'],
    ['02 Structuring', 'FHIR R4B · mapowanie SNOMED CT i LOINC'],
    ['03 Intelligence', 'RAG z guardrails · scoring i detekcja anomalii · Bio-Correlation'],
    ['04 Presentation', 'Dashboardy · oś czasu · insighty i plany działania'],
  ], 2.3, [2.4, 9.8]);
  s.addText('Moduły kontrolne K1–K14 nadzorują funkcje ryzykowne. Bez K5 panel lekarza jest nielegalny i nie pobierzesz danych z P1; bez K10 nie ma dossier technicznego.',
    { x: 0.55, y: 4.5, w: 12.2, h: 0.55, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['fhir', 'p1']);

  s = slide(p); head(s, 'Zaufanie', 'Bezpieczeństwo i zgodność regulacyjna', 'obszar → mechanizm → reżim prawny');
  cards(s, [['Szyfrowanie E2E', 'AES-256 i TLS 1.3, dane surowe pozostają na urządzeniu użytkownika.'],
            ['Integralność zapisu', 'Na łańcuchu wyłącznie hasze i znaczniki czasu — nigdy dane osobowe.'],
            ['Nadzór nad AI', 'Zarządzanie ryzykiem, dokumentacja, nadzór człowieka, rejestr zdarzeń.'],
            ['Zgodność wyrobu', 'MDR, IVDR, ISO 13485 i 14971, odpowiedzialność za produkt.']], 2.3, 4);
  warn(s, 'Deklaracja niezmienności dokumentacji w rejestrze rozproszonym kłóci się z prawem do usunięcia danych (RODO art. 17). Rozwiązanie: na łańcuchu wyłącznie hasze. Do listy zgodności dochodzą pozycje nieobecne w decku: IVDR, dyrektywa 2024/2853, AI Act oraz NIS2 z karami do 10 mln EUR.', 4.3);
  src(s, ['rodo', 'aiact', 'mdr', 'nis2']);

  s = slide(p); head(s, 'Model biznesowy', 'Jedenaście kanałów wokół darmowej aplikacji', 'kanał → nazwa → istota i stawka');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(0, 6), 2.3, [1.0, 3.5, 7.7]);
  s.addText('Pacjent nie płaci. Płacą ci, którzy na jego zdrowiu zarabiają lub oszczędzają: płatnicy, przychodnie, partnerzy marketplace.',
    { x: 0.55, y: 4.75, w: 12.2, h: 0.4, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });
  src(s, ['rodo']);

  s = slide(p); head(s, 'Model biznesowy', 'Kanały K6–K11 — płatnicy, przychodnie, fitness, choroby przewlekłe', 'kanał → nazwa → istota i stawka');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(6), 2.3, [1.0, 3.5, 7.7]);
  warn(s, 'Kanał K6 to profilowanie z art. 22 RODO w połączeniu z art. 9: wymaga wyraźnej, odrębnej i w pełni opcjonalnej zgody, prawa do interwencji człowieka i oceny skutków. Zgoda warunkująca dostęp do funkcji może zostać uznana za nieswobodną.', 4.9);
  src(s, ['rodo', 'ehds']);

  s = slide(p); head(s, 'Macierz funkcji', 'Co zarabia, co jest potrzebne, co się dubluje', 'funkcja → kanał → potrzeba → duplikacja w efekcie');
  kpis(s, [['337', 'funkcji w macierzy'], ['314', 'z przypisanym kanałem'],
           ['23', 'funkcje fundamentowe'], ['31', 'objętych duplikacją']], 2.3);
  table(s, ['Grupa duplikacji w efekcie końcowym', 'Funkcje', 'Na czym polega'], [
    ['Pomiar glukozy', 'S1.5, C2.1', 'Station mierzy punktowo, Capsule ciągle — ten sam wynik dla pacjenta'],
    ['Telemedycyna', 'A5.1, S4.1', 'Ta sama konsultacja z aplikacji i ze stacji'],
    ['Alert ratunkowy', 'A5.3, A14.1, S4.2', 'Trzy drogi do tego samego: wezwanie pomocy'],
    ['Wywiad przez AI', 'A5.5, A12.3, A12.4', 'Trzy kody funkcji, jeden efekt: zebranie wywiadu'],
  ], 3.6, [3.5, 2.7, 6.0]);

  s = slide(p); head(s, 'Go-to-market', 'Ekspansja geograficzna i kanały sprzedaży', 'faza → rynek → kanał → cel');
  table(s, ['Faza', 'Rynek', 'Kanały', 'Cel'], [
    ['1 · 2026', 'Polska — sandbox i walidacja', 'Sklepy aplikacji, content marketing, SEO medyczne', '10 tys. użytkowników'],
    ['2 · 2027', 'DACH — wysokie ARPU', 'Prywatne kliniki, ubezpieczyciele, ścieżka DiGA', '100 tys. użytkowników'],
    ['3 · 2028–29', 'UE szeroko — B2B2C', 'Ubezpieczyciele, programy wellness, apteki', '1 mln użytkowników'],
    ['4 · 2030+', 'USA i Azja', 'Po zatwierdzeniu FDA, partnerstwa globalne', 'skala globalna'],
  ], 2.3, [1.6, 3.4, 4.9, 2.3]);
  warn(s, 'Wpis do rejestru DiGA wymaga oznakowania CE jako wyrobu medycznego i dowodu pozytywnego efektu zdrowotnego; przy wpisie warunkowym producent ma rok, wyjątkowo dwa, na dostarczenie badania. To projekt na 18–30 miesięcy z własnym budżetem, a nie konsekwencja ekspansji.', 4.5);
  src(s, ['diga', 'ehds']);

  s = slide(p); head(s, 'Konkurencja', 'Fragmentacja kontra integracja', 'obszar → gracze → luka wobec Eternal');
  table(s, ['Obszar', 'Gracze', 'Luka wobec Eternal'], [
    ['Aplikacja i dane', '1upHealth, Redox, Human API', 'brak interfejsu pacjenta, tylko middleware B2B, brak analityki AI'],
    ['Diagnostyka domowa', 'Cue Health, Everlywell, Labcorp Pixel', 'wąski zakres testów, wolny proces wysyłkowy, brak integracji stylu życia'],
    ['Nanotechnologia', 'Nanovis, Axoft, OncoRevive', 'skupienie na ortopedii, tylko neuro-tech, wąskie zastosowanie onkologiczne'],
  ], 2.3, [2.5, 3.9, 5.8]);
  s.addText('Konkurencja działa w silosach. Eternal łączy dane w standardzie FHIR, diagnostykę domową i interwencję w jeden zamknięty ekosystem opieki.',
    { x: 0.55, y: 4.5, w: 12.2, h: 0.45, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });

  s = slide(p); head(s, 'Przewagi', 'Dlaczego wygrywamy', 'przewaga → na czym polega');
  cards(s, [['Zintegrowany ekosystem', 'Software, hardware i wetware w jednej spójnej całości — bez żonglowania narzędziami.'],
            ['Closed-Loop Care', 'Zmierz, zdiagnozuj, interweniuj. Nie tylko wykrywamy problem, ale wdrażamy interwencję.'],
            ['Fosa danych', 'Unikalne korelacje behawioralno-kliniczne. Silnik uczy się z każdym użytkownikiem.'],
            ['Regulatory-by-Design', 'System projektowany od podstaw pod CE MDR i FDA, co buduje zaufanie partnerów B2B.']], 2.3, 4);
  s.addText('Pozycjonowanie: strategia błękitnego oceanu — nowa kategoria Health OS na przecięciu osi zintegrowany i proaktywny.',
    { x: 0.55, y: 4.35, w: 12.2, h: 0.4, fontSize: 10.5, color: SZARY, fontFace: BF, margin: 0, isTextBox: true });

  s = slide(p); head(s, 'Zespół', 'Zespół założycielski', 'osoba → rola → zakres odpowiedzialności');
  team(s, 2.3);
  warn(s, 'Plan operacyjny opisuje skład inaczej: Janek jako CTO, Adrian jako CTO Hardware, Wiktor jako CMO/Medical Director, Karol jako CAO. Deck lokuje siedzibę w Warszawie, plan operacyjny w Poznaniu. Do uzgodnienia przed wysyłką do inwestora.', 4.7);

  s = slide(p); head(s, 'Finanse', 'Prognozy pięcioletnie i luka w finansowaniu', 'rok → przychody → EBITDA → skumulowana strata');
  table(s, ['Rok', 'Przychody', 'EBITDA', 'Skumulowana strata'], [
    ['2027', '85 tys. PLN', '−1,62 mln PLN', '−1,62 mln PLN'],
    ['2028', '513 tys. PLN', '−2,45 mln PLN', '−4,07 mln PLN'],
    ['2029', '1,97 mln PLN', '−3,19 mln PLN', '−7,26 mln PLN'],
    ['2030', '6,50 mln PLN', '−0,85 mln PLN', '−8,11 mln PLN'],
    ['2031', '18,50 mln PLN', '+1,56 mln PLN', 'próg rentowności'],
  ], 2.3, [1.3, 2.9, 3.0, 5.0]);
  warn(s, 'Suma strat przed progiem rentowności to −8,11 mln PLN, a kapitał do rundy A to 6,11–6,81 mln PLN. Brakuje 1,3–2,0 mln PLN, a runda A nie ma w decku daty. Wycena 200 mln USD przy przychodzie 18,5 mln PLN to mnożnik około 45×, przy rynkowych 3–10× dla digital health.', 5.15);
  src(s, ['gvr']);

  s = slide(p); head(s, 'Finansowanie', 'Struktura finansowania', 'etap → kwota → termin → equity → cel');
  table(s, ['Etap', 'Kwota', 'Termin', 'Equity', 'Cel'], [
    ['Pre-Seed', '110 tys. PLN', 'Q2 2026', '5–8%', 'MVP software; frontend 50k, backend 40k, UX 10k, prawne 10k'],
    ['Seed', '6,0–6,7 mln PLN', 'Q4 2026', '12–15%', 'Ekosystem; runway 18–24 mies.; dev 40%, marketing 25%, hardware 20%'],
    ['Runda A', '20 mln PLN', 'wymagana 2029', 'do ustalenia', 'Ekspansja DACH, pełny AI Coach, oferta B2B'],
    ['Runda B', '50 mln+ PLN', 'do ustalenia', 'do ustalenia', 'USA i Azja, własne wearables, R&D nanoboty'],
  ], 2.3, [1.5, 2.1, 1.7, 1.5, 5.4]);
  warn(s, 'Pre-seed implikuje wycenę post-money 1,4–2,2 mln PLN, seed 40–56 mln PLN — skok 20–40× w dwa kwartały przy jednym kamieniu milowym. Trudne do obrony przed inwestorem seed.', 4.75);

  s = slide(p); head(s, 'Ryzyko', 'Analiza ryzyk i strategia mitygacji', 'ryzyko → poziom → zagrożenie → mitygacja');
  table(s, ['Ryzyko', 'Poziom', 'Zagrożenie', 'Mitygacja'], [
    ['Regulacyjne', 'WYSOKIE', 'Opóźnienia CE MDR i FDA; AI Act jako osobny reżim', 'Etapowo wellness → medical, wcześni eksperci RA'],
    ['Prawne — dane', 'WYSOKIE', 'Scoring dla ubezpieczycieli to profilowanie z art. 22', 'Osobna, opcjonalna zgoda i ścieżka odwoławcza'],
    ['Licencyjne', 'WYSOKIE', 'Gadgetbridge na AGPL-3.0 blokuje model komercyjny', 'Własny adapter zamiast forka; audyt licencji'],
    ['Technologiczne', 'WYSOKIE', 'Złożoność hardware i niepewność B+R nanotechnologii', 'Modułowa roadmapa, outsourcing OEM'],
    ['Adopcja rynkowa', 'ŚREDNIE', 'Wolniejsza adopcja, opór przed zaufaniem do AI', 'Darmowa aplikacja obniża barierę wejścia'],
  ], 2.3, [1.9, 1.2, 4.6, 4.5]);
  src(s, ['rodo', 'aiact', 'agpl']);

  s = slide(p, true); head(s, 'Kontakt', 'Porozmawiajmy', null, true); kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_EKOSYSTEM.pptx' });
}

deckApp().then(f => { console.log('OK', f); return deckEko(); })
  .then(f => console.log('OK', f))
  .catch(e => { console.error('ERR', e); process.exit(1); });
