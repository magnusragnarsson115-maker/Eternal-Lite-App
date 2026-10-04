import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { ThreadView } from '../types';
import { Button, Notice } from './index';

/** Widok wątku wiadomości z polem odpowiedzi — wspólny dla pacjenta i personelu. */
export function ThreadConversation({ thread, viewer, replyUrl, onSent }: { thread: ThreadView; viewer: 'patient' | 'clinic'; replyUrl: string; onSent: () => void }) {
  const { t, fmt } = useI18n();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: () => post(replyUrl, { body }),
    onSuccess: () => {
      setBody('');
      onSent();
    },
  });
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages?.length]);
  return (
    <div className="stack">
      <div className="thread" role="log" aria-live="polite" aria-label={t('Wiadomości w wątku')}>
        {thread.messages?.map((m) => (
          <div key={m.id} className={`bubble ${m.from === viewer ? 'mine' : 'theirs'}`}>
            {m.body}
            <div className="meta">
              {m.senderName} · {fmt.dateTime(m.sent)}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
      >
        <label htmlFor="reply" className="sr-only">
          {t('Odpowiedź')}
        </label>
        <textarea
          id="reply"
          className="textarea"
          placeholder={t('Napisz odpowiedź…')}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) send.mutate();
          }}
        />
        <Button type="submit" loading={send.isPending} disabled={!body.trim()} icon={<Send size={18} />} aria-label={t('Wyślij')} />
      </form>
      {send.isError && <Notice kind="danger">{errorMessage(send.error, t)}</Notice>}
    </div>
  );
}
