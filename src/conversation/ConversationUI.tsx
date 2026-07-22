'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChapterId } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';
import { useConversation } from './engine';

/** Cinematic dialogue: character in the 3D stage, subtitle-style text below. */
export function ConversationUI({
  chapterId, onContinue,
}: {
  chapterId: ChapterId;
  onContinue: () => void;
}) {
  const meta = chapterMeta(chapterId);
  const convo = useConversation();
  const [draft, setDraft] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!started.current || convo.chapterId !== chapterId) {
      started.current = true;
      useConversation.getState().start(chapterId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const lastCharacterLine =
    [...convo.messages].reverse().find((m) => m.role === 'character')?.text ?? '';
  const pct = Math.round((convo.progress.covered / Math.max(1, convo.progress.total)) * 100);

  const submit = () => {
    if (!draft.trim()) return;
    convo.send(draft.trim());
    setDraft('');
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-end">
      {/* name plate */}
      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <div className="text-sm tracking-wide text-stone-200">{meta.characterName}</div>
        <div className="text-[11px] text-stone-500">
          Fictional composite, based on documented experiences · {meta.location}, {meta.dates}
        </div>
      </div>

      {/* progress hint: a quiet notebook dot filling as the history gets covered */}
      <div
        className="absolute right-4 top-16 flex items-center gap-2"
        title="This conversation covers the chapter's key history as you talk"
      >
        <svg width="26" height="26" viewBox="0 0 26 26" aria-label={`Learning progress ${pct}%`}>
          <circle cx="13" cy="13" r="11" fill="none" stroke="#44403c" strokeWidth="2" />
          <circle
            cx="13" cy="13" r="11" fill="none" stroke="#d6b97a" strokeWidth="2"
            strokeDasharray={`${(pct / 100) * 69.1} 69.1`} strokeLinecap="round"
            transform="rotate(-90 13 13)" style={{ transition: 'stroke-dasharray 0.8s' }}
          />
        </svg>
      </div>

      <div className="mx-auto mb-4 w-full max-w-3xl px-4">
        {/* subtitle line */}
        <div className="min-h-24 rounded-md bg-stone-950/70 px-6 py-4 text-center backdrop-blur-sm">
          {convo.status === 'error' ? (
            <div>
              <p className="italic text-stone-400">
                …the line crackles. “Say that again? I lost you for a moment.”
              </p>
              <button
                onClick={() => convo.retry()}
                className="mt-2 rounded-sm border border-amber-200/40 px-4 py-1 text-xs tracking-widest text-amber-100"
              >
                REPEAT
              </button>
            </div>
          ) : convo.status === 'sending' && lastCharacterLine === '' ? (
            <p className="animate-pulse text-stone-500">…</p>
          ) : (
            <Typewriter
              key={convo.messages.length}
              text={lastCharacterLine}
              className="text-[15px] leading-relaxed text-stone-100"
            />
          )}
          {convo.status === 'sending' && lastCharacterLine !== '' && (
            <span className="ml-1 inline-block animate-pulse text-stone-500">…</span>
          )}
        </div>

        {/* guided questions */}
        {convo.status === 'idle' && convo.guided.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {convo.guided.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => convo.send(q)}
                className="rounded-full border border-stone-700 bg-stone-950/60 px-4 py-1.5 text-xs text-stone-300 backdrop-blur-sm transition hover:border-amber-200/40 hover:text-amber-100"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* input row */}
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Ask them anything…"
            aria-label="Ask the character a question"
            maxLength={300}
            className="flex-1 rounded-sm border border-stone-800 bg-stone-950/70 px-4 py-2.5 text-sm text-stone-100 placeholder-stone-600 outline-none backdrop-blur-sm focus:border-amber-200/40"
          />
          <button
            onClick={submit}
            disabled={convo.status !== 'idle'}
            className="rounded-sm border border-stone-700 px-5 text-xs tracking-widest text-stone-300 transition hover:bg-stone-800 disabled:opacity-40"
          >
            ASK
          </button>
          <motion.button
            onClick={onContinue}
            disabled={!convo.canContinue}
            animate={convo.canContinue ? { opacity: 1 } : { opacity: 0.35 }}
            title={
              convo.canContinue
                ? 'Continue the chapter'
                : 'Keep talking — there is more to hear first'
            }
            className="rounded-sm border border-amber-200/50 bg-amber-200/10 px-5 text-xs tracking-widest text-amber-100"
          >
            CONTINUE →
          </motion.button>
        </div>

        <p className="mt-2 text-center text-[10px] text-stone-600">
          Character responses are AI-generated and may contain errors.
        </p>
      </div>
    </div>
  );
}

function Typewriter({ text, className }: { text: string; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(iv);
          return v;
        }
        return v + 2;
      });
    }, 24);
    return () => clearInterval(iv);
  }, [text]);
  return <p className={className}>{text.slice(0, n)}</p>;
}
