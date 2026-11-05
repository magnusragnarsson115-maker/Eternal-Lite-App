import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Compass, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPreviewPersona, type PreviewData } from './shim';
import './guide.css';

/**
 * Przewodnik po podglądzie (tylko w wersji bez serwera): krótki opis aplikacji i lista rzeczy do sprawdzenia.
 * „Pokaż” przełącza konto pokazowe i otwiera właściwy ekran — bez wpisywania loginu. Treść jest w dwóch
 * językach i idzie za przełącznikiem PL/EN aplikacji (atrybut `lang` dokumentu).
 */

type Lang = 'pl' | 'en';
type Text = Record<Lang, string>;

interface Step {
  persona: string;
  route: string;
  title: Text;
  what: Text;
}

interface Section {
  title: Text;
  who: Text;
  steps: Step[];
}

const SEEN_KEY = 'eternal.preview.guide-seen';

function body(r: { b?: string } | undefined): unknown {
  try {
    return r?.b ? JSON.parse(r.b) : undefined;
  } catch {
    return undefined;
  }
}

/** Identyfikatory z nagrania: karta Anny Kowalskiej, dzisiejsza wizyta z sesją Scribe, zakończony wywiad. */
function ids(data: PreviewData) {
  const doc = data.personas.doctor?.routes ?? {};
  let annaId: string | undefined;
  let scribeVisit: string | undefined;
  for (const [k, r] of Object.entries(doc)) {
    const snap = /^GET \/api\/staff\/patients\/([^/?]+)\/snapshot$/.exec(k);
    if (snap && !annaId) {
      const b = body(r) as { snapshot?: { patient?: { name?: string } } } | undefined;
      if (b?.snapshot?.patient?.name?.includes('Kowalska')) annaId = snap[1];
    }
    const sc = /^GET \/api\/staff\/scribe\?appointmentId=([^&]+)/.exec(k);
    if (sc && !scribeVisit) {
      const b = body(r) as { items?: { status?: string }[] } | undefined;
      if (b?.items?.some((x) => x.status === 'draft')) scribeVisit = sc[1];
    }
  }
  let interview: string | undefined;
  for (const [k, r] of Object.entries(data.personas.patient?.routes ?? {})) {
    const m = /^GET \/api\/me\/interviews\/([^/?]+)$/.exec(k);
    if (m && (body(r) as { status?: string } | undefined)?.status === 'completed') interview = m[1];
  }
  let karolinaId: string | undefined;
  for (const k of Object.keys(data.personas.aesthetic?.routes ?? {})) {
    const m = /^GET \/api\/staff\/patients\/([^/?]+)\/procedure-consents$/.exec(k);
    if (m) karolinaId = m[1];
  }
  return { annaId, scribeVisit, interview, karolinaId };
}

function sections(data: PreviewData): Section[] {
  const { annaId, scribeVisit, interview, karolinaId } = ids(data);
  const card = annaId ? `/panel/pacjenci/${annaId}` : '/panel/pacjenci';
  return [
    {
      title: { pl: 'Profile placówek — POZ i medycyna estetyczna', en: 'Clinic profiles — primary care and aesthetic medicine' },
      who: { pl: 'Centrum Medyczne Eternal (POZ) i klinika Aurora (estetyka) — obie fikcyjne', en: 'Eternal Medical Centre (primary care) and Aurora clinic (aesthetics) — both fictional' },
      steps: [
        {
          persona: 'admin',
          route: '/panel/admin?tab=profiles',
          title: { pl: 'Wybór profilu placówki', en: 'Choosing the clinic profile' },
          what: {
            pl: 'Siedem profili: POZ, medycyna estetyczna, poradnia specjalistyczna, rehabilitacja, zdrowie psychiczne, stomatologia i medycyna pracy (dwa ostatnie częściowe). Każdy pokazuje, co realnie potrzebuje taka placówka i gdzie to jest, czego jeszcze brakuje i jakie zasady uwzględnia. Zastosowanie tylko dodaje.',
            en: 'Seven profiles: primary care, aesthetic medicine, specialist clinic, rehabilitation, mental health, dentistry and occupational medicine (the last two partial). Each shows what such a clinic really needs and where it is, what is still missing and which rules it follows. Applying only adds.',
          },
        },
        {
          persona: 'doctor',
          route: '/panel/poz',
          title: { pl: 'POZ: deklaracje, opieka koordynowana, bilans', en: 'Primary care: declarations, coordinated care, health check' },
          what: {
            pl: 'Deklaracje do przyjęcia (papier i IKP), lista aktywna; zakładki „Opieka koordynowana” (plany IPOM z zaległościami i koordynatorem) i „Bilans dorosłych” (kto może teraz skorzystać z „Moje Zdrowie”).',
            en: 'Declarations to accept (paper and IKP), active list; “Coordinated care” (care plans with overdue items and coordinator) and “Adult health check” (who can use “Moje Zdrowie” now).',
          },
        },
        {
          persona: 'doctor',
          route: `${card}?tab=ipom`,
          title: { pl: 'IPOM w karcie pacjenta', en: 'Care plan in the patient chart' },
          what: {
            pl: 'Plan Anny Kowalskiej (nadciśnienie): koordynator, pozycje z terminami, zaległa kreatynina, wykorzystanie porad wobec limitów placówki.',
            en: 'Anna Kowalska’s plan (hypertension): coordinator, items with dates, overdue creatinine, use of sessions against the clinic’s limits.',
          },
        },
        {
          persona: 'patient',
          route: '/moja-poz',
          title: { pl: 'Moja POZ — widok pacjentki', en: 'My primary care — patient view' },
          what: { pl: 'Deklaracje, plan opieki z terminami, bilans „Moje Zdrowie” z linkiem do IKP.', en: 'Declarations, care plan with dates, “Moje Zdrowie” health check with a link to IKP.' },
        },
        {
          persona: 'aesthetic',
          route: '/panel/zabiegi?tab=produkty',
          title: { pl: 'Produkty i partie', en: 'Products and batches' },
          what: {
            pl: 'Toksyna, wypełniacz i biostymulator (nazwy fikcyjne) z partiami: data ważności, UDI, partia po terminie i z krótką datą. „Kto dostał” — lista pacjentów przy komunikacie producenta.',
            en: 'Toxin, filler and biostimulator (fictional names) with batches: expiry, UDI, an expired and a short-dated batch. “Who received it” — patient list for a manufacturer notice.',
          },
        },
        {
          persona: 'aesthetic',
          route: karolinaId ? `/panel/pacjenci/${karolinaId}?tab=zabiegi` : '/panel/zabiegi',
          title: { pl: 'Karta zabiegu z mapą iniekcji', en: 'Procedure record with injection map' },
          what: {
            pl: 'Zgody (pisemne do wydruku, zgoda na zdjęcia), karty zabiegów: produkt, seria, ilość, mapa iniekcji, zdjęcia przed/po obok siebie (rysunki poglądowe), zalecenia, kontrola, VAT z celu zabiegu, powikłanie; szkic do podpisu.',
            en: 'Consents (written, printable; photo consent), procedure records: product, batch, amount, injection map, before/after photos side by side (illustrations), aftercare, follow-up, VAT from the purpose, a complication; a draft to sign.',
          },
        },
        {
          persona: 'karolina',
          route: '/moje-zabiegi',
          title: { pl: 'Moje zabiegi — widok pacjentki', en: 'My procedures — patient view' },
          what: {
            pl: 'Karty zabiegów z serią produktu, zalecenia, termin kontroli, zdjęcia, zgoda do przeczytania przed wizytą i decyzja o wykorzystaniu zdjęć (domyślnie nie).',
            en: 'Procedure records with product batch, aftercare, follow-up date, photos, a consent to read before the visit and the decision on photo use (no by default).',
          },
        },
      ],
    },
    {
      title: { pl: 'Panel lekarza — Eternal Klinika', en: 'Doctor panel — Eternal Clinic' },
      who: { pl: 'lek. Anna Nowicka (interna)', en: 'Dr Anna Nowicka (internal medicine)' },
      steps: [
        {
          persona: 'doctor',
          route: '/panel',
          title: { pl: 'Kolejka pacjentów', en: 'Patient queue' },
          what: {
            pl: 'Zakładki Dziś / Nowi / Kontrola / Pilne / Wymaga reakcji / Braki danych. Przy sprawie: status (kliknij, by zobaczyć dozwolone przejścia), właściciel, flaga „pilne” nadawana przez personel i historia zmian (ikona zegara). Granatowo-morska kolorystyka panelu.',
            en: 'Tabs Today / New / Follow-up / Urgent / Needs action / Missing data. Each case has a status (click to see allowed transitions), an owner, a staff-set “urgent” flag and a change history (clock icon). Navy/teal clinic palette.',
          },
        },
        {
          persona: 'doctor',
          route: card,
          title: { pl: 'Medical Snapshot z pochodzeniem danych', en: 'Medical Snapshot with data provenance' },
          what: {
            pl: 'Karta Anny Kowalskiej otwiera się na podsumowaniu: „Co się zmieniło od ostatniej wizyty” (lista nowych wpisów, bez oceny), problemy, leki, alergie, wyniki, parametry. Kliknij wynik → okno: wartość, data, laboratorium, dokument źródłowy, poprzednie wartości i kto je zatwierdził. Niżej: sprawy pacjenta, wywiady przed wizytą i log poprawek OCR (wartość automatyczna → poprawka → kto → kiedy).',
            en: 'Anna Kowalska’s chart opens on the summary: “What changed since the last visit” (new entries listed, never assessed), problems, medicines, allergies, results, parameters. Click a result → value, date, laboratory, source document, previous values and who confirmed it. Below: the patient’s cases, pre-visit interviews and the OCR correction log (automatic value → correction → who → when).',
          },
        },
        {
          persona: 'doctor',
          route: `${card}?tab=timeline`,
          title: { pl: 'Oś czasu zdrowia', en: 'Health timeline' },
          what: {
            pl: 'Wszystko w jednej osi, od najnowszych. Filtry: leki, badania, objawy, wizyty, pomiary, hospitalizacje, dokumenty, rozpoznania; przy każdym wpisie źródło.',
            en: 'Everything on one timeline, newest first. Filters: medicines, tests, symptoms, visits, measurements, hospital stays, documents, diagnoses; each entry shows its source.',
          },
        },
        {
          persona: 'doctor',
          route: scribeVisit ? `/panel/wizyta/${scribeVisit}?tab=scribe` : '/panel/kalendarz',
          title: { pl: 'Eternal Scribe — notatka z rozmowy', en: 'Eternal Scribe — note from the conversation' },
          what: {
            pl: 'Dzisiejsza wizyta z nagraniem przykładowej rozmowy: uczestnicy, transkrypcja z czasem (kliknij zdanie; jedno zdanie ma poprawkę z historią), szkic notatki w 11 sekcjach z odnośnikami do fragmentów S#. Każdą sekcję lekarz akceptuje, poprawia, odrzuca albo generuje ponownie; „Formaty” — SOAP, wypis, podsumowanie, HIS/EDM.',
            en: 'Today’s visit with a sample recorded conversation: participants, timestamped transcript (click a sentence; one sentence has a correction with history), an 11-section note draft linked to S# fragments. The doctor accepts, corrects, rejects or regenerates each section; “Formats” — SOAP, discharge, summary, EHR.',
          },
        },
      ],
    },
    {
      title: { pl: 'Aplikacja pacjenta — Eternal Pacjent', en: 'Patient app — Eternal Patient' },
      who: { pl: 'Anna Kowalska (osoba fikcyjna)', en: 'Anna Kowalska (fictional person)' },
      steps: [
        {
          persona: 'patient',
          route: '/',
          title: { pl: 'Start i kolorystyka pacjenta', en: 'Home and patient palette' },
          what: {
            pl: 'Fioletowa kolorystyka panelu pacjenta (jasna i ciemna), najbliższe wizyty, karta avatara.',
            en: 'Violet patient palette (light and dark), upcoming visits, avatar card.',
          },
        },
        {
          persona: 'patient',
          route: '/moje-zdrowie',
          title: { pl: 'Moje zdrowie i avatar 3D', en: 'My health and the 3D avatar' },
          what: {
            pl: 'Avatar rośnie razem z dokumentacją: poziom zależy od liczby obszarów z danymi i ich świeżości, nie od stanu zdrowia. Obróć go palcem albo myszą. Niżej „Co się zmieniło” i podsumowanie — kliknij wynik, by zobaczyć jego źródło.',
            en: 'The avatar grows with the records: its level depends on how many areas have data and how fresh it is, never on health. Rotate it with a finger or mouse. Below: “What changed” and the summary — click a result to see its source.',
          },
        },
        {
          persona: 'patient',
          route: '/moje-zdrowie?tab=timeline',
          title: { pl: 'Oś czasu pacjenta', en: 'Patient timeline' },
          what: { pl: 'Ta sama oś czasu z filtrami, którą widzi lekarz.', en: 'The same filtered timeline the doctor sees.' },
        },
        {
          persona: 'patient',
          route: interview ? `/wywiad/${interview}` : '/wywiad',
          title: { pl: 'Wywiad przed wizytą (czat)', en: 'Pre-visit interview (chat)' },
          what: {
            pl: 'Pytania z drzewa zatwierdzonego przez lekarza, z rozgałęzieniami zależnymi od odpowiedzi; zakończony wywiad kardiologiczny z podsumowaniem dla lekarza. Lista dostępnych wywiadów: menu „Wywiad przed wizytą”.',
            en: 'Questions from a doctor-approved tree that branches on the answers; a completed cardiology interview with a summary for the doctor. Available interviews: “Pre-visit interview” in the menu.',
          },
        },
        {
          persona: 'patient',
          route: '/eternal-id',
          title: { pl: 'Eternal ID — za granicą i offline', en: 'Eternal ID — abroad and offline' },
          what: {
            pl: 'Karta z kodem QR i linkiem ważnym przez wybrany czas (PL/EN), zapis na tag NFC (Chrome na Androidzie) i kopia offline na urządzeniu.',
            en: 'A card with a QR code and a time-limited link (PL/EN), writing to an NFC tag (Chrome on Android) and an offline copy on the device.',
          },
        },
      ],
    },
    {
      title: { pl: 'Administrator placówki', en: 'Clinic administrator' },
      who: { pl: 'konto administratora', en: 'administrator account' },
      steps: [
        {
          persona: 'admin',
          route: '/panel/admin?tab=integrations',
          title: { pl: 'Integracje przez API (bez widżetów)', en: 'Integrations by API (no widgets)' },
          what: {
            pl: 'ZnanyLekarz/Docplanner (mapowanie lekarzy i usług, synchronizacja), Infermedica zablokowana do czasu oceny zgodności MDR, stan dostawców OCR, mowy na tekst i danych z urządzeń. W podglądzie bez kluczy — widać, czego każda integracja wymaga.',
            en: 'ZnanyLekarz/Docplanner (doctor and service mapping, sync), Infermedica locked until the MDR conformity assessment, status of OCR, speech-to-text and device-data providers. No keys in the preview — each card shows what it needs.',
          },
        },
        {
          persona: 'admin',
          route: '/moduly',
          title: { pl: 'Moduły i funkcje', en: 'Modules and functions' },
          what: {
            pl: 'Mapa 42 modułów i 648 funkcji: co działa, gdzie w aplikacji, co jest częściowe i co zablokowane z powodem.',
            en: 'Map of 42 modules and 648 functions: what works, where in the app, what is partial and what is blocked and why.',
          },
        },
      ],
    },
  ];
}

const UI: Record<string, Text> = {
  open: { pl: 'Przewodnik', en: 'Guide' },
  heading: { pl: 'Eternal — co sprawdzić w podglądzie', en: 'Eternal — what to check in the preview' },
  intro: {
    pl: 'Eternal to aplikacja dla placówki medycznej i jej pacjentów: panel lekarza (kolejka, karta pacjenta, notatki z wizyt) i aplikacja pacjenta (wyniki, wizyty, wywiady, Eternal ID). Dane są fikcyjne i nagrane z instancji pokazowej — możesz klikać wszędzie, ale zmiany nie są zapisywane.',
    en: 'Eternal is an app for a medical clinic and its patients: the doctor panel (queue, patient chart, visit notes) and the patient app (results, visits, interviews, Eternal ID). The data is fictional and recorded from the demo instance — click anywhere, but changes are not saved.',
  },
  boundary: {
    pl: 'Aplikacja nie ocenia wyników ani pomiarów: pokazuje je z datą i źródłem, decyzje podejmuje lekarz.',
    en: 'The app never assesses results or measurements: it shows them with date and source; the doctor decides.',
  },
  how: { pl: '„Pokaż” loguje na właściwe konto pokazowe i otwiera ekran.', en: '“Show” signs in to the right demo account and opens the screen.' },
  show: { pl: 'Pokaż', en: 'Show' },
  close: { pl: 'Zamknij przewodnik', en: 'Close guide' },
  limits: {
    pl: 'Podgląd jest tylko do odczytu: zapis, nagrywanie, wysyłka, NFC i integracje partnerów działają w pełnej aplikacji na serwerze.',
    en: 'The preview is read-only: saving, recording, sending, NFC and partner integrations work in the full app on a server.',
  },
};

function currentLang(): Lang {
  return document.documentElement.lang === 'en' ? 'en' : 'pl';
}

function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* tryb prywatny — przewodnik otworzy się przy następnym wczytaniu */
  }
}

export function PreviewGuide({ data }: { data: PreviewData }) {
  const [open, setOpen] = useState(() => !seen());
  const [lang, setLang] = useState<Lang>(currentLang);
  const [busy, setBusy] = useState<string | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = sections(data);

  useEffect(() => {
    setLang(currentLang());
    const mo = new MutationObserver(() => setLang(currentLang()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    head.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function close() {
    markSeen();
    setOpen(false);
  }

  async function show(step: Step) {
    setBusy(step.route);
    setPreviewPersona(step.persona);
    try {
      sessionStorage.removeItem('eternal.profile');
    } catch {
      /* brak dostępu */
    }
    // nowe konto: odrzucamy odczyty poprzedniego i czekamy na profil, zanim zmienimy ekran
    await qc.resetQueries().catch(() => undefined);
    // przekierowania poprzedniego panelu (pacjent ↔ placówka) muszą się wykonać przed przejściem na ekran
    await new Promise((r) => setTimeout(r, 80));
    nav(step.route);
    setBusy(null);
    close();
    window.scrollTo(0, 0);
  }

  const tx = (x: Text) => x[lang];
  return (
    <>
      <button type="button" className="pg-fab" aria-expanded={open} aria-controls="preview-guide" onClick={() => (open ? close() : setOpen(true))}>
        <Compass size={18} aria-hidden /> {tx(UI.open)}
      </button>
      {open && (
        <aside id="preview-guide" className="pg-panel" role="dialog" aria-modal="false" aria-labelledby="pg-head">
          <div className="pg-top">
            <h2 id="pg-head" ref={head} tabIndex={-1}>
              {tx(UI.heading)}
            </h2>
            <button type="button" className="pg-x" onClick={close} aria-label={tx(UI.close)}>
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="pg-scroll">
            <p>{tx(UI.intro)}</p>
            <p className="pg-note">{tx(UI.boundary)}</p>
            <p className="pg-muted">{tx(UI.how)}</p>
            {list.map((sec) => (
              <section key={sec.title.pl} className="pg-sec">
                <h3>{tx(sec.title)}</h3>
                <p className="pg-muted">{tx(sec.who)}</p>
                <ol className="pg-steps">
                  {sec.steps.map((st) => (
                    <li key={st.title.pl}>
                      <div className="pg-step-head">
                        <strong>{tx(st.title)}</strong>
                        <button type="button" className="pg-show" disabled={!!busy} onClick={() => void show(st)}>
                          {tx(UI.show)} <ArrowRight size={14} aria-hidden />
                        </button>
                      </div>
                      <p>{tx(st.what)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <p className="pg-muted">{tx(UI.limits)}</p>
          </div>
        </aside>
      )}
    </>
  );
}
