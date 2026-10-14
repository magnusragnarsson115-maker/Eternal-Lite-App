import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, KeyRound, LogOut, Phone, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { del, get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { passkeysSupported, registerPasskey } from '../lib/passkeys';
import { useSession } from '../session';
import { Badge, Button, Card, Notice, SelectField, TextArea, TextField, useToast } from '../ui';

/** Karty konta wspólne dla panelu i aplikacji pacjenta: klucze, urządzenia, kody odzyskiwania, telefon, zgłoszenia. */

const CATEGORY_PL: Record<string, string> = { 'data-error': 'błąd w danych', 'ai-content': 'treść AI', privacy: 'prywatność', security: 'bezpieczeństwo', availability: 'dostępność', other: 'inne' };

export function SecurityKeysCard() {
  const { t, fmt } = useI18n();
  const { refresh } = useSession();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const q = useQuery({ queryKey: ['webauthn'], queryFn: () => get<{ items: { id: string; label: string; createdAt: string; lastUsedAt?: string }[] }>('/api/auth/webauthn/credentials') });
  const add = useMutation({
    mutationFn: () => registerPasskey(label || undefined),
    onSuccess: () => {
      toast(t('Dodano klucz.'));
      setLabel('');
      void q.refetch();
      void refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/auth/webauthn/credentials/${id}`), onSuccess: () => void q.refetch() });
  return (
    <Card title={t('Klucze dostępu i klucze sprzętowe')}>
      <div className="stack">
        <p className="small muted">{t('Klucz sprzętowy (np. YubiKey) albo klucz dostępu w telefonie może zastąpić kod z aplikacji przy logowaniu.')}</p>
        {!passkeysSupported() && <Notice kind="warn">{t('Ta przeglądarka nie obsługuje kluczy dostępu.')}</Notice>}
        <ul className="list">
          {q.data?.items.map((k) => (
            <li key={k.id} className="list-item">
              <KeyRound size={18} aria-hidden />
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {k.label}
                </span>
                <span className="list-sub">
                  {t('dodano {d}', { d: fmt.date(k.createdAt) })}
                  {k.lastUsedAt && ` · ${t('ostatnio {d}', { d: fmt.dateTime(k.lastUsedAt) })}`}
                </span>
              </span>
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => remove.mutate(k.id)}>
                {t('Usuń')}
              </Button>
            </li>
          ))}
        </ul>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <TextField label={t('Nazwa klucza (opcjonalnie)')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button icon={<Plus size={16} />} disabled={!passkeysSupported()} loading={add.isPending} onClick={() => add.mutate()}>
            {t('Dodaj klucz')}
          </Button>
        </div>
        {(add.isError || remove.isError) && <Notice kind="danger">{errorMessage(add.error ?? remove.error, t)}</Notice>}
      </div>
    </Card>
  );
}

export function SessionsCard() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => get<{ items: { id: string; device: string; method: string; ip?: string; lastSeenAt: string; current: boolean }[]; maxDevices?: number }>('/api/auth/sessions') });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/api/auth/sessions/${id}`), onSuccess: () => void q.refetch() });
  return (
    <Card title={t('Zalogowane urządzenia')} className="card-flush">
      {q.data?.maxDevices && <p className="small muted" style={{ padding: '0 16px' }}>{t('Najwyżej {n} urządzeń — przy logowaniu na kolejnym najdawniej używane zostanie wylogowane.', { n: q.data.maxDevices })}</p>}
      <ul className="list">
        {q.data?.items.map((s) => (
          <li key={s.id} className="list-item">
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>
                {s.device} {s.current && <Badge kind="ok">{t('to urządzenie')}</Badge>}
              </span>
              <span className="list-sub">
                {t('ostatnio aktywne {d}', { d: fmt.dateTime(s.lastSeenAt) })} · {METHOD_PL[s.method] ? t(METHOD_PL[s.method]) : s.method}
                {s.ip && ` · ${s.ip}`}
              </span>
            </span>
            {!s.current && (
              <Button size="sm" variant="ghost" icon={<LogOut size={14} />} onClick={() => revoke.mutate(s.id)}>
                {t('Wyloguj')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const METHOD_PL: Record<string, string> = { password: 'hasło', passkey: 'klucz dostępu', 'magic-link': 'link z e-maila', oidc: 'logowanie firmowe' };

export function ReportIncidentCard({ staff }: { staff?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ category: 'data-error', description: '', severity: 'medium', contact: '' });
  const send = useMutation({
    mutationFn: () => post(staff ? '/api/incidents' : '/api/me/incidents', { category: f.category, description: f.description, severity: staff ? f.severity : undefined, contact: f.contact || undefined }),
    onSuccess: () => {
      toast(t('Zgłoszenie przyjęte. Dziękujemy.'));
      setF({ ...f, description: '' });
    },
  });
  return (
    <Card title={t('Zgłoś problem lub incydent')}>
      <div className="stack">
        <SelectField label={t('Rodzaj')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {Object.entries(CATEGORY_PL).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </SelectField>
        {staff && (
          <SelectField label={t('Waga')} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
            <option value="low">{t('niska')}</option>
            <option value="medium">{t('średnia')}</option>
            <option value="high">{t('wysoka')}</option>
            <option value="critical">{t('krytyczna')}</option>
          </SelectField>
        )}
        <TextArea label={t('Opis (bez danych innych osób)')} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        {!staff && <TextField label={t('Kontakt zwrotny (opcjonalnie)')} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />}
        {send.isError && <Notice kind="danger">{errorMessage(send.error, t)}</Notice>}
        <Button disabled={f.description.trim().length < 10} loading={send.isPending} onClick={() => send.mutate()}>
          {t('Wyślij zgłoszenie')}
        </Button>
      </div>
    </Card>
  );
}


/** Kody odzyskiwania (F1.4): 10 jednorazowych kodów, pokazywane tylko raz. */
export function RecoveryCodesCard() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['recovery-codes'], queryFn: () => get<{ remaining: number }>('/api/auth/recovery-codes') });
  const [codes, setCodes] = useState<string[] | null>(null);
  const gen = useMutation({ mutationFn: () => post<{ codes: string[] }>('/api/auth/recovery-codes'), onSuccess: (r) => (setCodes(r.codes), void q.refetch()) });
  return (
    <Card title={t('Kody odzyskiwania')}>
      <div className="stack">
        <p className="small muted">{t('Jednorazowe kody na wypadek utraty telefonu z aplikacją uwierzytelniającą. Zapisz je w bezpiecznym miejscu.')}</p>
        <p>{t('Pozostało kodów: {n}', { n: q.data?.remaining ?? 0 })}</p>
        {codes && (
          <Notice kind="warn" title={t('Zapisz kody teraz — nie pokażemy ich ponownie')}>
            <div className="grid-2 mono" style={{ gap: 4 }}>
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>
              {t('Kopiuj')}
            </Button>
          </Notice>
        )}
        <Button variant="secondary" loading={gen.isPending} onClick={() => gen.mutate()}>
          {q.data?.remaining ? t('Wygeneruj nowe kody (stare przestaną działać)') : t('Wygeneruj kody')}
        </Button>
      </div>
    </Card>
  );
}

/** Weryfikacja numeru telefonu kodem SMS (F1.8). */
export function PhoneVerifyCard() {
  const { t } = useI18n();
  const { me, setMe } = useSession();
  const [phone, setPhone] = useState(me?.user?.phone ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<{ demoCode?: string } | null>(null);
  const send = useMutation({ mutationFn: () => post<{ sent: boolean; demoCode?: string }>('/api/me/phone', { phone }), onSuccess: setSent });
  const verify = useMutation({
    mutationFn: () => post<import('../types').Me>('/api/me/phone/verify', { code }),
    onSuccess: (m) => {
      setMe(m);
      setSent(null);
      setCode('');
    },
  });
  return (
    <Card title={t('Numer telefonu')} action={me?.user?.phoneVerified ? <Badge kind="ok">{t('zweryfikowany')}</Badge> : <Badge>{t('niezweryfikowany')}</Badge>}>
      <div className="stack">
        <p className="small muted">{t('Telefon służy do SMS z linkami od placówki i do przypomnień — SMS nigdy nie zawiera danych o zdrowiu.')}</p>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <TextField label={t('Telefon')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button variant="secondary" icon={<Phone size={16} />} loading={send.isPending} disabled={phone.length < 9} onClick={() => send.mutate()}>
            {t('Wyślij kod SMS')}
          </Button>
        </div>
        {sent && (
          <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
            <TextField label={t('Kod z SMS')} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} hint={sent.demoCode ? t('Tryb demonstracyjny — kod: {c}', { c: sent.demoCode }) : undefined} />
            <Button disabled={code.length !== 6} loading={verify.isPending} onClick={() => verify.mutate()}>
              {t('Potwierdź')}
            </Button>
          </div>
        )}
        {(send.isError || verify.isError) && <Notice kind="danger">{errorMessage(send.error ?? verify.error, t)}</Notice>}
      </div>
    </Card>
  );
}
