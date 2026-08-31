const pptxgen = require('pptxgenjs');

// Paleta z oficjalnego pitch decku
const NAVY = '0A1330', CARD = '16234E', LINE = '243A6E';
const CYAN = '7FD4E8', WHITE = 'FFFFFF', MUTED = '9FB2D8', BODY = 'C8D5F0';
const AMBER = 'E0A33E';
const HF = 'Cambria', BF = 'Calibri';
const WWW = 'eternallife24.pages.dev';
const MAIL = 'office.eternal.life@gmail.com';
const TEL = '+48 784 407 991';

function mk(title) {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'Eternal Life';
  p.company = 'Eternal Life';
  p.title = title;
  p.defineSlideMaster({
    title: 'ETERNAL',
    background: { color: NAVY },
    objects: [
      { rect: { x: 0.55, y: 0.34, w: 0.26, h: 0.26, fill: { color: CYAN }, rectRadius: 0.05, line: { color: CYAN } } },
      { text: { text: 'E', options: { x: 0.55, y: 0.34, w: 0.26, h: 0.26, align: 'center', valign: 'middle',
        fontSize: 13, bold: true, color: NAVY, fontFace: BF, margin: 0, isTextBox: true } } },
      { text: { text: 'ETERNALLIFE', options: { x: 0.88, y: 0.34, w: 2.4, h: 0.26, valign: 'middle',
        fontSize: 11, bold: true, color: WHITE, charSpacing: 2, fontFace: BF, margin: 0, isTextBox: true } } },
      { text: { text: WWW, options: { x: 10.2, y: 6.95, w: 2.6, h: 0.3, align: 'right', valign: 'middle',
        fontSize: 9, color: '5F7CB8', fontFace: BF, margin: 0, isTextBox: true } } },
    ],
  });
  return p;
}

function head(s, kick, title, sub) {
  s.addText(kick, { x: 0.55, y: 0.82, w: 11.5, h: 0.26, fontSize: 11, bold: true,
    color: CYAN, charSpacing: 2, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(title, { x: 0.55, y: 1.1, w: 12.2, h: 0.75, fontSize: 34, bold: true,
    color: WHITE, fontFace: HF, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: 0.55, y: 1.87, w: 12.2, h: 0.4, fontSize: 15,
    color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
}

function cards(s, items, y, cols) {
  cols = cols || items.length;
  const gap = 0.28, x0 = 0.55, tot = 12.2;
  const w = (tot - gap * (cols - 1)) / cols;
  items.forEach((it, i) => {
    const cx = x0 + (i % cols) * (w + gap);
    const cy = y + Math.floor(i / cols) * 2.0;
    s.addShape('roundRect', { x: cx, y: cy, w: w, h: 1.82, fill: { color: CARD },
      line: { color: LINE, width: 1 }, rectRadius: 0.08 });
    s.addText(it[0], { x: cx + 0.22, y: cy + 0.16, w: w - 0.44, h: 0.4, fontSize: 14, bold: true,
      color: CYAN, fontFace: BF, margin: 0, isTextBox: true });
    s.addText(it[1], { x: cx + 0.22, y: cy + 0.58, w: w - 0.44, h: 1.1, fontSize: 11.5,
      color: BODY, fontFace: BF, margin: 0, isTextBox: true, valign: 'top' });
  });
}

function kpis(s, items, y) {
  const gap = 0.26, x0 = 0.55, tot = 12.2;
  const w = (tot - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const cx = x0 + i * (w + gap);
    s.addShape('roundRect', { x: cx, y: y, w: w, h: 1.15, fill: { color: CARD },
      line: { color: LINE, width: 1 }, rectRadius: 0.08 });
    s.addText(it[0], { x: cx + 0.18, y: y + 0.14, w: w - 0.36, h: 0.5, fontSize: 24, bold: true,
      color: CYAN, fontFace: HF, margin: 0, isTextBox: true });
    s.addText(it[1], { x: cx + 0.18, y: y + 0.66, w: w - 0.36, h: 0.4, fontSize: 10,
      color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
  });
}

function table(s, head_, rows, y, colW) {
  const body = [head_.map(h => ({ text: h, options: { bold: true, color: CYAN, fill: { color: CARD }, fontSize: 11 } }))];
  rows.forEach(r => body.push(r.map(c => ({ text: String(c), options: { color: BODY, fontSize: 10.5 } }))));
  s.addTable(body, { x: 0.55, y: y, w: 12.2, colW: colW, border: { pt: 0.5, color: LINE },
    fontFace: BF, valign: 'top', autoPage: false });
}

function warn(s, txt, y) {
  s.addShape('roundRect', { x: 0.55, y: y, w: 12.2, h: 0.95, fill: { color: '2A1C10' },
    line: { color: '6B4A1E', width: 1 }, rectRadius: 0.06 });
  s.addText([{ text: 'Korekta wobec kanonu wewnętrznego: ', options: { bold: true, color: AMBER } },
             { text: txt, options: { color: 'F3DDB8' } }],
    { x: 0.78, y: y + 0.12, w: 11.75, h: 0.72, fontSize: 10.5, fontFace: BF, margin: 0, isTextBox: true });
}

function bullets(s, items, x, y, w, h) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
    { x: x, y: y, w: w, h: h, fontSize: 12.5, color: BODY, fontFace: BF,
      paraSpaceAfter: 6, margin: 0, isTextBox: true });
}

function cover(p, kick, t1, t2, lead) {
  const s = p.addSlide({ masterName: 'ETERNAL' });
  s.addShape('roundRect', { x: 0.55, y: 1.5, w: 12.2, h: 0.34, fill: { color: CARD }, line: { color: LINE }, rectRadius: 0.1 });
  s.addText(kick, { x: 0.75, y: 1.5, w: 11.8, h: 0.34, valign: 'middle', fontSize: 10.5, bold: true,
    color: CYAN, charSpacing: 2, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(t1, { x: 0.55, y: 2.05, w: 12.2, h: 1.0, fontSize: 44, bold: true, color: WHITE, fontFace: HF, margin: 0, isTextBox: true });
  s.addText(t2, { x: 0.55, y: 3.05, w: 12.2, h: 0.5, fontSize: 19, color: CYAN, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(lead, { x: 0.55, y: 3.7, w: 9.6, h: 1.0, fontSize: 14, color: BODY, fontFace: BF, margin: 0, isTextBox: true });
  s.addText(`Maksymilian Pruss — Założyciel i CEO\n${MAIL}  ·  ${TEL}\n${WWW}`,
    { x: 0.55, y: 5.6, w: 8.0, h: 1.1, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
  return s;
}

function team(s) {
  const Z = [
    ['Maksymilian Pruss', 'Założyciel & CEO', 'Architekt ekosystemu Health OS. Dwa lata R&D w trybie stealth, pełna specyfikacja techniczna, model biznesowy i strategia regulacyjna.'],
    ['Adrian Hołubcki', 'CTO', 'Lider technologiczny. Ekspert w skalowaniu systemów rozproszonych. GCP, cyberbezpieczeństwo, nadzór nad developmentem.'],
    ['Wiktor Zawiślak', 'CMO — Chief Medical Officer', 'Medyczne sumienie projektu. Wiarygodność kliniczna silnika Bio-Physics, zgodność kliniczna, triaż AI.'],
    ['Karol Tyszka', 'CAO — Chief Advisor Officer', 'Strategiczne wsparcie zarządu. Relacje inwestorskie i partnerstwa biznesowe.'],
  ];
  const gap = 0.28, w = (12.2 - gap * 3) / 4;
  Z.forEach((z, i) => {
    const cx = 0.55 + i * (w + gap);
    s.addShape('roundRect', { x: cx, y: 2.45, w: w, h: 2.5, fill: { color: CARD }, line: { color: LINE, width: 1 }, rectRadius: 0.08 });
    s.addText(z[0], { x: cx + 0.2, y: 2.62, w: w - 0.4, h: 0.4, fontSize: 14, bold: true, color: WHITE, fontFace: BF, margin: 0, isTextBox: true });
    s.addText(z[1], { x: cx + 0.2, y: 3.0, w: w - 0.4, h: 0.32, fontSize: 10.5, color: CYAN, fontFace: BF, margin: 0, isTextBox: true });
    s.addText(z[2], { x: cx + 0.2, y: 3.38, w: w - 0.4, h: 1.45, fontSize: 10.5, color: BODY, fontFace: BF, margin: 0, isTextBox: true });
  });
}

function kontakt(s) {
  cards(s, [
    ['Założyciel & CEO', `Maksymilian Pruss\n${MAIL}`],
    ['Telefon', `${TEL}\nOdpowiadamy na zapytania inwestorskie w ciągu 24 h.`],
    ['Strona i siedziba', `${WWW}\nWarszawa, Polska (HQ)`],
  ], 2.6, 3);
  s.addText('Jesteśmy na etapie Pre-Seed i aktywnie poszukujemy partnerów strategicznych oraz inwestorów.',
    { x: 0.55, y: 4.9, w: 12.2, h: 0.5, fontSize: 13, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
}

// ---------- MODEL MONETYZACJI (rozstrzygniety) ----------
const MONET = [
  ['K0', 'Aplikacja pacjenta — DARMOWA', 'Zero opłat dla pacjenta. Warunek skali i jakości zbioru danych.'],
  ['K1', 'Subskrypcje niepacjenckie', 'Pet, Vault/Legacy, immersja premium — poza rdzeniem pacjenta.'],
  ['K2', 'Hardware + wkłady', 'Station: zakup 1 499 PLN lub HaaS 249 PLN/mies; wkłady 149 PLN/mies.'],
  ['K3', 'API i eksport danych', 'Płatny dostęp programistyczny; dane wyłącznie zagregowane i zanonimizowane.'],
  ['K4', 'Eternal Token i Forge', 'Gospodarka wewnętrzna marketplace modułów i IP.'],
  ['K5', 'Prowizje marketplace', 'Telemedycyna 20–30%, laboratoria 5–15%, apteka i suplementy.'],
  ['K6', 'Płatnicy i ubezpieczyciele', 'Scoring B2B, składka pay-as-you-live, programy prewencyjne.'],
  ['K7', 'Przychodnie i lekarze', 'Eternal Assist (AI Scribe) 99–199 PLN/mies za gabinet; PUPM 15–25 PLN.'],
  ['K8', 'Granty i dotacje', 'NCBR do 500 tys. bez wkładu własnego, PARP, FENG, Horizon Europe.'],
  ['K9', 'Licencjonowanie IP', 'Royalty 5–15% z Fundacji do spółki; white-label dla partnerów.'],
  ['K10', 'Fitness i wellness', 'Plany treningowe, suplementacja, Auto-Refill, corporate wellness.'],
  ['K11', 'Choroby przewlekłe', 'Pakiety dla diabetyków, kardiologii i zdrowia psychicznego — B2B klinika.'],
];

// =======================================================
//                 DECK 1 — APLIKACJA
// =======================================================
function deckApp() {
  const p = mk('Eternal App — pitch aplikacji');
  let s;

  cover(p, 'PRE-SEED · APLIKACJA', 'Eternal App',
    'Zintegrowana platforma danych zdrowotnych',
    'Aplikacja, która zbiera rozproszoną historię medyczną w jedno miejsce i zamienia ją w dane, na których da się działać. Rozwiązujemy problem ostatniej mili.');

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'PROBLEM', '80% historii medycznej jest niewidoczne dla algorytmów');
  cards(s, [
    ['Martwe dane', 'Wyniki badań siedzą w PDF-ach, zdjęciach i skanach. Standardowe algorytmy ich nie widzą.'],
    ['Brak kontekstu', 'Smartwatch widzi słaby sen, ale nie widzi niskiej ferrytyny ukrytej w PDF. Predykcje są błędne.'],
    ['Brak działania', 'Bez standardu FHIR nie ma wymiany danych. Pacjent dostaje informację, nie możliwość działania.'],
  ], 2.5, 3);
  s.addText('„Obecny system jest zaprojektowany do leczenia chorób, a nie utrzymania zdrowia."',
    { x: 0.55, y: 4.75, w: 12.2, h: 0.5, fontSize: 14, italic: true, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
  s.addNotes('Problem ostatniej mili: dane istnieją, ale są nieczytelne dla maszyn i pozbawione kontekstu klinicznego.');

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ROZWIĄZANIE', 'Eternal Core Intelligence', 'Trzy filary aplikacji');
  cards(s, [
    ['Import uniwersalny', 'Skan dowolnego dokumentu medycznego i konwersja na dane strukturalne w standardzie FHIR.'],
    ['Synchronizacja niezależna', 'Jedno API do wszystkich wiodących wearables: Apple, Garmin, Oura, Whoop, Fitbit.'],
    ['Logika medyczna', 'Korelacja twardych wyników badań z miękkimi danymi behawioralnymi — Bio-Correlation.'],
  ], 2.6, 3);
  kpis(s, [['16', 'modułów A1–A16'], ['337', 'funkcji w macierzy'], ['201', 'funkcji aplikacji'], ['6', 'etapów realnych']], 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MODUŁY', 'Co aplikacja faktycznie robi', '16 modułów, 201 funkcji przypisanych do aplikacji');
  table(s, ['Moduły', 'Zakres', 'Etap'], [
    ['A1–A2', 'Agregacja danych z wearables i OCR dokumentów medycznych', 'MVP'],
    ['A3–A4', 'Dashboard, alerty, Bio-Weather, raporty i eksport', 'MVP'],
    ['A5–A6', 'Telemedycyna oraz AI/RAG z guardrails i cytowaniem źródeł', 'MLP'],
    ['A7–A8', 'Planowanie, rekomendacje, zdrowie psychiczne (Crisis Redirect 116 123)', 'MLP'],
    ['A9–A12', 'Społeczność, marketplace, regionalizacja, automatyczna dokumentacja', 'MLP–FINAL'],
    ['A13–A16', 'Pet, powiadomienia i eskalacja, Fundacja/Hub, Eternal Forge', 'FINAL'],
  ], 2.5, [1.6, 8.4, 2.2]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MONETYZACJA', 'Aplikacja pacjenta jest darmowa', 'Przychód pochodzi z jedenastu kanałów wokół niej, nie z opłaty za dostęp');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(0, 7).map(m => [m[0], m[1], m[2]]), 2.5, [1.0, 3.6, 7.6]);
  s.addNotes('Model rozstrzygnięty: darmowa aplikacja pacjenta, monetyzacja na płatnikach, przychodniach, fitnessie i chorobach przewlekłych.');

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MONETYZACJA', 'Kanały K7–K11 — tam, gdzie są pieniądze');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(7).map(m => [m[0], m[1], m[2]]), 2.4, [1.0, 3.6, 7.6]);
  warn(s, 'Cennik to najbardziej rozjechana pozycja w korpusie: oficjalny deck 29,99/49,99 PLN, checklisty 49 PLN, plan operacyjny 19–29 PLN, a Master 5.4 mówi, że aplikacja pacjenta jest darmowa w całości. Ten deck przyjmuje wersję z Master 5.4 jako najnowszą i najlepszą dla projektu.', 5.55);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ARCHITEKTURA', 'Od sygnału do wniosku klinicznego');
  table(s, ['Warstwa', 'Zakres'], [
    ['01 Ingestion', 'Terra API (wearables) · OCR dokumentów (Google Document AI)'],
    ['02 Structuring', 'FHIR R4B · mapowanie SNOMED CT i LOINC'],
    ['03 Intelligence', 'RAG z guardrails · scoring i detekcja anomalii · Bio-Correlation'],
    ['04 Presentation', 'Dashboardy · oś czasu zdrowia · raport SBAR dla lekarza'],
  ], 2.4, [2.6, 9.6]);
  s.addText('Decyzje oznaczone w źródłach jako zamknięte: Flutter + FastAPI + FHIR R4B, RAG na Qdrant + BioMistral 7B + PubMedBERT, dane surowe pozostają na urządzeniu, hosting w UE ze względu na RODO.',
    { x: 0.55, y: 5.05, w: 12.2, h: 0.7, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'GRUPY DOCELOWE', 'Trzy segmenty, trzy różne powody', 'Do tego trzy warianty produktu: fitness, panel lekarza, tryb dla przewlekle chorych');
  table(s, ['Segment', 'Potrzeba', 'Wielkość PL/UE', 'CAC', 'LTV', 'ROI'], [
    ['Biohackerzy 30–50 lat', 'Mają 3+ urządzenia, dane w 5 aplikacjach. Szukają korelacji.', '200 tys. / 2 mln', '80 PLN', '1 200 PLN', '15×'],
    ['Pacjenci metaboliczni', 'Stosy PDF-ów i chaos w lekach. Potrzebują archiwum.', '500 tys. / 5 mln+', '100 PLN', '1 500 PLN', '15×'],
    ['Opiekunowie 40–60 lat', 'Martwią się o rodziców. Zdalny monitoring i interpretacja.', '800 tys. / 8 mln+', '120 PLN', '2 000 PLN', '16×'],
  ], 2.6, [2.6, 4.6, 2.0, 1.0, 1.1, 0.9]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'GRANICA REGULACYJNA', 'Wellness teraz, wyrób medyczny później');
  cards(s, [
    ['Warstwa A — poza MDR', 'Agregacja, przechowywanie i pokazywanie własnych danych, eksport. Zakres MVP.'],
    ['Warstwa B — poza MDR', 'Transkrypcja, dokumentacja, umawianie wizyt, prezentacja danych. Zakres MLP.'],
    ['Warstwa C — klasa IIa+', 'Interpretacja z oceną, alerty progowe z oceną kliniczną. Dopiero po certyfikacji.'],
  ], 2.5, 3);
  warn(s, 'Dziewięć funkcji MDSW pozostaje wyłączonych z zakresu niecertyfikowanego na podstawie MDCG 2019-11: system trójkolorowy, klasyfikacja norma/choroba, e-skierowanie i integracja EHR/EMR. Triaż AI i wstępna diagnoza nie mogą trafić do wersji przed certyfikacją.', 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ZESPÓŁ', 'Kto to buduje');
  team(s);
  s.addText('Model operacyjny lean: zespół core plus wyspecjalizowane software house\'y, hardware przez partnerów OEM, konsultanci medyczni ad hoc.',
    { x: 0.55, y: 5.15, w: 12.2, h: 0.5, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'KONTAKT', 'Porozmawiajmy', 'Etap Pre-Seed — szukamy partnerów strategicznych i inwestorów');
  kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_APLIKACJA.pptx' });
}

// =======================================================
//              DECK 2 — CAŁY EKOSYSTEM
// =======================================================
function deckEko() {
  const p = mk('Eternal Life — pitch ekosystemu');
  let s;

  cover(p, 'PRE-SEED · FAZA KONCEPCYJNA', 'Rewolucja w prewencji zdrowotnej',
    'Pierwszy na świecie zintegrowany Health OS',
    'Ekosystem łączący aplikację mobilną, diagnostykę domową i nanotechnologię, aby przekształcić medycynę prewencyjną z reaktywnej w proaktywną.');

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'PROBLEM I', 'Współczesna medycyna jest fragmentaryczna i opóźniona');
  cards(s, [
    ['Rosnące obciążenie chorobami', 'Seniorzy i grupy ryzyka wymagają stałego monitoringu, a systemy opierają się na rzadkich wizytach.'],
    ['Późne diagnozy', 'Diagnozy stawiane są zbyt późno, gdy leczenie jest kosztowne i mniej skuteczne. Brak ostrzegania 24/7.'],
    ['Chaos informacyjny', 'Dane rozproszone w wielu systemach uniemożliwiają spójną analizę i ciągłość opieki.'],
  ], 2.5, 3);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'PROBLEM II', 'Bariera ostatniej mili w analizie zdrowia');
  kpis(s, [['~80%', 'historii medycznej zamkniętej w PDF i skanach'], ['0', 'wspólnego kontekstu klinicznego'],
           ['5+', 'aplikacji na jednego użytkownika'], ['brak', 'standardu wymiany danych']], 2.45);
  cards(s, [
    ['Martwe dane', 'Nieczytelne dla algorytmów analitycznych — całkowicie niewidoczne dla predykcji.'],
    ['Brak kontekstu klinicznego', 'Błędne predykcje i fałszywe alarmy, ignorujące przyczyny biomedyczne.'],
    ['Brak standaryzacji', 'Bez FHIR nie ma wymiany. Pacjent zostaje z informacją, bez możliwości działania.'],
  ], 3.85, 3);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ROZWIĄZANIE', 'Eternal Core Intelligence', 'Uniwersalny translator dla rozproszonych danych zdrowotnych');
  cards(s, [
    ['Import uniwersalny', 'OCR dowolnych dokumentów medycznych i konwersja na dane strukturalne.'],
    ['Synchronizacja niezależna', 'Jedno API integrujące dane ze wszystkich wiodących wearables.'],
    ['Logika medyczna', 'Korelacja wyników badań z danymi behawioralnymi — pełny kontekst.'],
  ], 2.6, 3);
  warn(s, 'Źródła nowsze zamykają stos inaczej niż oficjalny deck: Flutter + FastAPI + FHIR R4B oraz Qdrant + BioMistral 7B + PubMedBERT, hosting w UE. Terra API wyceniona od 399 USD/mies., a nie jako koszt pomijalny.', 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'RYNEK', 'Analiza rynku i segmentacja');
  kpis(s, [['1,39 bln USD', 'TAM — zdrowie cyfrowe'], ['280 mld USD', 'SAM — rynki OECD'],
           ['~600 mln USD', 'SOM — docelowy ARR w roku 5'], ['22%', 'CAGR zdrowia cyfrowego']], 2.45);
  cards(s, [
    ['B2C — rynek konsumencki', 'Biohackerzy, opiekunowie pokolenia sandwich, pacjenci przewlekli.'],
    ['B2B — partnerzy instytucjonalni', 'Kliniki, ubezpieczyciele, pracodawcy i programy corporate wellness.'],
    ['Ekspansja geograficzna', 'Polska jako sandbox, następnie UE/DACH o wysokim ARPU, potem USA dla skali.'],
  ], 3.85, 3);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'PRODUKT', 'Cztery fazy do Health OS', 'Każda faza podnosi ARPU, barierę wejścia i unikalność danych');
  table(s, ['Faza', 'Produkt', 'Istota', 'Model przychodu'], [
    ['1', 'Eternal Lite App', 'Portfel danych — OCR i integracja wearables', 'Darmowa; przychód z K3, K7'],
    ['2', 'Eternal Premium', 'Kieszonkowa klinika — Bio-Physics, telemedycyna', 'K5 prowizje, K7 B2B'],
    ['3', 'Eternal Station', 'Domowe laboratorium i system dozowania', 'K2 hardware i wkłady'],
    ['4', 'Nanotech', 'Implanty i nanoboty — terapia celowana', 'K2 implant, K1 subskrypcja'],
  ], 2.6, [0.9, 2.9, 5.2, 3.2]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MODEL BIZNESOWY', 'Jedenaście kanałów wokół darmowej aplikacji', 'Rozstrzygnięcie: pacjent nie płaci — płacą ci, którzy na jego zdrowiu zarabiają lub oszczędzają');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(0, 6).map(m => [m[0], m[1], m[2]]), 2.6, [1.0, 3.6, 7.6]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MODEL BIZNESOWY', 'Kanały K6–K11 — płatnicy, przychodnie, fitness, choroby przewlekłe');
  table(s, ['Kanał', 'Nazwa', 'Istota'], MONET.slice(6).map(m => [m[0], m[1], m[2]]), 2.4, [1.0, 3.6, 7.6]);
  warn(s, 'Master 5.4 rozstrzyga, że aplikacja pacjenta jest darmowa w całości. Ten deck przyjmuje to jako wersję obowiązującą i przenosi cały przychód na kanały K1–K11. Oficjalny deck wciąż podaje 29,99/49,99 PLN — do uzgodnienia przed wysyłką.', 5.5);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MACIERZ FUNKCJI', 'Co zarabia, co jest potrzebne, co się dubluje', '337 funkcji w 43 modułach — pełna macierz w dokumencie specyfikacji');
  kpis(s, [['337', 'funkcji w macierzy'], ['314', 'z przypisanym kanałem'], ['23', 'fundamentowe (nie zarabiają wprost)'], ['31', 'objętych duplikacją w efekcie']], 2.6);
  table(s, ['Grupa duplikacji w efekcie końcowym', 'Funkcje', 'Na czym polega'], [
    ['Pomiar glukozy', 'S1.5, C2.1', 'Station mierzy punktowo, Capsule ciągle — ten sam wynik dla pacjenta'],
    ['Telemedycyna', 'A5.1, S4.1', 'Ta sama konsultacja z aplikacji i ze stacji'],
    ['Alert ratunkowy', 'A5.3, A14.1, S4.2', 'Trzy drogi do tego samego: wezwanie pomocy'],
    ['Ankiety i wywiad AI', 'A5.5, A12.3, A12.4', 'Trzy kody, jeden efekt: zebranie wywiadu'],
  ], 4.1, [3.6, 2.8, 5.8]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'FAZA 3', 'Eternal Station — domowe laboratorium');
  table(s, ['Model', 'Cena', 'Koszt', 'Marża'], [
    ['Zakup urządzenia', '1 499 PLN', 'BOM + montaż ~1 100 PLN', '20–30%'],
    ['Wkłady (subskrypcja)', '149 PLN/mies', 'odczynniki ~50 PLN', '60–70%'],
    ['HaaS — wynajem 24 mies.', '249 PLN/mies', 'opłata startowa 1 PLN', 'stały MRR'],
  ], 2.5, [3.4, 3.0, 3.6, 2.2]);
  s.addText('NXP i.MX 8M Plus (Edge AI) · sensory EKG, SpO2, temperatura, ciśnienie · Wi-Fi 6 / BT 5.3 / 5G · prototyp Q2 2027, produkcja masowa Q1 2028',
    { x: 0.55, y: 4.6, w: 12.2, h: 0.5, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });
  warn(s, 'Wariant ostrożny w Master 5.4 to certyfikacja cudzych urządzeń zamiast własnej produkcji. Producentem AD8232 jest Analog Devices, a nie Texas Instruments.', 5.3);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'FAZA 3 — WYKONANIE', 'OEM, ODM czy produkcja własna', 'Cztery ścieżki wytworzenia Station i ich konsekwencje');
  table(s, ['Ścieżka', 'Koszt', 'Kontrola', 'Szybkość'], [
    ['OEM / white-label (Shenzhen)', 'niższy CAPEX, BOM ~1 100 PLN', 'niska — zależna od dostawcy', 'najszybsza'],
    ['ODM — własny firmware i design', 'R&D 4 mln PLN, formy 1,8 mln PLN', 'wysoka', 'średnia'],
    ['Produkcja własna', 'najwyższy CAPEX', 'pełna nad jakością i łańcuchem', 'najwolniejsza'],
    ['Certyfikacja cudzych urządzeń', 'najniższy', 'średnia', 'najszybsza'],
  ], 2.6, [3.8, 3.6, 3.2, 1.6]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'FAZA 4', 'Nanotech i implanty', 'Głębokie dane i celowana interwencja');
  cards(s, [
    ['Bio-Tag / Bio-Monitor', 'Implanty podskórne: CGM glukozy i kortyzolu w czasie rzeczywistym, NFC dla temperatury i HRV.'],
    ['Nanoboty (R&D)', 'Wczesna detekcja patogenów i terapia celowana z biodegradacją do kwasu mlekowego.'],
    ['Bezpieczeństwo', 'Bioglass 8625 wg ISO 10993, kill-switch sprzętowy, szyfrowanie transmisji.'],
  ], 2.6, 3);
  warn(s, 'Master 5.4 podnosi klasy: Bio-Tag z IIa na IIb, implant z I na IIb/III, pętla zamknięta z IIb na III. Ścieżka MDR klasy III to 3–8 mln PLN i certyfikacja realistycznie po 2033. Zasada projektowa: wyłącznie odczyt, bez zdalnego sterowania funkcjami ciała, wyłącznik sprzętowy i możliwość usunięcia.', 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'MOONSHOTY', 'Projekty przełomowe — ocena wykonalności');
  table(s, ['Projekt', 'TRL', 'Koszt', 'Alternatywa strategiczna'], [
    ['Implant Human (Closed Loop)', 'wysoki', '15 mln+ PLN', 'brak — źródło moatu, wymaga partnera Big Pharma'],
    ['Nanoboty (platforma)', 'bardzo wysoki', '50 mln+ PLN', 'poczekać, aż technologia dojrzeje, i licencjonować'],
    ['AGI Medyczna', 'ekstremalny', '50 mln+ PLN', 'fine-tuning modeli gigantów zamiast budowy od zera'],
    ['Przeniesienie świadomości', 'sci-fi', '100 mln+ przez 20 lat', 'konsorcja naukowe; poza horyzontem planu'],
  ], 2.5, [3.6, 1.8, 2.6, 4.2]);
  s.addText('Walidacja na linii zwierzęcej (CVMP zamiast MDR) skraca drogę o 5–10 lat i w źródłach jest traktowana jako obowiązkowy etap pośredni przed człowiekiem.',
    { x: 0.55, y: 5.05, w: 12.2, h: 0.6, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ETERNAL FORGE', 'Platforma agregacyjna IP i API', 'Marketplace modułów, katalog open source i patentów, gospodarka tokenowa');
  cards(s, [
    ['Katalog IP i OSS', 'Rejestr komponentów, licencji i patentów z oceną ryzyka licencyjnego.'],
    ['Marketplace API', 'Płatny dostęp partnerski do modułów ekosystemu — kanał K3 i K9.'],
    ['Program partnerski', 'Licencjonowanie do partnerów, royalty 5–15% z Fundacji do spółki.'],
  ], 2.6, 3);
  warn(s, 'Źródła nie są zgodne, czym Forge jest. Checklista enriched opisuje go jako warstwę produkcji hardware, a Macierz 40 Projektów i wszystkie wersje v3–v5 jako marketplace IP i API. Ten deck przyjmuje wersję z Macierzy — spójną z resztą korpusu.', 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ARCHITEKTURA', 'Od sygnałów do insightów klinicznych');
  table(s, ['Warstwa', 'Zakres'], [
    ['01 Ingestion', 'Terra API (wearables) · Google Document AI (PDF, zdjęcia)'],
    ['02 Structuring', 'FHIR R4B · mapowanie SNOMED CT i LOINC'],
    ['03 Intelligence', 'RAG z guardrails · scoring i detekcja anomalii · Bio-Correlation'],
    ['04 Presentation', 'Dashboardy · oś czasu · insighty i plany działania'],
  ], 2.4, [2.6, 9.6]);
  s.addText('Moduły kontrolne K1–K14 nadzorują funkcje ryzykowne. Bez K5 panel lekarza jest nielegalny i nie pobierzesz danych z P1; bez K10 nie ma dossier.',
    { x: 0.55, y: 5.05, w: 12.2, h: 0.6, fontSize: 11.5, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ZAUFANIE', 'Bezpieczeństwo i zgodność regulacyjna');
  cards(s, [
    ['Szyfrowanie E2E', 'AES-256 i TLS 1.3 na każdym etapie, dane surowe pozostają na urządzeniu.'],
    ['Rejestr rozproszony', 'Niezmienność i integralność historii medycznej.'],
    ['Gotowość post-quantum', 'Algorytmy odporne na ataki komputerów kwantowych.'],
    ['Zgodność', 'RODO, HIPAA, MDR, a docelowo EHDS i AI Act.'],
  ], 2.5, 4);
  warn(s, 'Do listy obowiązkowej Master 5.4 dopisuje pozycje nieobecne w oficjalnym decku: IVDR, dyrektywę 2024/2853 o odpowiedzialności za produkt, AI Act z oznaczaniem treści generowanej od 2.08.2026, EHDS oraz NIS2/KSC z samoidentyfikacją do 3.10.2026 i karami do 10 mln EUR.', 4.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ROADMAPA', 'Od walidacji MVP do globalnej ekspansji', 'Scenariusz A — start Q3 2026');
  table(s, ['Rok', 'Etap', 'Kamienie milowe', 'Cel KPI'], [
    ['2026', 'MVP i walidacja', 'Rejestracja P.S.A. · Lite App · 500 testerów', '50 tys. użytkowników'],
    ['2027', 'MLP i Premium', 'Telemedycyna · Bio-Physics · prototyp Station', '100 tys. użytkowników'],
    ['2028', 'Ekspansja UE', 'Rynek DACH · certyfikacja CE MDR · nanoboty in-vitro', '1 mln użytkowników'],
    ['2029', 'USA i produkcja', 'FDA 510(k) · >10 tys. stacji rocznie · partnerzy B2B', '2,5 mln użytkowników'],
    ['2030+', 'Global i exit', 'Ekspansja Azja · nanoboty faza I · IPO lub akwizycja', 'wycena 200 mln USD+'],
  ], 2.6, [1.1, 2.6, 5.9, 2.6]);
  warn(s, 'Roadmapa wewnętrzna ma dwa scenariusze: A (start 2026) i B (start 2030 — przesunięcie o ~3,5 roku, tańsze AI i darmowy dostęp do P1 dzięki EHDS, ale znacznie wyższa konkurencja). Deck pokazuje wyłącznie A.', 5.75);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'KONKURENCJA', 'Fragmentacja kontra integracja', 'Konkurencja działa w silosach — Eternal zamyka pętlę opieki');
  table(s, ['Obszar', 'Gracze', 'Luka wobec Eternal'], [
    ['Aplikacja / dane', '1upHealth, Redox, Human API', 'brak interfejsu pacjenta, tylko middleware B2B, brak analityki AI'],
    ['Diagnostyka domowa', 'Cue Health, Everlywell, Labcorp Pixel', 'wąski zakres testów, wolny proces wysyłkowy, brak integracji stylu życia'],
    ['Nanotechnologia', 'Nanovis, Axoft, OncoRevive', 'skupienie na ortopedii, tylko neuro-tech, wąskie zastosowanie onkologiczne'],
  ], 2.6, [2.6, 4.0, 5.6]);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'PRZEWAGI', 'Dlaczego wygrywamy');
  cards(s, [
    ['Zintegrowany ekosystem', 'Software, hardware i wetware w jednej spójnej całości — bez żonglowania narzędziami.'],
    ['Closed-Loop Care', 'Measure, Diagnose, Intervene. Nie tylko wykrywamy problem, ale wdrażamy interwencję.'],
    ['Fosa danych', 'Unikalne korelacje behawioralno-kliniczne. Silnik uczy się z każdym użytkownikiem.'],
    ['Regulatory-by-Design', 'System projektowany od podstaw pod CE MDR i FDA, co buduje zaufanie partnerów B2B.'],
  ], 2.5, 4);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'ZESPÓŁ', 'Zespół założycielski');
  team(s);
  warn(s, 'Nowszy plan operacyjny opisuje skład inaczej: Janek jako CTO, Adrian jako CTO Hardware, Wiktor jako CMO/Medical Director, Karol jako CAO. Deck lokuje siedzibę w Warszawie, plan operacyjny w Poznaniu (PPNT, UMP, Politechnika Poznańska). Do uzgodnienia przed wysyłką.', 5.15);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'FINANSE', 'Prognozy finansowe — podsumowanie pięcioletnie');
  s.addChart('bar', [
    { name: 'Przychody (mln PLN)', labels: ['2027', '2028', '2029', '2030', '2031'], values: [0.085, 0.513, 1.97, 6.5, 18.5] },
  ], { x: 0.55, y: 2.5, w: 6.0, h: 3.6, barDir: 'col', chartColors: [CYAN],
       showTitle: true, title: 'Przychody', titleColor: WHITE, titleFontSize: 13, titleFontFace: BF,
       showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: WHITE, dataLabelFontSize: 9,
       catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9,
       valGridLine: { color: LINE, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false,
       plotArea: { fill: { color: NAVY } }, chartArea: { fill: { color: NAVY } } });
  table(s, ['Rok', 'Przychody', 'EBITDA'], [
    ['2027', '85 tys. PLN', '−1,62 mln PLN'], ['2028', '513 tys. PLN', '−2,45 mln PLN'],
    ['2029', '1,97 mln PLN', '−3,19 mln PLN'], ['2030', '6,50 mln PLN', '−0,85 mln PLN'],
    ['2031', '18,50 mln PLN', '+1,56 mln PLN'],
  ], 2.5, [1.3, 2.5, 2.3]);
  s.addText('Rentowność od 2031. Założenia: konwersja do 4,5%, wzrost ARPU dzięki Station, B2B jako kluczowy filar.',
    { x: 6.9, y: 5.5, w: 5.85, h: 0.7, fontSize: 11, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'FINANSOWANIE', 'Struktura finansowania', 'Czteroetapowa ścieżka kapitałowa');
  table(s, ['Etap', 'Kwota', 'Termin', 'Equity', 'Cel'], [
    ['Pre-Seed', '110 tys. PLN', 'Q2 2026', '5–8%', 'MVP software; frontend 50k, backend 40k, UX 10k, prawne 10k'],
    ['Seed', '6,0–6,7 mln PLN', 'Q4 2026', '12–15%', 'Ekosystem; runway 18–24 mies.; dev 40%, mkt 25%, hw 20%'],
    ['Runda A', '20 mln PLN', '—', '—', 'Ekspansja DACH, pełny AI Coach, oferta B2B'],
    ['Runda B', '50 mln+ PLN', '—', '—', 'USA i Azja, własne wearables, R&D nanoboty'],
  ], 2.6, [1.5, 2.2, 1.5, 1.3, 5.7]);
  kpis(s, [['5–7×', 'oczekiwane ROI w 5 lat'], ['200 mln USD+', 'cel wyceny'], ['IPO / M&A', 'strategia wyjścia 2030+']], 5.35);
  warn(s, 'Budżet MVP: oficjalny deck podaje 110 tys. PLN, Master 5.4 podaje 160–190 tys. przy orkiestracji i zaznacza, że wcześniejsze wyceny całkowicie pomijały wynagrodzenia.', 6.6);

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'RYZYKO', 'Analiza ryzyk i strategia mitygacji');
  table(s, ['Ryzyko', 'Poziom', 'Zagrożenie', 'Mitygacja'], [
    ['Regulacyjne', 'WYSOKIE', 'Opóźnienia CE MDR i FDA, zmiany przepisów o danych', 'Etapowo wellness → medical, wcześni eksperci RA, partnerstwa'],
    ['Technologiczne', 'WYSOKIE', 'Złożoność hardware i niepewność B+R nanotechnologii', 'Modułowa roadmapa, outsourcing do partnerów OEM'],
    ['Licencyjne', 'WYSOKIE', 'Gadgetbridge na AGPL-3.0 blokuje model komercyjny', 'Własny adapter zamiast forka; audyt licencji przed każdą integracją'],
    ['Adopcja rynkowa', 'ŚREDNIE', 'Wolniejsza adopcja, opór przed zaufaniem do AI', 'Darmowa aplikacja obniża barierę; współpraca z lekarzami i KOL'],
  ], 2.5, [1.9, 1.3, 4.4, 4.6]);
  s.addText('Ryzyko licencyjne nie występuje w oficjalnym decku, a w źródłach jest opisane jako realne i blokujące — fork biblioteki na AGPL nie zmienia jej licencji. Dotyczy też OpenPose (licencja niekomercyjna) i Unity (najgorszy profil ryzyka w projekcie).',
    { x: 0.55, y: 5.6, w: 12.2, h: 0.7, fontSize: 11, color: MUTED, fontFace: BF, margin: 0, isTextBox: true });

  s = p.addSlide({ masterName: 'ETERNAL' });
  head(s, 'KONTAKT', 'Porozmawiajmy', 'Etap Pre-Seed — szukamy partnerów strategicznych i inwestorów');
  kontakt(s);

  return p.writeFile({ fileName: '/home/user/Eternal-Lite-App/out/ETERNAL_PITCH_EKOSYSTEM.pptx' });
}

deckApp().then(f => { console.log('OK', f); return deckEko(); })
  .then(f => console.log('OK', f))
  .catch(e => { console.error('ERR', e); process.exit(1); });
