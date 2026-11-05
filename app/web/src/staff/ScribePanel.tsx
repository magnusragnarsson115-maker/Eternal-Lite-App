import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, ClipboardCopy, Download, FilePenLine, History, Mic, Pencil, Play, Plus, RotateCcw, Send, Smartphone, Sparkles, Trash2, UserCheck, Users, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { del, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { RecorderControls } from '../shared/LinkShared';
import { useRecorder } from '../lib/recorder';
import { uploadFile } from '../lib/upload';
import type { CardDoc, NoteDoc, ScribeConfig, ScribeRole, ScribeView } from '../mvp-types';
import { Badge, Button, Card, Checkbox, Modal, Notice, SelectField, Skeleton, Spinner, TextArea, TextField, useConfirm, useToast } from '../ui';

/** D5 — Eternal Scribe: zgoda → nagranie → szkic ze źródłami → zatwierdzenie → PDF i pola do systemu; karta „Po wizycie”. */
export function ScribePanel({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['scribe-config'], queryFn: () => get<ScribeConfig>('/api/staff/scribe/config') });
  const list = useQuery({ queryKey: ['scribe-list', patientId, appointmentId], queryFn: () => get<{ items: ScribeView[] }>(`/api/staff/scribe${qs({ patientId, appointmentId })}`) });
  const current = list.data?.items.find((s) => s.status !== 'cancelled');
  const session = useQuery({
    queryKey: ['scribe', current?.id],
    queryFn: () => get<ScribeView>(`/api/staff/scribe/${current!.id}`),
    enabled: !!current,
    refetchInterval: (q) => (q.state.data && ['processing', 'recorded'].includes(q.state.data.status) ? 2000 : false),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['scribe-list'] });
    void qc.invalidateQueries({ queryKey: ['scribe'] });
    void qc.invalidateQueries({ queryKey: ['scribe-config'] });
  };
  if (cfg.isLoading || list.isLoading) return <Skeleton count={3} />;
  if (cfg.isError) return <Notice kind="danger">{errorMessage(cfg.error, t)}</Notice>;
  const c = cfg.data!;
  return (
    <div className="stack-lg">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="small muted">
          {t('Wizyty Scribe w tym miesiącu: {u} z {l}', { u: c.usage.used, l: c.usage.limit })} · {t('nagrania usuwane {n} dni po zatwierdzeniu', { n: c.retentionDays })}
        </span>
        {(c.capabilities.stt === 'demo' || c.capabilities.ai === 'demo') && <Badge kind="warn">{t('tryb demonstracyjny: przykładowa rozmowa i szkic regułami')}</Badge>}
      </div>
      {!current ? (
        <StartSession cfg={c} patientId={patientId} appointmentId={appointmentId} onStarted={refresh} />
      ) : !session.data ? (
        <Skeleton count={2} />
      ) : (
        <SessionView s={session.data} onChange={refresh} />
      )}
    </div>
  );
}

function StartSession({ cfg, patientId, appointmentId, onStarted }: { cfg: ScribeConfig; patientId: string; appointmentId?: string; onStarted: () => void }) {
  const { t } = useI18n();
  const [templateId, setTemplateId] = useState(cfg.templates[0]?.id ?? 'general');
  const [consent, setConsent] = useState(false);
  const [video, setVideo] = useState(false);
  const [note, setNote] = useState('');
  const [people, setPeople] = useState<{ role: ScribeRole; name?: string }[]>([{ role: 'lekarz' }, { role: 'pacjent' }]);
  const start = useMutation({
    mutationFn: () => post<ScribeView>('/api/staff/scribe', { patientId, appointmentId, templateId, consent: true, consentNote: note || undefined, consentVideo: video, participants: people.map((p) => ({ role: p.role, name: p.name || undefined, speaker: p.role })) }),
    onSuccess: onStarted,
  });
  const limitReached = cfg.usage.limit > 0 && cfg.usage.used >= cfg.usage.limit;
  return (
    <Card title={t('Nowa notatka z wizyty')}>
      <div className="stack">
        <SelectField label={t('Szablon notatki')} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {cfg.templates.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.name}
            </option>
          ))}
        </SelectField>
        <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t('Pacjent zgodził się na nagranie rozmowy')} hint={t('Zgoda zostanie zapisana w dokumentacji z datą i godziną.')} />
        <Checkbox
          checked={video}
          disabled={!consent}
          onChange={(e) => setVideo(e.target.checked)}
          label={t('Pacjent zgodził się także na nagranie obrazu (kamera)')}
          hint={t('Obraz służy wyłącznie dokumentacji wizyty — aplikacja nie analizuje twarzy, mimiki ani skóry. Bez tej zgody nagrywany jest tylko dźwięk.')}
        />
        <TextField label={t('Uwagi do zgody (opcjonalnie)')} value={note} onChange={(e) => setNote(e.target.value)} />
        <ParticipantsEditor value={people} onChange={setPeople} />
        {limitReached && <Notice kind="warn">{t('Osiągnięto miesięczny limit wizyt Scribe w licencji.')}</Notice>}
        {start.isError && <Notice kind="danger">{errorMessage(start.error, t)}</Notice>}
        <Button disabled={!consent || limitReached} loading={start.isPending} icon={<Mic size={18} />} onClick={() => start.mutate()}>
          {t('Rozpocznij')}
        </Button>
        <p className="small muted">{t('Szkic zawiera tylko to, co padło w rozmowie — bez rozpoznań, kodów i zaleceń niewypowiedzianych. Zawsze zatwierdza lekarz.')}</p>
      </div>
    </Card>
  );
}

function SessionView({ s, onChange }: { s: ScribeView; onChange: () => void }) {
  const { t, fmt } = useI18n();
  const { confirm, dialog } = useConfirm();
  const rec = useRecorder({ video: s.mediaKind === 'video' });
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (preview.current) preview.current.srcObject = rec.state === 'recording' || rec.state === 'paused' ? rec.stream.current : null;
  }, [rec.state, rec.stream]);
  const [phone, setPhone] = useState<{ url: string; qr: string } | null>(null);
  const upload = useMutation({ mutationFn: (b: Blob) => uploadFile<ScribeView>(`/api/staff/scribe/${s.id}/audio`, b, 'wizyta.webm', { seconds: String(rec.seconds) }), onSuccess: onChange });
  const phoneLink = useMutation({ mutationFn: () => post<{ url: string; qr: string }>(`/api/staff/scribe/${s.id}/phone-link`), onSuccess: setPhone });
  const manual = useMutation({ mutationFn: () => post(`/api/staff/scribe/${s.id}/manual`), onSuccess: onChange });
  const cancel = useMutation({ mutationFn: () => del(`/api/staff/scribe/${s.id}`), onSuccess: onChange });

  const cancelBtn = (
    <Button
      variant="ghost"
      size="sm"
      icon={<Trash2 size={16} />}
      onClick={async () => {
        if (await confirm({ title: t('Anulować notatkę?'), body: t('Nagranie i szkic zostaną usunięte.'), confirmLabel: t('Anuluj notatkę'), danger: true })) cancel.mutate();
      }}
    >
      {t('Anuluj notatkę')}
    </Button>
  );

  if (s.status === 'consented' || s.status === 'failed') {
    return (
      <Card title={t('Nagranie wizyty')} action={cancelBtn}>
        {dialog}
        <div className="stack">
          <p className="small muted">{t('Zgoda pacjenta zapisana: {d}', { d: fmt.dateTime(s.consentAt) })}</p>
          {s.status === 'failed' && <Notice kind="warn" title={t('Nie udało się przygotować szkicu')}>{t('Kod: {c}. Możesz napisać notatkę bez nagrania (tryb ograniczony).', { c: s.error ?? '' })}</Notice>}
          {s.mediaKind === 'video' && s.status === 'consented' && (
            <div className="stack-sm center">
              <Badge kind="info">
                <Video size={13} aria-hidden /> {t('nagranie z obrazem — za zgodą pacjenta, bez analizy obrazu')}
              </Badge>
              <video ref={preview} className="rec-preview" muted autoPlay playsInline aria-label={t('Podgląd kamery')} />
            </div>
          )}
          {s.status === 'consented' && <RecorderControls rec={rec} sending={upload.isPending} onSend={(b) => upload.mutate(b)} />}
          {upload.isError && <Notice kind="danger">{errorMessage(upload.error, t)}</Notice>}
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            {s.status === 'consented' && (
              <Button variant="secondary" icon={<Smartphone size={16} />} loading={phoneLink.isPending} onClick={() => phoneLink.mutate()}>
                {t('Nagraj telefonem (kod QR)')}
              </Button>
            )}
            <Button variant="ghost" icon={<FilePenLine size={16} />} loading={manual.isPending} onClick={() => manual.mutate()}>
              {t('Napisz notatkę bez nagrania')}
            </Button>
          </div>
        </div>
        <Modal open={!!phone} onClose={() => (setPhone(null), onChange())} title={t('Nagrywanie telefonem')}>
          {phone && (
            <div className="stack center">
              <div dangerouslySetInnerHTML={{ __html: phone.qr }} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
              <p className="small muted">{t('Zeskanuj kod telefonem służbowym. Link działa 3 godziny i tylko dla tej wizyty.')}</p>
            </div>
          )}
        </Modal>
      </Card>
    );
  }
  if (s.status === 'processing' || s.status === 'recorded') {
    return (
      <Card>
        <div className="stack center">
          <Spinner label={t('Przygotowywanie szkicu…')} />
          <p className="muted">{t('Transkrypcja i szkic notatki — zwykle około minuty.')}</p>
        </div>
      </Card>
    );
  }
  return (
    <>
      {dialog}
      {s.status === 'draft' ? <DraftEditor s={s} onChange={onChange} cancelBtn={cancelBtn} /> : <ApprovedNote s={s} onChange={onChange} />}
      {s.status === 'approved' && <CardEditor s={s} onChange={onChange} />}
    </>
  );
}

function AiLabel({ s, approved }: { s: ScribeView; approved?: boolean }) {
  const { t } = useI18n();
  if (s.note?.manual) return null;
  return (
    <Notice kind="info">
      <span className="row" style={{ gap: 6 }}>
        <Sparkles size={16} aria-hidden />
        {approved ? t('Szkic przygotowany przez AI, zatwierdzony przez lekarza.') : t('Szkic przygotowany przez AI — sprawdź i zatwierdź.')}
        {s.ai && <span className="small muted">({s.ai.provider}: {s.ai.model}, {s.ai.promptVersion})</span>}
      </span>
    </Notice>
  );
}

function DraftEditor({ s, onChange, cancelBtn }: { s: ScribeView; onChange: () => void; cancelBtn: React.ReactNode }) {
  const { t } = useI18n();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [note, setNote] = useState<NoteDoc>(s.note!);
  const [dirty, setDirty] = useState(false);
  const [seg, setSeg] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) setNote(s.note!);
  }, [s.note, dirty]);
  const segText = (id: string) => s.transcript?.segments.find((x) => x.id === id);
  const media = useRef<HTMLMediaElement | null>(null);
  const [fmtOpen, setFmtOpen] = useState(false);
  const section = useMutation({
    mutationFn: ({ key, action }: { key: string; action: 'accept' | 'reject' | 'reset' | 'regenerate' }) =>
      action === 'regenerate' ? post<ScribeView>(`/api/staff/scribe/${s.id}/sections/${key}/regenerate`) : post<ScribeView>(`/api/staff/scribe/${s.id}/sections/${key}`, { action }),
    onSuccess: (v) => {
      setDirty(false);
      setNote(v.note!);
      onChange();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const seek = (id: string) => {
    setSeg(id);
    const x = segText(id);
    if (media.current && x?.start !== undefined) {
      media.current.currentTime = x.start;
      void media.current.play().catch(() => undefined);
    }
    document.getElementById(`seg-${id}`)?.scrollIntoView({ block: 'nearest' });
  };
  const payload = () => ({ sections: note.sections.map((sec) => ({ key: sec.key, paragraphs: sec.paragraphs.map((p) => ({ id: p.id, text: p.text, sources: p.sources })) })) });
  const save = useMutation({
    mutationFn: () => put<ScribeView>(`/api/staff/scribe/${s.id}/note`, payload()),
    onSuccess: (v) => {
      setDirty(false);
      setNote(v.note!);
      onChange();
    },
  });
  const approve = useMutation({
    mutationFn: async () => {
      if (dirty) await put(`/api/staff/scribe/${s.id}/note`, payload());
      return post<ScribeView>(`/api/staff/scribe/${s.id}/approve`);
    },
    onSuccess: () => {
      toast(t('Notatka zatwierdzona.'));
      onChange();
    },
  });
  const problems = note.sections.flatMap((x) => x.paragraphs).filter((p) => p.problems?.length).length;
  const edit = (si: number, pi: number, text: string) => {
    setDirty(true);
    setNote({ ...note, sections: note.sections.map((sec, i) => (i !== si ? sec : { ...sec, paragraphs: sec.paragraphs.map((p, j) => (j === pi ? { ...p, text } : p)) })) });
  };
  const add = (si: number) => {
    setDirty(true);
    setNote({ ...note, sections: note.sections.map((sec, i) => (i !== si ? sec : { ...sec, paragraphs: [...sec.paragraphs, { id: '', text: '', sources: [], addedByDoctor: true }] })) });
  };
  return (
    <Card title={t('Szkic notatki')} action={cancelBtn}>
      {dialog}
      <div className="stack">
        <AiLabel s={s} />
        {problems > 0 && <Notice kind="warn">{t('Walidator źródeł: {n} akapitów wymaga sprawdzenia (oznaczone na żółto).', { n: problems })}</Notice>}
        <div className="grid-2" style={{ alignItems: 'flex-start' }}>
          <div className="stack">
            {note.sections.map((sec, si) => (
              <div key={sec.key} className={`stack note-section ${s.sectionState?.[sec.key]?.state ?? 'pending'}`} style={{ gap: 6 }}>
                <div className="row-between" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{sec.title}</h3>
                  <SectionActions state={s.sectionState?.[sec.key]?.state} busy={section.isPending || dirty} onAction={(action) => section.mutate({ key: sec.key, action })} />
                </div>
                {sec.paragraphs.length === 0 && <p className="small muted">{t('Brak treści w rozmowie.')}</p>}
                {sec.paragraphs.map((p, pi) => (
                  <div key={`${p.id}-${pi}`} style={{ background: p.problems?.length ? 'var(--warning-soft)' : undefined, padding: p.problems?.length ? 8 : 0, borderRadius: 8 }}>
                    <TextArea label={<span className="sr-only">{sec.title}</span>} value={p.text} rows={Math.min(6, Math.max(2, Math.ceil(p.text.length / 80)))} onChange={(e) => edit(si, pi, e.target.value)} />
                    <div className="row small" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {p.addedByDoctor ? (
                        <Badge>{t('dopisane przez lekarza')}</Badge>
                      ) : (
                        p.sources.map((id) => (
                          <button key={id} type="button" className="badge info" onClick={() => seek(id)} title={segText(id)?.text}>
                            {id}
                            {segText(id)?.start !== undefined ? ` · ${clockOf(segText(id)!.start!)}` : ''}
                          </button>
                        ))
                      )}
                    </div>
                    {p.problems?.map((pr, k) => (
                      <div key={k} className="small" style={{ color: 'var(--warning)' }}>
                        {pr}
                      </div>
                    ))}
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => add(si)}>
                  {t('Dodaj akapit')}
                </Button>
              </div>
            ))}
          </div>
          {s.transcript && <TranscriptPanel s={s} selected={seg} onSeek={seek} mediaRef={media} onChange={onChange} />}
        </div>
        <p className="small muted">{t('AI przygotowuje — lekarz zatwierdza. Dokumentacją staje się wyłącznie zatwierdzona wersja; sekcje odrzucone nie trafiają do dokumentacji.')}</p>
        {(save.isError || approve.isError) && <Notice kind="danger">{errorMessage(save.error ?? approve.error, t)}</Notice>}
        <FormatsModal id={s.id} open={fmtOpen} onClose={() => setFmtOpen(false)} />
        <div className="btn-row">
          <Button variant="secondary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            {t('Zapisz zmiany')}
          </Button>
          <Button variant="ghost" onClick={() => setFmtOpen(true)}>
            {t('Podgląd formatów')}
          </Button>
          <Button
            icon={<CheckCircle2 size={18} />}
            loading={approve.isPending}
            onClick={async () => {
              const ok = problems === 0 || (await confirm({ title: t('Zatwierdzić mimo uwag walidatora?'), body: t('Część akapitów nie ma pokrycia w rozmowie. Upewnij się, że treść jest prawidłowa.'), confirmLabel: t('Zatwierdź') }));
              if (ok) approve.mutate();
            }}
          >
            {t('Zatwierdź notatkę')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ApprovedNote({ s, onChange }: { s: ScribeView; onChange: () => void }) {
  const { t, fmt } = useI18n();
  const [ehr, setEhr] = useState(false);
  const [versions, setVersions] = useState(false);
  const [amending, setAmending] = useState(false);
  const [formats, setFormats] = useState(false);
  const exp = useQuery({ queryKey: ['scribe-ehr', s.id], queryFn: () => get<{ layout: string; fields: { field: string; text: string }[] }>(`/api/staff/scribe/${s.id}/export`), enabled: ehr });
  const ver = useQuery({ queryKey: ['scribe-versions', s.id], queryFn: () => get<{ items: { versionId?: string; lastUpdated?: string; status: string; author?: string; reason?: string; sections: { title?: string; html: string }[] }[] }>(`/api/staff/scribe/${s.id}/versions`), enabled: versions });
  return (
    <Card title={t('Notatka zatwierdzona')} action={<Badge kind="ok">{fmt.dateTime(s.approvedAt)}</Badge>}>
      <div className="stack">
        <AiLabel s={s} approved />
        {s.note?.sections
          .filter((x) => x.paragraphs.length)
          .map((x) => (
            <div key={x.key}>
              <h3 style={{ margin: '0 0 4px' }}>{x.title}</h3>
              {x.paragraphs.map((p) => (
                <p key={p.id} style={{ margin: '0 0 6px' }}>
                  {p.text}
                </p>
              ))}
            </div>
          ))}
        <p className="small muted">
          {s.correctedRatio !== undefined && t('Poprawione zdania szkicu: {n}%', { n: Math.round(s.correctedRatio * 100) })}
          {s.audio.deleteAfter && <> · {t('nagranie zostanie usunięte {d}', { d: fmt.date(s.audio.deleteAfter) })}</>}
          {s.audio.deletedAt && <> · {t('nagranie usunięte {d}', { d: fmt.date(s.audio.deletedAt) })}</>}
        </p>
        <div className="btn-row">
          <Button icon={<ClipboardCopy size={16} />} onClick={() => setEhr(true)}>
            {t('Kopiuj do systemu gabinetowego')}
          </Button>
          <a className="btn secondary" href={`/api/staff/scribe/${s.id}/pdf`}>
            <Download size={16} /> PDF
          </a>
          <Button variant="secondary" icon={<History size={16} />} onClick={() => setVersions(true)}>
            {t('Historia wersji')}
          </Button>
          <Button variant="secondary" onClick={() => setFormats(true)}>
            {t('Formaty: SOAP, wypis, FHIR…')}
          </Button>
          <Button variant="ghost" icon={<FilePenLine size={16} />} onClick={() => setAmending(true)}>
            {t('Popraw notatkę')}
          </Button>
        </div>
      </div>
      <FormatsModal id={s.id} open={formats} onClose={() => setFormats(false)} />
      <Modal open={ehr} onClose={() => setEhr(false)} title={t('Pola do systemu gabinetowego')} wide>
        {exp.data ? (
          <div className="stack">
            {exp.data.fields.map((f) => (
              <div key={f.field} className="card" style={{ padding: 12 }}>
                <div className="row-between">
                  <strong>{f.field}</strong>
                  <Button size="sm" variant="secondary" icon={<ClipboardCopy size={14} />} onClick={() => void navigator.clipboard?.writeText(f.text)}>
                    {t('Kopiuj')}
                  </Button>
                </div>
                <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                  {f.text || '—'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Spinner />
        )}
      </Modal>
      <Modal open={versions} onClose={() => setVersions(false)} title={t('Historia wersji notatki')} wide>
        {ver.data ? (
          <div className="stack">
            {ver.data.items.map((v) => (
              <details key={v.versionId} className="card" style={{ padding: 12 }}>
                <summary>
                  {t('Wersja {v}', { v: v.versionId ?? '' })} · {fmt.dateTime(v.lastUpdated)} · {v.author} {v.reason && <span className="muted">— {v.reason}</span>}
                </summary>
                {v.sections.map((x, i) => (
                  <div key={i} className="small" dangerouslySetInnerHTML={{ __html: x.html }} />
                ))}
              </details>
            ))}
          </div>
        ) : (
          <Spinner />
        )}
      </Modal>
      {amending && <AmendModal s={s} onClose={() => setAmending(false)} onDone={onChange} />}
    </Card>
  );
}

function AmendModal({ s, onClose, onDone }: { s: ScribeView; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState<NoteDoc>(s.note!);
  const [reason, setReason] = useState('');
  const amend = useMutation({
    mutationFn: () => post(`/api/staff/scribe/${s.id}/amend`, { reason, sections: note.sections.map((x) => ({ key: x.key, paragraphs: x.paragraphs.map((p) => ({ id: p.id, text: p.text, sources: p.sources })) })) }),
    onSuccess: () => (onDone(), onClose()),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Popraw zatwierdzoną notatkę')}
      wide
      footer={
        <Button disabled={reason.trim().length < 3} loading={amend.isPending} onClick={() => amend.mutate()}>
          {t('Zapisz nową wersję')}
        </Button>
      }
    >
      <div className="stack">
        {note.sections.map((x, si) => (
          <div key={x.key}>
            <strong>{x.title}</strong>
            {x.paragraphs.map((p, pi) => (
              <TextArea
                key={pi}
                label={<span className="sr-only">{x.title}</span>}
                value={p.text}
                onChange={(e) => setNote({ ...note, sections: note.sections.map((sec, i) => (i !== si ? sec : { ...sec, paragraphs: sec.paragraphs.map((pp, j) => (j === pi ? { ...pp, text: e.target.value } : pp)) })) })}
              />
            ))}
          </div>
        ))}
        <TextField label={t('Powód poprawki')} value={reason} onChange={(e) => setReason(e.target.value)} required />
        {amend.isError && <Notice kind="danger">{errorMessage(amend.error, t)}</Notice>}
      </div>
    </Modal>
  );
}

const lines = (a: string[]) => a.join('\n');
const split = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Karta „Po wizycie”: szkic prostym językiem z zatwierdzonej notatki → edycja → „Akceptuję i wyślij”. */
function CardEditor({ s, onChange }: { s: ScribeView; onChange: () => void }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ whatWasDone: '', nextSteps: '', whenToReturn: '', warningSigns: '', erecipeCode: '' });
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    if (s.summary) setF({ whatWasDone: lines(s.summary.whatWasDone), nextSteps: lines(s.summary.nextSteps), whenToReturn: s.summary.whenToReturn ?? '', warningSigns: lines(s.summary.warningSigns), erecipeCode: s.summary.erecipeCode ?? '' });
  }, [s.summary]);
  const gen = useMutation({ mutationFn: () => post<ScribeView>(`/api/staff/scribe/${s.id}/card`), onSuccess: onChange });
  const body = (): Omit<CardDoc, 'problems'> => ({ whatWasDone: split(f.whatWasDone), nextSteps: split(f.nextSteps), whenToReturn: f.whenToReturn.trim() || null, warningSigns: split(f.warningSigns), erecipeCode: f.erecipeCode || undefined });
  const save = useMutation({ mutationFn: () => put<ScribeView>(`/api/staff/scribe/${s.id}/card`, body()), onSuccess: onChange });
  const send = useMutation({
    mutationFn: async () => {
      await put(`/api/staff/scribe/${s.id}/card`, body());
      return post<{ channel: 'app' | 'sms' | 'none' }>(`/api/staff/scribe/${s.id}/card/send`, {});
    },
    onSuccess: (r) => {
      toast(r.channel === 'app' ? t('Karta wysłana do aplikacji pacjenta.') : r.channel === 'sms' ? t('Karta wysłana SMS-em z linkiem.') : t('Karta zapisana — brak telefonu i aplikacji pacjenta.'));
      onChange();
    },
  });
  if (s.summaryStatus === 'sent') {
    return (
      <Card title={t('Karta „Po wizycie”')} action={<Badge kind="ok">{t('wysłana {d}', { d: fmt.dateTime(s.summarySentAt) })}</Badge>}>
        <div className="btn-row">
          <Button variant="secondary" icon={<UserCheck size={16} />} onClick={() => setShareOpen(true)}>
            {t('Przekaż osobie upoważnionej')}
          </Button>
        </div>
        {shareOpen && <AuthorizedShare id={s.id} onClose={() => setShareOpen(false)} />}
      </Card>
    );
  }
  return (
    <Card title={t('Karta „Po wizycie” dla pacjenta')}>
      {!s.summary ? (
        <div className="stack">
          <p className="small muted">{t('Model przepisze zatwierdzoną notatkę prostym językiem: co zrobiono, co dalej, kiedy wrócić. Kartę sprawdzasz i akceptujesz przed wysłaniem.')}</p>
          {gen.isError && <Notice kind="danger">{errorMessage(gen.error, t)}</Notice>}
          <Button icon={<Sparkles size={16} />} loading={gen.isPending} onClick={() => gen.mutate()}>
            {t('Przygotuj szkic karty')}
          </Button>
        </div>
      ) : (
        <div className="stack">
          <Notice kind="info">{t('Szkic przygotowany przez AI z zatwierdzonej notatki — po akceptacji pacjent zobaczy oznaczenie „przygotowane przez AI, zatwierdzone przez lekarza”.')}</Notice>
          {s.summary.problems?.map((p, i) => (
            <Notice key={i} kind="warn">
              {p}
            </Notice>
          ))}
          <TextArea label={t('Co zrobiono na wizycie (jedno zdanie w wierszu)')} rows={4} value={f.whatWasDone} onChange={(e) => setF({ ...f, whatWasDone: e.target.value })} />
          <TextArea label={t('Co robić dalej (jedno zdanie w wierszu)')} rows={4} value={f.nextSteps} onChange={(e) => setF({ ...f, nextSteps: e.target.value })} />
          <TextField label={t('Kiedy wrócić')} value={f.whenToReturn} onChange={(e) => setF({ ...f, whenToReturn: e.target.value })} />
          <TextArea label={t('Kiedy zgłosić się wcześniej (tylko to, co padło na wizycie)')} rows={3} value={f.warningSigns} onChange={(e) => setF({ ...f, warningSigns: e.target.value })} />
          <TextField label={t('Kod e-recepty (4 cyfry, opcjonalnie)')} inputMode="numeric" maxLength={4} value={f.erecipeCode} onChange={(e) => setF({ ...f, erecipeCode: e.target.value.replace(/\D/g, '') })} />
          {(save.isError || send.isError) && <Notice kind="danger">{errorMessage(save.error ?? send.error, t)}</Notice>}
          <div className="btn-row">
            <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
              {t('Zapisz szkic karty')}
            </Button>
            <Button icon={<Send size={16} />} loading={send.isPending} onClick={() => send.mutate()}>
              {t('Akceptuję i wyślij')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AuthorizedShare({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: '', relation: '', phone: '', basis: 'patient-authorization' as 'patient-authorization' | 'art31-6' });
  const share = useMutation({ mutationFn: () => post<{ expiresAt: string }>(`/api/staff/scribe/${id}/card/authorized`, f) });
  return (
    <Modal open onClose={onClose} title={t('Przekaż kartę osobie upoważnionej')}>
      {share.isSuccess ? (
        <Notice kind="ok">{t('Link do karty wysłany SMS-em (ważny 14 dni). Przekazanie zapisano w dzienniku.')}</Notice>
      ) : (
        <div className="stack">
          <TextField label={t('Imię i nazwisko')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextField label={t('Pokrewieństwo / relacja')} value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} />
          <TextField label={t('Telefon')} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <SelectField label={t('Podstawa')} value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as typeof f.basis })}>
            <option value="patient-authorization">{t('Upoważnienie pacjenta')}</option>
            <option value="art31-6">{t('Pacjent nieprzytomny lub niezdolny — art. 31 ust. 6 ustawy o zawodach lekarza')}</option>
          </SelectField>
          {share.isError && <Notice kind="danger">{errorMessage(share.error, t)}</Notice>}
          <Button disabled={f.name.length < 2 || f.relation.length < 2 || !f.phone} loading={share.isPending} onClick={() => share.mutate()}>
            {t('Wyślij link')}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function clockOf(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

const ROLES: ScribeRole[] = ['lekarz', 'pacjent', 'opiekun', 'tłumacz', 'pielęgniarka', 'inny'];

function useRoleLabel() {
  const { t } = useI18n();
  return (r: ScribeRole) => ({ lekarz: t('lekarz'), pacjent: t('pacjent'), opiekun: t('opiekun'), tłumacz: t('tłumacz'), pielęgniarka: t('pielęgniarka'), inny: t('inna osoba') })[r];
}

/** Uczestnicy rozmowy (A12.1) — role i opcjonalnie imiona; rola służy też jako etykieta mówcy w transkrypcji. */
function ParticipantsEditor({ value, onChange }: { value: { role: ScribeRole; name?: string }[]; onChange: (v: { role: ScribeRole; name?: string }[]) => void }) {
  const { t } = useI18n();
  const label = useRoleLabel();
  return (
    <fieldset className="fieldset">
      <legend className="small">
        <Users size={14} aria-hidden /> {t('Uczestnicy rozmowy')}
      </legend>
      <div className="stack-sm">
        {value.map((p, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <select className="select sm" aria-label={t('Rola uczestnika')} value={p.role} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, role: e.target.value as ScribeRole } : x)))}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
            <input className="input sm" aria-label={t('Imię (opcjonalnie)')} placeholder={t('Imię (opcjonalnie)')} value={p.name ?? ''} maxLength={80} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            {value.length > 1 && (
              <button type="button" className="icon-btn" title={t('Usuń')} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={14} aria-hidden />
                <span className="sr-only">{t('Usuń')}</span>
              </button>
            )}
          </div>
        ))}
        {value.length < 8 && (
          <button type="button" className="link-btn" onClick={() => onChange([...value, { role: 'opiekun' }])}>
            + {t('dodaj uczestnika')}
          </button>
        )}
      </div>
    </fieldset>
  );
}

function SectionActions({ state, busy, onAction }: { state?: string; busy: boolean; onAction: (a: 'accept' | 'reject' | 'reset' | 'regenerate') => void }) {
  const { t } = useI18n();
  return (
    <div className="row section-actions" style={{ gap: 4 }}>
      {state === 'accepted' && <Badge kind="ok">{t('zaakceptowana')}</Badge>}
      {state === 'corrected' && <Badge kind="info">{t('poprawiona')}</Badge>}
      {state === 'rejected' && <Badge kind="warn">{t('odrzucona — poza dokumentacją')}</Badge>}
      {state !== 'accepted' && (
        <button type="button" className="icon-btn" disabled={busy} title={t('Akceptuj sekcję')} onClick={() => onAction('accept')}>
          <Check size={15} aria-hidden />
          <span className="sr-only">{t('Akceptuj sekcję')}</span>
        </button>
      )}
      {state !== 'rejected' && (
        <button type="button" className="icon-btn" disabled={busy} title={t('Odrzuć sekcję')} onClick={() => onAction('reject')}>
          <X size={15} aria-hidden />
          <span className="sr-only">{t('Odrzuć sekcję')}</span>
        </button>
      )}
      <button type="button" className="icon-btn" disabled={busy} title={t('Przygotuj sekcję ponownie z rozmowy')} onClick={() => onAction('regenerate')}>
        <Sparkles size={15} aria-hidden />
        <span className="sr-only">{t('Przygotuj sekcję ponownie z rozmowy')}</span>
      </button>
      {state && state !== 'pending' && (
        <button type="button" className="icon-btn" disabled={busy} title={t('Cofnij decyzję')} onClick={() => onAction('reset')}>
          <RotateCcw size={15} aria-hidden />
          <span className="sr-only">{t('Cofnij decyzję')}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Transkrypcja (A12.2): mówcy, znaczniki czasu, odsłuch fragmentu po kliknięciu, poprawka tekstu lub mówcy
 * (każda poprawka zapisana: przed → po, kto, kiedy). Obraz z wizyty tylko gdy była na niego zgoda.
 */
function TranscriptPanel({ s, selected, onSeek, mediaRef, onChange }: { s: ScribeView; selected: string | null; onSeek: (id: string) => void; mediaRef: React.MutableRefObject<HTMLMediaElement | null>; onChange: () => void }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const label = useRoleLabel();
  const [editing, setEditing] = useState<{ id: string; text: string; speaker?: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const edits = useQuery({ queryKey: ['transcript-edits', s.id, s.transcriptEdits], queryFn: () => get<{ items: { segmentId: string; before?: string; after?: string; beforeSpeaker?: string; afterSpeaker?: string; by?: string; at: string }[] }>(`/api/staff/scribe/${s.id}/transcript-edits`), enabled: historyOpen });
  const save = useMutation({
    mutationFn: (e: { id: string; text: string; speaker?: string }) => put<ScribeView>(`/api/staff/scribe/${s.id}/transcript/${e.id}`, { text: e.text, speaker: e.speaker }),
    onSuccess: () => {
      setEditing(null);
      onChange();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const speakers = [...new Set([...(s.participants ?? []).map((p) => p.speaker ?? p.role), ...s.transcript!.segments.map((x) => x.speaker).filter((x): x is string => !!x)])];
  const speakerName = (sp?: string) => {
    if (!sp) return '';
    const p = (s.participants ?? []).find((x) => (x.speaker ?? x.role) === sp);
    return p ? `${label(p.role)}${p.name ? ` (${p.name})` : ''}` : sp;
  };
  const src = `/api/staff/scribe/${s.id}/audio`;
  return (
    <div className="card transcript" style={{ padding: 12, maxHeight: 720, overflow: 'auto' }}>
      <div className="row-between">
        <strong>{t('Transkrypcja')}</strong>
        {s.transcriptEdits ? (
          <button type="button" className="link-btn small" onClick={() => setHistoryOpen(true)}>
            {t('poprawki: {n}', { n: s.transcriptEdits })}
          </button>
        ) : null}
      </div>
      {s.audio.present &&
        (s.mediaKind === 'video' ? (
          <video ref={(el) => { mediaRef.current = el; }} src={src} controls preload="metadata" className="rec-player" aria-label={t('Nagranie wizyty')} />
        ) : (
          <audio ref={(el) => { mediaRef.current = el; }} src={src} controls preload="metadata" className="rec-player" aria-label={t('Nagranie wizyty')} />
        ))}
      {(s.participants ?? []).length > 0 && (
        <p className="small muted">
          {t('Uczestnicy')}: {(s.participants ?? []).map((p) => `${label(p.role)}${p.name ? ` ${p.name}` : ''}`).join(', ')}
        </p>
      )}
      <p className="small muted">{t('Kliknij zdanie, aby odsłuchać fragment. Ołówek — poprawka tekstu lub mówcy.')}</p>
      <ol className="segments small">
        {s.transcript!.segments.map((x) => (
          <li key={x.id} id={`seg-${x.id}`} className={selected === x.id ? 'on' : ''}>
            {editing?.id === x.id ? (
              <div className="stack-sm">
                <select className="select sm" aria-label={t('Mówca')} value={editing.speaker ?? ''} onChange={(e) => setEditing({ ...editing, speaker: e.target.value || undefined })}>
                  <option value="">{t('(bez mówcy)')}</option>
                  {speakers.map((sp) => (
                    <option key={sp} value={sp}>
                      {speakerName(sp)}
                    </option>
                  ))}
                </select>
                <textarea className="textarea" rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label={t('Tekst fragmentu')} />
                <div className="btn-row">
                  <Button size="sm" loading={save.isPending} onClick={() => save.mutate(editing)}>
                    {t('Zapisz poprawkę')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {t('Anuluj')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="seg-row">
                <button type="button" className="seg-play" onClick={() => onSeek(x.id)} title={t('Odsłuchaj fragment')}>
                  <Play size={12} aria-hidden />
                  <span className="tabular">{x.start !== undefined ? clockOf(x.start) : x.id}</span>
                </button>
                <span className="grow">
                  <strong>{x.id}</strong> {x.speaker && <span className="muted">[{speakerName(x.speaker)}]</span>} {x.text}
                </span>
                <button type="button" className="icon-btn" title={t('Popraw fragment')} onClick={() => setEditing({ id: x.id, text: x.text, speaker: x.speaker })}>
                  <Pencil size={13} aria-hidden />
                  <span className="sr-only">{t('Popraw fragment')}</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('Poprawki transkrypcji')}>
        <ul className="plain stack-sm">
          {(edits.data?.items ?? []).map((e, i) => (
            <li key={i} className="small">
              <strong>{e.segmentId}</strong> · {e.by} · <span className="muted">{fmt.dateTime(e.at)}</span>
              {e.before !== e.after && (
                <div>
                  <span className="mono muted">„{e.before}”</span> → <span className="mono">„{e.after}”</span>
                </div>
              )}
              {e.beforeSpeaker !== e.afterSpeaker && (
                <div>
                  {t('mówca')}: {e.beforeSpeaker ?? '—'} → {e.afterSpeaker ?? '—'}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

type FormatId = 'clinical' | 'soap' | 'discharge' | 'summary' | 'ehr' | 'fhir';

/** Ta sama treść w różnych formatach (A12.5): SOAP, notatka kliniczna, wypis, podsumowanie, pola HIS/EHR/EDM, FHIR. */
function FormatsModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [fmtId, setFmtId] = useState<FormatId>('soap');
  const q = useQuery({
    queryKey: ['scribe-format', id, fmtId],
    queryFn: () => get<{ format: FormatId; title: string; approved: boolean; sections: { title: string; text: string }[]; fhir?: unknown }>(`/api/staff/scribe/${id}/format/${fmtId}`),
    enabled: open,
  });
  const names: Record<FormatId, string> = {
    clinical: t('Notatka kliniczna'),
    soap: 'SOAP',
    discharge: t('Karta informacyjna (wypis)'),
    summary: t('Podsumowanie wizyty dla pacjenta'),
    ehr: t('Pola HIS/EHR/EDM'),
    fhir: 'FHIR (EDM)',
  };
  const copy = (text: string) => void navigator.clipboard?.writeText(text).then(() => toast(t('Skopiowano.')));
  return (
    <Modal open={open} onClose={onClose} title={t('Formaty notatki')} wide>
      <div className="stack">
        <div className="chip-row" role="group" aria-label={t('Format')}>
          {(Object.keys(names) as FormatId[]).map((f) => (
            <button key={f} type="button" className={`filter-chip ${fmtId === f ? 'on' : ''}`} aria-pressed={fmtId === f} onClick={() => setFmtId(f)}>
              {names[f]}
            </button>
          ))}
        </div>
        {q.data && !q.data.approved && <Notice kind="warn">{t('Szkic — niezatwierdzony. Dokumentacją staje się dopiero zatwierdzona wersja.')}</Notice>}
        {q.isLoading ? (
          <Skeleton count={3} height={40} />
        ) : q.data?.fhir ? (
          <div className="stack-sm">
            <Button size="sm" variant="secondary" icon={<ClipboardCopy size={14} />} onClick={() => copy(JSON.stringify(q.data!.fhir, null, 2))}>
              {t('Kopiuj JSON')}
            </Button>
            <pre className="code-block">{JSON.stringify(q.data.fhir, null, 2)}</pre>
          </div>
        ) : (
          (q.data?.sections ?? []).map((x) => (
            <div key={x.title} className="card" style={{ padding: 12 }}>
              <div className="row-between">
                <strong>{x.title}</strong>
                <Button size="sm" variant="ghost" icon={<ClipboardCopy size={14} />} onClick={() => copy(x.text)}>
                  {t('Kopiuj')}
                </Button>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{x.text || '—'}</p>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
