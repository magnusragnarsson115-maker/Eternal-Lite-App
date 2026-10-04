import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { AppointmentStatus } from '../types';

// --- przyciski -----------------------------------------------------------------------------------

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';

export function Button({
  variant = 'primary',
  size,
  block,
  loading,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'; block?: boolean; loading?: boolean; icon?: ReactNode }) {
  const cls = ['btn', variant !== 'primary' ? variant : '', size ?? '', block ? 'block' : '', !children ? 'icon' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={rest.disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={18} className="spin-icon" aria-hidden style={{ animation: 'spin 0.8s linear infinite' }} /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', size, block, icon, children }: { to: string; variant?: BtnVariant; size?: 'sm'; block?: boolean; icon?: ReactNode; children: ReactNode }) {
  const cls = ['btn', variant !== 'primary' ? variant : '', size ?? '', block ? 'block' : ''].filter(Boolean).join(' ');
  return (
    <Link to={to} className={cls}>
      {icon}
      {children}
    </Link>
  );
}

// --- pola formularza ------------------------------------------------------------------------------

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  required?: boolean;
}

export function Field({ label, hint, error, children, required }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  required,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(p) => <input className="input" required={required} {...p} {...rest} />}
    </Field>
  );
}

export function TextArea({ label, hint, error, required, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(p) => <textarea className="textarea" required={required} {...p} {...rest} />}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <select className="select" required={required} {...p} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label className="check" htmlFor={id}>
      <input type="checkbox" id={id} {...rest} />
      <span>
        {label}
        {hint && <span className="hint" style={{ display: 'block', color: 'var(--muted)', fontSize: '0.84rem' }}>{hint}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-checked={checked} aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// --- prezentacja ------------------------------------------------------------------------------------

export function Card({ children, className, title, action, as: As = 'section' }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return (
    <As className={`card ${className ?? ''}`}>
      {(title || action) && (
        <div className="card-title">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

export function PageHead({ title, sub, action, back }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="page-head">
      {back && (
        <Link to={back.to} className="back-link">
          ← {back.label}
        </Link>
      )}
      <div className="row-between">
        <div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Notice({ kind = 'info', children, title }: { kind?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode; title?: string }) {
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'danger' ? XCircle : kind === 'warn' ? AlertTriangle : Info;
  return (
    <div className={`notice ${kind}`} role={kind === 'danger' ? 'alert' : undefined}>
      <Icon size={20} aria-hidden />
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Badge({ kind, children }: { kind?: 'ok' | 'warn' | 'danger' | 'info' | 'primary'; children: ReactNode }) {
  return <span className={`badge ${kind ?? ''}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  const map: Record<string, [string, 'ok' | 'warn' | 'danger' | 'info' | 'primary' | undefined]> = {
    booked: [t('Zaplanowana'), 'primary'],
    arrived: [t('Pacjent na miejscu'), 'info'],
    'checked-in': [t('Pacjent na miejscu'), 'info'],
    fulfilled: [t('Zrealizowana'), 'ok'],
    cancelled: [t('Odwołana'), undefined],
    noshow: [t('Nieobecność'), 'danger'],
    pending: [t('Oczekuje'), 'warn'],
  };
  const [label, kind] = map[status] ?? [status, undefined];
  return <Badge kind={kind}>{label}</Badge>;
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="center" role="status">
      <div className="spinner" aria-hidden />
      <span className="sr-only">{label ?? t('Wczytywanie…')}</span>
    </div>
  );
}

export function Skeleton({ height = 72, count = 3 }: { height?: number; count?: number }) {
  return (
    <div className="stack" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <p style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>{title}</p>
      {children}
    </div>
  );
}

export function QueryError({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <Notice kind="danger" title={t('Nie udało się wczytać danych')}>
      <p>{(error as Error)?.message}</p>
      {retry && (
        <Button size="sm" variant="secondary" onClick={retry}>
          {t('Spróbuj ponownie')}
        </Button>
      )}
    </Notice>
  );
}

// --- okno dialogowe ---------------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('Zamknij')} icon={<X size={18} />} />
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

// --- powiadomienia (toasty) -------------------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

const ToastCtx = createContext<(text: string, kind?: 'info' | 'error') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'error' ? <XCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// --- autouzupełnianie --------------------------------------------------------------------------------

export function Combobox<T>({
  label,
  placeholder,
  search,
  render,
  onSelect,
  hint,
  minChars = 2,
}: {
  label: string;
  placeholder?: string;
  search: (q: string, signal: AbortSignal) => Promise<T[]>;
  render: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  hint?: ReactNode;
  minChars?: number;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (q.trim().length < minChars) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      search(q.trim(), ctrl.signal)
        .then((r) => {
          setItems(r);
          setActive(0);
          setOpen(true);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, search, minChars]);

  const choose = (item: T) => {
    onSelect(item);
    setOpen(false);
    setQ('');
    setItems([]);
  };

  return (
    <div className="field combo">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && items.length ? `${id}-opt-${active}` : undefined}
        placeholder={placeholder}
        value={q}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {hint && <span className="hint">{hint}</span>}
      {open && (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {loading && <li aria-disabled="true">{t('Szukam…')}</li>}
          {!loading && items.length === 0 && <li aria-disabled="true">{t('Brak wyników')}</li>}
          {items.map((item, i) => (
            <li
              key={i}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: ReactNode; confirmLabel: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const { t } = useI18n();
  const confirm = useCallback(
    (opts: { title: string; body: ReactNode; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setState({ ...opts, confirmLabel: opts.confirmLabel ?? t('Potwierdź'), resolve })),
    [t],
  );
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => {
        state?.resolve(false);
        setState(null);
      }}
      title={state?.title ?? ''}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              state?.resolve(false);
              setState(null);
            }}
          >
            {t('Anuluj')}
          </Button>
          <Button
            variant={state?.danger ? 'danger' : 'primary'}
            onClick={() => {
              state?.resolve(true);
              setState(null);
            }}
          >
            {state?.confirmLabel}
          </Button>
        </>
      }
    >
      {state?.body}
    </Modal>
  );
  return { confirm, dialog };
}

export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div className="demo-banner" role="note">
      <strong>{t('DANE FIKCYJNE')}</strong> · {t('Wszystkie osoby, wyniki i terminy w tej instancji są fikcyjne.')}
    </div>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 512 512" fill="none">
        <path d="M256 132c-40 0-72 22-92 54-14-6-30-9-46-6 4 66 50 120 112 134v66h52v-66c62-14 108-68 112-134-16-3-32 0-46 6-20-32-52-54-92-54z" stroke="#fff" strokeWidth="34" strokeLinejoin="round" />
        <circle cx="256" cy="226" r="30" fill="#fff" />
      </svg>
    </span>
  );
}

export function formatBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
