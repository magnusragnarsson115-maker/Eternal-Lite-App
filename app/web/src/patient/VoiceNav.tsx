import { Mic, MicOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { listenOnce, matchCommand, speechSupported, VOICE_COMMANDS } from '../lib/voice';
import { Button, Modal, useToast } from '../ui';

const ACK = 'eternal.voice.ack.v1';

function acknowledged(): boolean {
  try {
    return localStorage.getItem(ACK) === '1';
  } catch {
    return false;
  }
}

/** Przycisk mikrofonu w nagłówku (A17.10) — widoczny tylko, gdy przeglądarka obsługuje rozpoznawanie mowy. */
export function VoiceNavButton() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [info, setInfo] = useState(false);
  const stop = useRef<() => void>(() => undefined);
  if (!speechSupported()) return null;

  const run = () => {
    const l = listenOnce(locale === 'en' ? 'en-GB' : 'pl-PL');
    stop.current = l.stop;
    setListening(true);
    l.promise
      .then((alts) => {
        const hit = alts.map(matchCommand).find(Boolean);
        if (hit === 'back') navigate(-1);
        else if (hit) {
          navigate(hit.to);
          toast(t('Przechodzę do: {s}', { s: t(hit.label) }));
        } else toast(t('Nie rozpoznano polecenia. Powiedz np. „wyniki”, „leki” albo „pomoc”.'));
      })
      .catch((err: Error) => toast(err.message === 'not-allowed' ? t('Przeglądarka nie ma dostępu do mikrofonu.') : t('Rozpoznawanie mowy jest teraz niedostępne.')))
      .finally(() => setListening(false));
  };

  return (
    <>
      <Button
        variant="ghost"
        aria-label={listening ? t('Zatrzymaj słuchanie') : t('Sterowanie głosem')}
        aria-pressed={listening}
        icon={listening ? <MicOff size={22} /> : <Mic size={22} />}
        onClick={() => (listening ? stop.current() : acknowledged() ? run() : setInfo(true))}
      />
      <Modal open={info} onClose={() => setInfo(false)} title={t('Sterowanie głosem')}>
        <div className="stack">
          <p style={{ margin: 0 }}>{t('Powiedz nazwę ekranu, np. „wyniki”, „leki”, „wizyty”, „apteki”, „pomoc” albo „wstecz”.')}</p>
          <p className="small" style={{ margin: 0 }}>
            {t('Mowę rozpoznaje przeglądarka. W niektórych przeglądarkach (np. Chrome) nagranie jest wysyłane do serwerów jej producenta. Aplikacja nie zapisuje nagrań ani tekstu i rozpoznaje wyłącznie polecenia przejścia — głosem nie da się niczego wysłać ani zadzwonić.')}
          </p>
          <details>
            <summary>{t('Wszystkie polecenia')}</summary>
            <ul className="small">
              {VOICE_COMMANDS.map((c) => (
                <li key={c.to}>
                  {t(c.label)} — „{c.words[0]}…”
                </li>
              ))}
            </ul>
          </details>
          <div className="btn-row">
            <Button
              onClick={() => {
                try {
                  localStorage.setItem(ACK, '1');
                } catch {
                  /* brak pamięci przeglądarki — zapytamy następnym razem */
                }
                setInfo(false);
                run();
              }}
            >
              {t('Rozumiem, słuchaj')}
            </Button>
            <Button variant="ghost" onClick={() => setInfo(false)}>
              {t('Anuluj')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
