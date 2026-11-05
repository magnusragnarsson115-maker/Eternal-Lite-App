import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, ClipboardList, ExternalLink, FileText, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { get, post, put } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { ANGLE_LABEL, FaceMap, PhotoCompare, type Procedure } from '../staff/AestheticPages';
import { DECL_KIND_LABEL, DECL_STATUS_LABEL, type IpomView } from '../staff/PozPages';
import { Badge, Button, Card, Empty, Notice, PageHead, QueryError, Skeleton, Switch, useToast } from '../ui';

/**
 * Pacjent: „Moja POZ” (deklaracje, plan opieki koordynowanej, bilans „Moje Zdrowie”) i „Moje zabiegi” (karty zabiegów
 * z produktem i numerem serii, zalecenia, kontrola, zdjęcia, zgody do przeczytania, zgoda na wizerunek).
 */

export function usePatientClinicFeatures() {
  const q = useQuery({ queryKey: ['me-clinics'], queryFn: () => get<{ clinics: { orgId: string; name: string; features: string[] }[]; features: string[] }>('/api/me/clinics'), staleTime: 300_000 });
  return q.data?.features ?? [];
}

const IPOM_KIND_LABEL: Record<string, string> = { wizyta: 'Wizyta kontrolna', badanie: 'Badanie', konsultacja: 'Konsultacja specjalistyczna', edukacja: 'Porada edukacyjna', dietetyk: 'Porada dietetyczna' };
const GROUP_LABEL: Record<string, string> = {
  nadcisnienie: 'Nadciśnienie tętnicze',
  'niewydolnosc-serca': 'Przewlekła niewydolność serca',
  'migotanie-przedsionkow': 'Migotanie przedsionków',
  'choroba-wiencowa': 'Przewlekły zespół wieńcowy',
  'cukrzyca-2': 'Cukrzyca typu 2',
  'stan-przedcukrzycowy': 'Stan przedcukrzycowy',
  'niedoczynnosc-tarczycy': 'Niedoczynność tarczycy',
  'guzki-tarczycy': 'Guzki tarczycy',
  astma: 'Astma',
  pochp: 'POChP',
  'choroba-nerek': 'Przewlekła choroba nerek',
  inna: 'Inna choroba przewlekła (opis w planie)',
};

interface PozMine {
  declarations: { id: string; kind: string; practitionerName: string; clinic: string; status: string; submittedOn: string; source: 'papier' | 'ikp'; reason?: string }[];
  plans: (IpomView & { clinic: string })[];
  bzod: { age?: number; intervalYears?: number; lastDone?: string; eligibleNow: boolean; nextYear?: number; reason: string; rule: string; source: string; ikpUrl: string };
}

export function MyPozPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['me-poz'], queryFn: () => get<PozMine>('/api/me/poz') });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const d = q.data!;
  return (
    <div className="stack-lg">
      <PageHead title={t('Moja POZ')} sub={t('Twój lekarz, pielęgniarka i położna POZ, plan opieki i bilans zdrowia.')} />
      <Card title={t('Deklaracje wyboru')}>
        {!d.declarations.length ? (
          <p className="small muted" style={{ margin: 0 }}>{t('Placówka nie ma zapisanej Twojej deklaracji.')}</p>
        ) : (
          <ul className="list">
            {d.declarations.map((x) => (
              <li key={x.id} className="list-item" style={{ padding: '10px 0' }}>
                <span className="list-icon">
                  <Stethoscope size={18} aria-hidden />
                </span>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {t(DECL_KIND_LABEL[x.kind] ?? x.kind)}: {x.practitionerName}
                  </span>
                  <span className="list-sub">
                    {x.clinic} · {x.source === 'ikp' ? t('złożona w IKP') : t('złożona w przychodni')} · {fmt.date(x.submittedOn)}
                    {x.reason ? ` · ${x.reason}` : ''}
                  </span>
                </span>
                <Badge kind={x.status === 'przyjeta' ? 'ok' : x.status === 'odrzucona' ? 'danger' : 'warn'}>{t(DECL_STATUS_LABEL[x.status] ?? x.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          {t('Deklarację możesz złożyć lub zmienić w przychodni albo w Internetowym Koncie Pacjenta. Dwie zmiany lekarza POZ w roku są bezpłatne.')}{' '}
          <a href={d.bzod.ikpUrl} target="_blank" rel="noreferrer">
            {t('Otwórz IKP')} <ExternalLink size={12} aria-hidden />
          </a>
        </p>
      </Card>
      {d.plans.map((p) => (
        <Card key={p.id} title={t('Plan opieki koordynowanej')} action={<span className="small muted">{p.clinic}</span>}>
          <div className="stack-sm">
            <div className="chips">
              {p.groups.map((g) => (
                <span key={g} className="badge primary">
                  {t(GROUP_LABEL[g] ?? g)}
                </span>
              ))}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {t('Plan ułożył(a)')}: {p.author ?? '—'} · {t('od {d}', { d: fmt.date(p.validFrom) })}
              {p.coordinator ? ` · ${t('Twój koordynator')}: ${p.coordinator.name}` : ''}
            </p>
            <ul className="list">
              {p.items.map((i) => (
                <li key={i.id} className="list-item" style={{ padding: '10px 0' }}>
                  <span className={`list-icon ${i.status === 'zrealizowane' ? 'ok' : i.overdue ? 'warn' : ''}`}>{i.status === 'zrealizowane' ? <CheckCircle2 size={18} aria-hidden /> : <ClipboardList size={18} aria-hidden />}</span>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {i.title}
                    </span>
                    <span className="list-sub">
                      {t(IPOM_KIND_LABEL[i.kind] ?? i.kind)}
                      {i.dueOn ? ` · ${t('termin')}: ${fmt.date(i.dueOn)}` : ''}
                      {i.doneOn ? ` · ${t('zrealizowano')}: ${fmt.date(i.doneOn)}` : ''}
                    </span>
                  </span>
                  {i.status === 'zrealizowane' ? <Badge kind="ok">{t('zrealizowane')}</Badge> : i.status === 'odwolane' ? <Badge>{t('odwołane')}</Badge> : i.overdue ? <Badge kind="warn">{t('termin minął')}</Badge> : null}
                </li>
              ))}
            </ul>
            <p className="small muted" style={{ margin: 0 }}>{t('Pytania o plan zadaj koordynatorowi lub lekarzowi w wiadomościach. Na wizytę umówisz się w zakładce „Wizyty”.')}</p>
          </div>
        </Card>
      ))}
      <Card title={t('Bilans zdrowia „Moje Zdrowie”')}>
        <div className="stack-sm">
          {d.bzod.eligibleNow ? (
            <Notice kind="ok">{t('Według Twojego rocznika możesz teraz skorzystać z bilansu zdrowia. Wypełnij ankietę w IKP albo w przychodni.')}</Notice>
          ) : d.bzod.reason === 'brak-daty-urodzenia' ? (
            <Notice kind="info">{t('Brak daty urodzenia w danych — sprawdź uprawnienie w IKP.')}</Notice>
          ) : (
            <Notice kind="info">{d.bzod.nextYear ? t('Kolejny bilans będzie możliwy od {y} r.', { y: d.bzod.nextYear }) : t('Bilans nie jest teraz dostępny.')}</Notice>
          )}
          <p className="small" style={{ margin: 0 }}>
            {t(d.bzod.rule)} {d.bzod.lastDone ? t('Ostatni bilans: {d}.', { d: fmt.date(d.bzod.lastDone) }) : ''}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {t('Informacja orientacyjna — uprawnienie potwierdza IKP. Badania wskazuje ankieta programu i lekarz.')} ({d.bzod.source})
          </p>
          <a className="btn secondary sm" href={d.bzod.ikpUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
            {t('Ankieta w IKP')} <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </Card>
    </div>
  );
}

interface ConsentMine {
  id: string;
  title: string;
  status: 'do-podpisu' | 'podpisana' | 'wycofana';
  readAt?: string;
  signedOn?: string;
  clinic: string;
  template?: { sections: { heading: string; text: string[] }[] };
}

export function MyProceduresPage() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me-aesthetic'],
    queryFn: () => get<{ procedures: (Procedure & { clinic: string })[]; consents: ConsentMine[]; image: { orgId: string; clinic: string; documentation: boolean; marketing: boolean; texts: { documentation: string; marketing: string } }[] }>('/api/me/aesthetic'),
  });
  const [view, setView] = useState<'przod' | 'lewy' | 'prawy'>('przod');
  const read = useMutation({ mutationFn: (id: string) => post(`/api/me/aesthetic/consents/${id}/read`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['me-aesthetic'] }) });
  const image = useMutation({
    mutationFn: (v: { orgId: string; marketing?: boolean; documentation?: boolean }) => put('/api/me/aesthetic/image-consent', v),
    onSuccess: () => (toast(t('Zapisano Twoją decyzję.')), void qc.invalidateQueries({ queryKey: ['me-aesthetic'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const d = q.data!;
  const toRead = d.consents.filter((c) => c.status === 'do-podpisu');
  return (
    <div className="stack-lg">
      <PageHead title={t('Moje zabiegi')} sub={t('Karty zabiegów z produktem i numerem serii, zalecenia, kontrole i zdjęcia.')} />
      {toRead.map((c) => (
        <Card key={c.id} title={c.title} action={<span className="small muted">{c.clinic}</span>}>
          <details className="explain">
            <summary>{t('Przeczytaj przed wizytą')}</summary>
            {c.template?.sections.map((s) => (
              <div key={s.heading}>
                <h4 className="small" style={{ margin: '8px 0 2px' }}>{s.heading}</h4>
                {s.text.map((l) => (
                  <p key={l} className="small" style={{ margin: '0 0 4px' }}>
                    {l}
                  </p>
                ))}
              </div>
            ))}
          </details>
          <p className="small muted">{t('Zgodę podpisujesz w gabinecie po rozmowie z lekarzem — możesz wtedy zadać pytania. Potwierdzenie przeczytania nie jest podpisem.')}</p>
          {c.readAt ? (
            <Badge kind="ok">{t('przeczytano {d}', { d: fmt.date(c.readAt) })}</Badge>
          ) : (
            <Button size="sm" variant="secondary" loading={read.isPending} onClick={() => read.mutate(c.id)}>
              {t('Przeczytałem(-am)')}
            </Button>
          )}
        </Card>
      ))}
      {!d.procedures.length && <Empty title={t('Nie masz jeszcze kart zabiegów')}>{t('Po zabiegu lekarz podpisuje kartę — pojawi się tutaj razem z zaleceniami.')}</Empty>}
      {d.procedures.map((p) => (
        <Card key={p.id} title={<h3 style={{ margin: 0 }}>{p.title}</h3>} action={<span className="small muted">{p.clinic}</span>}>
          <div className="stack-sm">
            <p className="small muted" style={{ margin: 0 }}>
              {fmt.dateTime(p.performedAt)} · {p.performer}
            </p>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {p.items.map((i, k) => (
                <li key={k}>
                  {i.productName}: {i.quantity} {i.unit} · {t('seria')} {i.lot} · {i.area}
                </li>
              ))}
            </ul>
            {(p.controlOn || p.nextOn) && (
              <p className="small" style={{ margin: 0 }}>
                <CalendarClock size={14} aria-hidden /> {p.controlOn ? `${t('Wizyta kontrolna')}: ${fmt.date(p.controlOn)}` : ''}
                {p.nextOn ? ` · ${t('Możliwy kolejny zabieg')}: ${fmt.date(p.nextOn)}` : ''}
              </p>
            )}
            {p.aftercare && (
              <Notice kind="info" title={t('Zalecenia po zabiegu')}>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {p.aftercare.split('\n').map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <div className="proc-grid">
              <FaceMap points={p.points} view={view} setView={setView} readOnly />
              <PhotoCompare photos={p.photos} srcOf={(docId) => `/api/me/aesthetic/procedures/${p.id}/photos/${docId}`} />
            </div>
            {p.consent && (
              <p className="small muted" style={{ margin: 0 }}>
                <ShieldCheck size={14} aria-hidden /> {p.consent.title} · {t('podpisana')} {p.consent.signedOn ? fmt.date(p.consent.signedOn) : ''}
              </p>
            )}
          </div>
        </Card>
      ))}
      {d.image.map((i) => (
        <Card key={i.orgId} title={t('Zdjęcia i wizerunek — {c}', { c: i.clinic })}>
          <div className="stack-sm">
            <div className="row" style={{ gap: 10 }}>
              <Switch checked={i.documentation} onChange={(v) => image.mutate({ orgId: i.orgId, documentation: v })} label={t('Zdjęcia w dokumentacji medycznej')} />
              <strong className="small">{t('Zdjęcia w dokumentacji medycznej')}</strong>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{t(i.texts.documentation)}</p>
            <div className="row" style={{ gap: 10 }}>
              <Switch checked={i.marketing} onChange={(v) => image.mutate({ orgId: i.orgId, marketing: v })} label={t('Zdjęcia w materiałach placówki')} />
              <strong className="small">{t('Zdjęcia w materiałach placówki')}</strong>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{t(i.texts.marketing)}</p>
          </div>
        </Card>
      ))}
      <p className="small muted">
        <FileText size={13} aria-hidden /> {t('Zdjęcia pokazujemy obok siebie bez automatycznej oceny. Ujęcia')}: {Object.values(ANGLE_LABEL).map((a) => t(a)).join(', ')}.
      </p>
    </div>
  );
}
