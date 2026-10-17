import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarDays, KeyRound, MessageSquare, Pill, UserPlus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { del, get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { CaregiverOverviewItem, FamilyAccess, FamilyData, FamilyProfile, ProxyAccess, ProxyRelation } from '../mvp-types';
import { useSession } from '../session';
import { Badge, Button, Card, Checkbox, Empty, Modal, Notice, PageHead, QueryError, Segmented, SelectField, Skeleton, TextField, useConfirm, useToast } from '../ui';

/**
 * Rodzina i opiekunowie (A22.1/A24.1 konto wieloprofilowe, A24.2 dostęp zastępczy, A5.13/A22.6 panel opiekuna,
 * A21.6 profil dziecka, A21.11 łącznik rodzinny). Wszystko, co opiekun robi w cudzym profilu, trafia do dziennika
 * dostępu tej osoby.
 */

export const RELATION_LABEL: Record<ProxyRelation, string> = {
  parent: 'rodzic',
  guardian: 'opiekun prawny',
  caregiver: 'osoba upoważniona',
  family: 'rodzina',
};

export const ACCESS_LABEL: Record<ProxyAccess, string> = {
  full: 'pełny dostęp',
  view: 'tylko podgląd',
};

function useFamily() {
  return useQuery({ queryKey: ['family'], queryFn: () => get<FamilyData>('/api/me/family'), retry: false });
}

/** Wybór profilu w nagłówku — widoczny, gdy jest więcej niż jeden profil. */
export function ProfileSwitcher() {
  const { t } = useI18n();
  const { profiles, profile, switchProfile } = useSession();
  const nav = useNavigate();
  const usable = profiles.filter((p) => !p.lapsed);
  if (usable.length < 2) return null;
  return (
    <label className="profile-switch">
      <span className="sr-only">{t('Profil')}</span>
      <Users size={18} aria-hidden />
      <select
        className="select"
        value={profile?.id ?? ''}
        onChange={(e) => {
          switchProfile(e.target.value || undefined);
          nav('/');
        }}
      >
        {usable.map((p) => (
          <option key={p.id} value={p.self ? '' : p.id}>
            {p.self ? t('{name} (Ty)', { name: p.name }) : p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Baner trybu opiekuna — zawsze widoczny, żeby nie pomylić profili. */
export function ProxyBanner() {
  const { t } = useI18n();
  const { profile, switchProfile } = useSession();
  const nav = useNavigate();
  if (!profile) return null;
  return (
    <div className="proxy-banner" role="status">
      <Users size={20} aria-hidden />
      <span className="grow">
        <strong>{t('Działasz w profilu: {name}', { name: profile.name })}</strong>
        <span className="small">
          {' '}
          · {profile.relation ? t(RELATION_LABEL[profile.relation]) : ''} · {profile.access !== 'self' ? t(ACCESS_LABEL[profile.access]) : ''}
        </span>
      </span>
      <Button
        size="sm"
        variant="secondary"
        icon={<ArrowLeftRight size={16} />}
        onClick={() => {
          switchProfile(undefined);
          nav('/');
        }}
      >
        {t('Wróć do swojego profilu')}
      </Button>
    </div>
  );
}

function InviteModal({ open, onClose, target }: { open: boolean; onClose: () => void; target?: FamilyProfile }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const own = !target;
  const [relation, setRelation] = useState<ProxyRelation>(own ? 'family' : 'parent');
  const [access, setAccess] = useState<ProxyAccess>('view');
  const [days, setDays] = useState('');
  const create = useMutation({
    mutationFn: () => post<{ code: string; codeExpiresAt: string }>('/api/me/family/invites', { patientId: target?.id, relation, access, days: days ? Number(days) : undefined }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['family'] }),
  });
  const close = () => {
    create.reset();
    onClose();
  };
  const relations: ProxyRelation[] = own ? ['family', 'caregiver'] : ['parent', 'guardian', 'caregiver', 'family'];
  return (
    <Modal open={open} onClose={close} title={own ? t('Zaproś osobę bliską do swojego profilu') : t('Zaproś opiekuna do profilu: {name}', { name: target?.name ?? '' })}>
      {create.data ? (
        <div className="stack">
          <p>{t('Przekaż ten kod osobie, której ufasz. Wpisze go u siebie w zakładce Rodzina.')}</p>
          <p className="invite-code" aria-label={t('Kod zaproszenia')}>
            {create.data.code}
          </p>
          <p className="small muted">{t('Kod działa jeden raz, do {d}. Dostęp odbierzesz w każdej chwili.', { d: fmt.dateTime(create.data.codeExpiresAt) })}</p>
          <Button onClick={close}>{t('Gotowe')}</Button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <SelectField label={t('Kim jest ta osoba?')} value={relation} onChange={(e) => setRelation(e.target.value as ProxyRelation)}>
            {relations.map((r) => (
              <option key={r} value={r}>
                {t(RELATION_LABEL[r])}
              </option>
            ))}
          </SelectField>
          <Segmented
            label={t('Zakres')}
            value={access}
            onChange={setAccess}
            options={[
              { value: 'view', label: t(ACCESS_LABEL.view) },
              { value: 'full', label: t(ACCESS_LABEL.full) },
            ]}
          />
          <p className="small muted">
            {access === 'view'
              ? t('Podgląd: dokumenty, wyniki, pomiary, leki i wizyty — bez zmian.')
              : t('Pełny dostęp: także wpisy, umawianie wizyt i wiadomości do placówki w imieniu tej osoby.')}
          </p>
          <SelectField label={t('Na jak długo?')} value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">{t('Do odwołania')}</option>
            <option value="7">{t('7 dni')}</option>
            <option value="30">{t('30 dni')}</option>
            <option value="90">{t('90 dni')}</option>
            <option value="365">{t('1 rok')}</option>
          </SelectField>
          {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
          <Button type="submit" loading={create.isPending} icon={<KeyRound size={18} />}>
            {t('Utwórz kod zaproszenia')}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function AccessList({ items, onRevoke, busy }: { items: FamilyAccess[]; onRevoke: (a: FamilyAccess) => void; busy?: boolean }) {
  const { t, fmt } = useI18n();
  if (!items.length) return <p className="muted small">{t('Nikt poza Tobą nie ma dostępu.')}</p>;
  return (
    <ul className="list">
      {items.map((a) => (
        <li key={a.id} className="list-item">
          <span className="grow">
            <span className="list-title" style={{ display: 'block' }}>
              {a.status === 'pending' ? t('Kod czeka na użycie') : a.you ? t('Ty') : (a.name ?? '—')}{' '}
              <Badge kind={a.status === 'active' ? 'ok' : a.status === 'pending' ? 'info' : 'warn'}>
                {a.status === 'active' ? t(ACCESS_LABEL[a.access]) : a.status === 'pending' ? t('oczekuje') : t('wygasło')}
              </Badge>
            </span>
            <span className="list-sub">
              {t(RELATION_LABEL[a.relation])}
              {a.activatedAt ? ` · ${t('od {d}', { d: fmt.date(a.activatedAt) })}` : ''}
              {a.expiresAt ? ` · ${t('do {d}', { d: fmt.date(a.expiresAt) })}` : ''}
              {a.codeExpiresAt ? ` · ${t('kod ważny do {d}', { d: fmt.dateTime(a.codeExpiresAt) })}` : ''}
            </span>
          </span>
          {a.status !== 'expired' && (
            <Button variant="ghost" size="sm" loading={busy} onClick={() => onRevoke(a)}>
              {a.status === 'pending' ? t('Unieważnij') : a.you ? t('Zrezygnuj') : t('Odbierz dostęp')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProfileAccess({ profile }: { profile: FamilyProfile }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['family-access', profile.id], queryFn: () => get<{ items: FamilyAccess[] }>(`/api/me/family/${profile.id}/access`) });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/api/me/family/links/${id}`),
    onSuccess: () => {
      toast(t('Zapisano.'));
      void qc.invalidateQueries({ queryKey: ['family-access', profile.id] });
      void qc.invalidateQueries({ queryKey: ['family'] });
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton height={48} count={1} />;
  if (q.isError) return <QueryError error={q.error} />;
  return <AccessList items={q.data!.items} onRevoke={(a) => revoke.mutate(a.id)} busy={revoke.isPending} />;
}

function OverviewCard() {
  const { t, fmt } = useI18n();
  const { switchProfile } = useSession();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['family-overview'], queryFn: () => get<{ items: CaregiverOverviewItem[] }>('/api/me/family/overview') });
  if (q.isLoading) return <Skeleton height={90} count={1} />;
  if (q.isError) return <QueryError error={q.error} />;
  if (!q.data!.items.length) return null;
  return (
    <Card title={t('Panel opiekuna')}>
      <p className="small muted" style={{ marginTop: 0 }}>{t('Stan profili, którymi się opiekujesz — same fakty z aplikacji, bez ocen.')}</p>
      <div className="grid-2">
        {q.data!.items.map((i) => {
          const id = i.patientRef.split('/')[1];
          const meds = i.medsToday;
          return (
            <article key={i.patientRef} className="overview-tile">
              <h3>
                {i.name} {i.age !== undefined && <span className="small muted">· {t('{n} lat', { n: i.age })}</span>}
              </h3>
              <p className="small">
                <CalendarDays size={16} aria-hidden />{' '}
                {i.nextAppointment ? t('Najbliższa wizyta: {d}, {s}', { d: fmt.dateTime(i.nextAppointment.start), s: i.nextAppointment.service }) : t('Brak zaplanowanych wizyt')}
              </p>
              <p className="small">
                <Pill size={16} aria-hidden />{' '}
                {meds.due + meds.taken + meds.skipped + meds.missed === 0
                  ? t('Brak przypomnień o lekach na dziś')
                  : t('Leki dziś: przyjęte {a}, pominięte {b}, bez potwierdzenia {c}, czekają {d}', { a: meds.taken, b: meds.skipped, c: meds.missed, d: meds.due })}
              </p>
              <p className="small">
                <MessageSquare size={16} aria-hidden /> {t('Nieprzeczytane wiadomości: {n}', { n: i.unreadMessages })}
              </p>
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowLeftRight size={16} />}
                onClick={() => {
                  switchProfile(id);
                  nav('/');
                }}
              >
                {t('Przejdź do profilu')}
              </Button>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function AddDependent({ basis }: { basis: FamilyData['basis'] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [relation, setRelation] = useState<'parent' | 'guardian' | 'caregiver'>('parent');
  const [declaration, setDeclaration] = useState(false);
  const [form, setForm] = useState({ given: '', family: '', birthDate: '', gender: '' });
  const add = useMutation({
    mutationFn: () => post<FamilyProfile>('/api/me/family/dependents', { ...form, gender: form.gender || undefined, relation, declaration }),
    onSuccess: (p) => {
      toast(t('Dodano profil: {name}', { name: p.name }));
      setForm({ given: '', family: '', birthDate: '', gender: '' });
      setDeclaration(false);
      void qc.invalidateQueries({ queryKey: ['family'] });
      void qc.invalidateQueries({ queryKey: ['family-overview'] });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <Card title={t('Dodaj profil dziecka lub osoby pod opieką')}>
      <form className="stack" onSubmit={submit}>
        <Segmented
          label={t('Podstawa')}
          value={relation}
          onChange={(v) => {
            setRelation(v);
            setDeclaration(false);
          }}
          options={[
            { value: 'parent', label: t('Moje dziecko') },
            { value: 'guardian', label: t('Jestem opiekunem prawnym') },
            { value: 'caregiver', label: t('Mam upoważnienie') },
          ]}
        />
        <div className="grid-2">
          <TextField label={t('Imię')} required value={form.given} onChange={(e) => setForm({ ...form, given: e.target.value })} autoComplete="off" />
          <TextField label={t('Nazwisko')} required value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} autoComplete="off" />
          <TextField label={t('Data urodzenia')} type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <SelectField label={t('Płeć')} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">{t('Nie podaję')}</option>
            <option value="female">{t('Kobieta')}</option>
            <option value="male">{t('Mężczyzna')}</option>
            <option value="other">{t('Inna')}</option>
          </SelectField>
        </div>
        <Checkbox label={t(basis.text[relation])} checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} required />
        <p className="small muted" style={{ margin: 0 }}>
          {t('Profil zobaczą placówki, w których jesteś zarejestrowany (imię i data urodzenia), żeby można było umówić wizytę. Dane o zdrowiu — tylko po udostępnieniu.')}
        </p>
        {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
        <Button type="submit" loading={add.isPending} disabled={!declaration} icon={<UserPlus size={18} />}>
          {t('Dodaj profil')}
        </Button>
      </form>
    </Card>
  );
}

function AcceptInvite() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState('');
  const accept = useMutation({
    mutationFn: () => post<FamilyProfile>('/api/me/family/accept', { code }),
    onSuccess: (p) => {
      toast(t('Masz dostęp do profilu: {name}', { name: p.name }));
      setCode('');
      void qc.invalidateQueries({ queryKey: ['family'] });
      void qc.invalidateQueries({ queryKey: ['family-overview'] });
    },
  });
  return (
    <Card title={t('Mam kod zaproszenia')}>
      <form
        className="row"
        style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          accept.mutate();
        }}
      >
        <div className="grow">
          <TextField label={t('Kod')} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCDE-FGH23" autoComplete="off" required minLength={10} />
        </div>
        <Button type="submit" loading={accept.isPending}>
          {t('Użyj kodu')}
        </Button>
      </form>
      {accept.isError && <Notice kind="danger">{errorMessage(accept.error, t)}</Notice>}
    </Card>
  );
}

export function FamilyPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { switchProfile } = useSession();
  const { confirm, dialog } = useConfirm();
  const q = useFamily();
  const [invite, setInvite] = useState<{ open: boolean; target?: FamilyProfile }>({ open: false });
  const [expanded, setExpanded] = useState<string>();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['family'] });
    void qc.invalidateQueries({ queryKey: ['family-overview'] });
  };
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/api/me/family/links/${id}`),
    onSuccess: () => {
      toast(t('Zapisano.'));
      refresh();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/me/family/dependents/${id}`),
    onSuccess: () => {
      toast(t('Profil i jego dane zostały usunięte.'));
      refresh();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });

  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  const others = d.profiles.filter((p) => !p.self);

  return (
    <div className="stack-lg">
      {dialog}
      <PageHead
        title={t('Rodzina i opiekunowie')}
        sub={t('Prowadź profile dzieci i bliskich, zaproś drugiego rodzica albo opiekuna. To, co robisz w czyimś profilu, widać w dzienniku dostępu tej osoby.')}
      />
      <OverviewCard />
      <Card title={t('Profile')}>
        {others.length === 0 ? (
          <Empty icon={<Users size={28} />} title={t('Masz tylko swój profil')}>
            {t('Dodaj profil dziecka albo użyj kodu zaproszenia od bliskiej osoby.')}
          </Empty>
        ) : (
          <ul className="list">
            {others.map((p) => (
              <li key={p.id} className="list-item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {p.name} {p.age !== undefined && <span className="small muted">· {t('{n} lat', { n: p.age })}</span>}
                  </span>
                  <span className="list-sub">
                    {p.relation ? t(RELATION_LABEL[p.relation]) : ''} · {p.access !== 'self' ? t(ACCESS_LABEL[p.access]) : ''}
                    {p.managed ? ` · ${t('profil prowadzony przez opiekunów')}` : ''}
                  </span>
                  {p.lapsed && <Notice kind="warn">{t('Ta osoba jest pełnoletnia — dostęp rodzica wygasł. Może założyć własne konto w placówce.')}</Notice>}
                </span>
                <span className="btn-row">
                  {!p.lapsed && (
                    <Button
                      size="sm"
                      icon={<ArrowLeftRight size={16} />}
                      onClick={() => {
                        switchProfile(p.id);
                        nav('/');
                      }}
                    >
                      {t('Przełącz')}
                    </Button>
                  )}
                  {p.managed && p.access === 'full' && p.relation !== 'family' && !p.lapsed && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setInvite({ open: true, target: p })}>
                        {t('Zaproś opiekuna')}
                      </Button>
                      <Button size="sm" variant="ghost" aria-expanded={expanded === p.id} onClick={() => setExpanded(expanded === p.id ? undefined : p.id)}>
                        {t('Kto ma dostęp')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('Usunąć profil: {name}?', { name: p.name }),
                            body: <p>{t('Usuniemy dokumenty, pomiary, leki i wpisy tego profilu. Dokumentacja w placówkach zostaje. Tego nie da się cofnąć.')}</p>,
                            confirmLabel: t('Usuń profil'),
                            danger: true,
                          });
                          if (ok) remove.mutate(p.id);
                        }}
                      >
                        {t('Usuń profil')}
                      </Button>
                    </>
                  )}
                  {(!p.managed || p.relation === 'family') && p.linkId && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(p.linkId!)}>
                      {t('Zrezygnuj z dostępu')}
                    </Button>
                  )}
                </span>
                {expanded === p.id && (
                  <div style={{ flexBasis: '100%' }}>
                    <ProfileAccess profile={p} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title={t('Kto ma dostęp do moich danych')}
        action={
          <Button size="sm" variant="secondary" icon={<UserPlus size={16} />} onClick={() => setInvite({ open: true })}>
            {t('Zaproś osobę bliską')}
          </Button>
        }
      >
        <AccessList items={d.access} onRevoke={(a) => revoke.mutate(a.id)} busy={revoke.isPending} />
      </Card>
      <AcceptInvite />
      <AddDependent basis={d.basis} />
      <InviteModal key={`${invite.target?.id ?? 'own'}-${invite.open}`} open={invite.open} target={invite.target} onClose={() => setInvite({ open: false })} />
    </div>
  );
}
