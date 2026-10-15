import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { get, post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { EmergencyAccessView, EmergencyReason } from '../mvp-types';
import { Badge, Button, Card, Checkbox, Empty, Modal, Notice, QueryError, SelectField, Skeleton, TextArea, useToast } from '../ui';

/**
 * Dostęp ratunkowy z pełnym logiem (A24.5). Lekarz otwiera dane pacjenta bez udostępnienia tylko w nagłym przypadku:
 * powód, uzasadnienie, 60 minut, powiadomienie pacjenta, przegląd administratora.
 */

export const EMERGENCY_REASON_LABEL: Record<EmergencyReason, string> = {
  unconscious: 'Pacjent nieprzytomny lub niezdolny do wyrażenia zgody',
  'life-threat': 'Bezpośrednie zagrożenie życia lub zdrowia',
  'urgent-care': 'Pilna pomoc, brak możliwości kontaktu z pacjentem',
};

/** W raporcie faktów: przycisk otwarcia albo pasek aktywnego dostępu z zakończeniem. */
export function EmergencyAccessControl({ patientId, active }: { patientId: string; active?: { id: string; expiresAt: string } }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EmergencyReason>('unconscious');
  const [justification, setJustification] = useState('');
  const [confirm, setConfirm] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['facts', patientId] });
  const start = useMutation({
    mutationFn: () => post(`/api/staff/patients/${patientId}/emergency-access`, { reason, justification, confirm }),
    onSuccess: () => {
      setOpen(false);
      setJustification('');
      setConfirm(false);
      toast(t('Dostęp ratunkowy otwarty na 60 minut. Pacjent i administrator zostali powiadomieni.'));
      refresh();
    },
  });
  const end = useMutation({
    mutationFn: (id: string) => post(`/api/staff/emergency-access/${id}/end`),
    onSuccess: () => {
      toast(t('Dostęp ratunkowy zakończony.'));
      refresh();
    },
  });

  if (active) {
    return (
      <Notice kind="danger" title={t('Dostęp ratunkowy aktywny do {t}', { t: fmt.time(active.expiresAt) })}>
        <p style={{ margin: '0 0 8px' }}>{t('Widzisz dane z sejfu pacjenta bez jego udostępnienia. Każde otwarcie jest zapisane, pacjent je widzi, a administrator ocenia.')}</p>
        <Button size="sm" variant="secondary" loading={end.isPending} onClick={() => end.mutate(active.id)}>
          {t('Zakończ dostęp ratunkowy')}
        </Button>
      </Notice>
    );
  }
  return (
    <>
      <Button variant="secondary" size="sm" icon={<ShieldAlert size={16} />} onClick={() => setOpen(true)}>
        {t('Dostęp ratunkowy')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Dostęp ratunkowy do danych pacjenta')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate();
          }}
        >
          <Notice kind="warn">
            {t('Tylko w nagłym przypadku, gdy pacjent nie może udostępnić danych. Dostęp trwa 60 minut, jest zapisywany w dzienniku, pacjent dostaje powiadomienie, a administrator ocenia każde użycie.')}
          </Notice>
          <SelectField label={t('Powód')} value={reason} onChange={(e) => setReason(e.target.value as EmergencyReason)}>
            {(Object.keys(EMERGENCY_REASON_LABEL) as EmergencyReason[]).map((r) => (
              <option key={r} value={r}>
                {t(EMERGENCY_REASON_LABEL[r])}
              </option>
            ))}
          </SelectField>
          <TextArea label={t('Uzasadnienie (co najmniej 20 znaków)')} required minLength={20} maxLength={2000} rows={4} value={justification} onChange={(e) => setJustification(e.target.value)} />
          <Checkbox label={t('Potwierdzam, że to nagły przypadek i biorę odpowiedzialność za ten dostęp.')} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          {start.isError && <Notice kind="danger">{errorMessage(start.error, t)}</Notice>}
          <Button type="submit" variant="danger" loading={start.isPending} disabled={!confirm || justification.trim().length < 20}>
            {t('Otwórz dostęp na 60 minut')}
          </Button>
        </form>
      </Modal>
    </>
  );
}

/** Zakładka administratora: każde użycie do oceny; „nieuzasadniony” zakłada zgłoszenie naruszenia. */
export function EmergencyReviewTab() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ['admin-emergency'], queryFn: () => get<{ items: EmergencyAccessView[] }>('/api/admin/emergency-access') });
  const review = useMutation({
    mutationFn: (v: { id: string; outcome: 'justified' | 'unjustified' }) => post(`/api/admin/emergency-access/${v.id}/review`, { outcome: v.outcome, note: notes[v.id] || undefined }),
    onSuccess: (_r, v) => {
      toast(v.outcome === 'unjustified' ? t('Zapisano ocenę i założono zgłoszenie naruszenia.') : t('Zapisano ocenę.'));
      void qc.invalidateQueries({ queryKey: ['admin-emergency'] });
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const items = q.data!.items;
  return (
    <div className="stack">
      <Notice kind="info">
        {t('Każde otwarcie danych bez udostępnienia trzeba ocenić. Ocena „nieuzasadniony” zakłada zgłoszenie możliwego naruszenia ochrony danych (72 godziny na ocenę — art. 33 RODO).')}
      </Notice>
      {items.length === 0 ? (
        <Empty title={t('Nikt nie korzystał z dostępu ratunkowego')} />
      ) : (
        items.map((e) => (
          <Card key={e.id}>
            <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>{e.who}</strong> → {e.patientName ?? '—'}
                <span className="small muted" style={{ display: 'block' }}>
                  {fmt.dateTime(e.startedAt)} · {t(EMERGENCY_REASON_LABEL[e.reason])}
                  {e.endedAt ? ` · ${t('zakończony {d}', { d: fmt.time(e.endedAt) })}` : e.active ? ` · ${t('aktywny')}` : ''}
                </span>
              </span>
              {e.review ? (
                <Badge kind={e.review.outcome === 'justified' ? 'ok' : 'danger'}>{e.review.outcome === 'justified' ? t('uzasadniony') : t('nieuzasadniony')}</Badge>
              ) : (
                <Badge kind="warn">{t('do oceny')}</Badge>
              )}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{e.justification}</p>
            {e.review ? (
              <p className="small muted" style={{ margin: 0 }}>
                {t('Ocenił(a) {who}, {d}', { who: e.review.by ?? '—', d: fmt.dateTime(e.review.at) })}
                {e.review.note ? ` — ${e.review.note}` : ''}
              </p>
            ) : (
              <div className="stack">
                <TextArea label={t('Uwagi do oceny')} rows={2} value={notes[e.id] ?? ''} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} />
                <div className="btn-row">
                  <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ id: e.id, outcome: 'justified' })}>
                    {t('Uzasadniony')}
                  </Button>
                  <Button size="sm" variant="danger" loading={review.isPending} onClick={() => review.mutate({ id: e.id, outcome: 'unjustified' })}>
                    {t('Nieuzasadniony')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

/** Pacjent: kto otworzył dane w nagłym przypadku i czy dostęp oceniono. */
export function EmergencyAccessCard() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['emergency-access'], queryFn: () => get<{ items: EmergencyAccessView[] }>('/api/me/emergency-access') });
  if (!q.data?.items.length) return null;
  return (
    <Card title={t('Dostęp ratunkowy do Twoich danych')}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('Lekarz może otworzyć Twoje dane bez udostępnienia tylko w nagłym przypadku, na 60 minut. Każde takie otwarcie ocenia administrator placówki.')}
      </p>
      <ul className="list">
        {q.data.items.map((e) => (
          <li key={e.id} className="list-item">
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>
                {e.who} · {e.clinic}
              </span>
              <span className="list-sub">
                {fmt.dateTime(e.startedAt)} · {t(EMERGENCY_REASON_LABEL[e.reason])}
              </span>
            </span>
            {e.review ? (
              <Badge kind={e.review.outcome === 'justified' ? 'ok' : 'danger'}>{e.review.outcome === 'justified' ? t('oceniony jako uzasadniony') : t('oceniony jako nieuzasadniony')}</Badge>
            ) : (
              <Badge kind="info">{t('w ocenie')}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
