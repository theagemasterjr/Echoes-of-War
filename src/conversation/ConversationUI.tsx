'use client';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChapterId } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';
import { useConversation } from './engine';
import { voicePlayer } from '@/audio/voicePlayer';

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
  const [voiceMode, setVoiceMode] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current || convo.chapterId !== chapterId) {
      started.current = true;
      useConversation.getState().start(chapterId);
    }
    return () => voicePlayer.stop(); // silence any in-flight line when we leave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const lastCharacterLine =
    [...convo.messages].reverse().find((m) => m.role === 'character')?.text ?? '';

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

      {/* left-side learning objectives — checks off as coverage lands. Hidden
          when there are no objectives (no-key case, ch2–ch6 skeletons). */}
      {convo.objectives.length > 0 && (
        <div className="absolute left-4 top-16 hidden w-56 rounded-md border border-stone-800 bg-stone-950/70 p-4 backdrop-blur-sm md:block">
          <div className="text-[10px] uppercase tracking-widest text-amber-200/70">
            Things to learn about:
          </div>
          <ul className="mt-3 space-y-2">
            {convo.objectives.map((o) => {
              const done = o.pointIds.every((id) => convo.covered.includes(id));
              return (
                <li key={o.id} className="flex items-start gap-2 text-xs leading-snug">
                  <span
                    className={`mt-px shrink-0 text-sm transition-colors duration-500 ${
                      done ? 'text-amber-300' : 'text-stone-600'
                    }`}
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <motion.span
                    animate={{ color: done ? '#fde68a' : '#78716c' }}
                    transition={{ duration: 0.5 }}
                  >
                    {o.label}
                  </motion.span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {voiceMode ? (
        <VoiceMode onExit={() => setVoiceMode(false)} onContinue={onContinue} />
      ) : (
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
          <VoiceModeButton onOpen={() => setVoiceMode(true)} />
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
      )}
    </div>
  );
}

/* Minimal Web Speech typings (not in lib.dom for all targets). */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Opens voice mode. Hidden where speech recognition isn't available (e.g. Firefox). */
function VoiceModeButton({ onOpen }: { onOpen: () => void }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (getSpeechCtor()) setSupported(true);
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Voice mode"
      aria-label="Open voice mode"
      className="shrink-0 rounded-sm border border-stone-700 px-3 text-sm text-stone-400 transition hover:bg-stone-800"
    >
      🎙
    </button>
  );
}

/** Voice mode: talk with the character out loud. You speak; when you finish,
 *  the question is sent (the character never talks over you). The answer plays
 *  in voice while the words appear on screen, then it listens again. The 3D
 *  character stays visible — this overlay only owns the bottom of the screen. */
function VoiceMode({ onExit, onContinue }: { onExit: () => void; onContinue: () => void }) {
  const convo = useConversation();
  const [mode, setMode] = useState<'ready' | 'listening' | 'thinking' | 'speaking'>(
    voicePlayer.speaking ? 'speaking' : 'ready',
  );
  const [heard, setHeard] = useState('');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCharacterLine =
    [...convo.messages].reverse().find((m) => m.role === 'character')?.text ?? '';
  const msgCount = convo.messages.length;
  const prevCount = useRef(msgCount);

  const clearSafety = () => {
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
  };

  const startListening = () => {
    if (modeRef.current === 'listening') return;
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    clearSafety();
    voicePlayer.stop(); // your turn — cut the character's audio
    try {
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      finalRef.current = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const t = r[0]?.transcript ?? '';
          if (r.isFinal) finalRef.current += (finalRef.current ? ' ' : '') + t.trim();
          else interim += t;
        }
        setHeard(finalRef.current || interim);
      };
      rec.onerror = () => setMode('ready');
      rec.onend = () => {
        // the recognizer stops when you finish talking — only then do we send
        if (modeRef.current !== 'listening') return;
        const text = finalRef.current.trim();
        setHeard('');
        if (text) {
          useConversation.getState().send(text);
          setMode('thinking');
        } else setMode('ready');
      };
      recRef.current = rec;
      rec.start();
      setMode('listening');
      setHeard('');
    } catch {
      setMode('ready');
    }
  };

  // when the reply lands, show it and let the voice carry it
  useEffect(() => {
    if (msgCount > prevCount.current) {
      prevCount.current = msgCount;
      const last = convo.messages[msgCount - 1];
      if (last?.role === 'character' && modeRef.current === 'thinking') {
        setMode('speaking');
        // if the voice never starts (no key / error), settle after reading time
        clearSafety();
        safety.current = setTimeout(
          () => {
            if (modeRef.current === 'speaking') setMode('ready');
          },
          Math.min(25000, 1500 + last.text.length * 60),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgCount]);

  // when the spoken line ends, listen again — a natural back-and-forth
  useEffect(() => {
    const un = voicePlayer.subscribe((e) => {
      if (e === 'start') clearSafety();
      if (e === 'end' && modeRef.current === 'speaking') startListening();
    });
    return () => {
      un();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // leaving voice mode: stop listening quietly
  useEffect(
    () => () => {
      clearSafety();
      try {
        recRef.current?.stop();
      } catch {}
    },
    [],
  );

  const tap = () => {
    if (convo.status === 'error') {
      convo.retry();
      setMode('thinking');
      return;
    }
    if (mode === 'listening') {
      try {
        recRef.current?.stop(); // onend sends what was heard
      } catch {}
    } else if (mode === 'ready' || mode === 'speaking') {
      startListening();
    }
  };

  const hint =
    convo.status === 'error'
      ? 'Something broke — tap to try again'
      : mode === 'listening'
        ? 'Listening… tap when you finish'
        : mode === 'thinking'
          ? '…'
          : mode === 'speaking'
            ? 'Tap to talk'
            : 'Tap to speak';

  return (
    <div className="pointer-events-auto flex flex-col items-center pb-8">
      <button
        onClick={onExit}
        className="absolute right-4 top-16 rounded-sm border border-stone-700 bg-stone-950/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-stone-300 backdrop-blur-sm hover:bg-stone-800"
      >
        ✕ Exit voice
      </button>

      {/* the words, as they are spoken */}
      <div className="mb-6 min-h-16 w-full max-w-2xl px-6 text-center">
        {mode === 'listening' && heard && (
          <p className="text-[15px] leading-relaxed text-sky-200/90">{heard}</p>
        )}
        {mode === 'thinking' && <p className="animate-pulse text-stone-500">…</p>}
        {mode === 'speaking' && (
          <Typewriter
            key={msgCount}
            text={lastCharacterLine}
            className="rounded-md bg-stone-950/60 px-4 py-3 text-[15px] leading-relaxed text-stone-100 backdrop-blur-sm"
          />
        )}
      </div>

      <button
        onClick={tap}
        aria-label={hint}
        className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl transition ${
          mode === 'listening'
            ? 'animate-pulse border-amber-300 bg-amber-200/20 text-amber-100'
            : mode === 'speaking'
              ? 'border-amber-200/60 bg-amber-200/10 text-amber-100'
              : 'border-stone-600 bg-stone-950/70 text-stone-300 hover:border-amber-200/50'
        }`}
      >
        🎙
      </button>
      <p className="mt-3 text-xs text-stone-400">{hint}</p>

      {convo.canContinue && (
        <button
          onClick={onContinue}
          className="mt-4 rounded-sm border border-amber-200/50 bg-amber-200/10 px-5 py-1.5 text-xs tracking-widest text-amber-100"
        >
          CONTINUE →
        </button>
      )}
      <p className="mt-2 text-center text-[10px] text-stone-600">
        Character responses are AI-generated and may contain errors.
      </p>
    </div>
  );
}

/** Reveals the text at the speed of the spoken line, so words and voice end
 *  together. Waits briefly for the voice to start; if there is no voice
 *  (no key, error), it falls back to a quick reveal on its own. */
function Typewriter({ text, className }: { text: string; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let iv: ReturnType<typeof setInterval> | null = null;
    let started = false;
    const begin = (cps: number) => {
      if (started) return;
      started = true;
      let acc = 0;
      iv = setInterval(() => {
        acc += cps * 0.05;
        setN(Math.min(text.length, Math.floor(acc)));
        if (acc >= text.length && iv) clearInterval(iv);
      }, 50);
    };
    const paceToVoice = () => {
      const d = voicePlayer.durationSec;
      if (d > 1) begin(Math.max(6, text.length / d));
    };
    const un = voicePlayer.subscribe((e) => {
      if (e === 'start') paceToVoice();
    });
    const fallback = setTimeout(() => begin(80), 1200);
    if (voicePlayer.speaking) paceToVoice();
    return () => {
      if (iv) clearInterval(iv);
      un();
      clearTimeout(fallback);
    };
  }, [text]);
  return <p className={className}>{text.slice(0, n)}</p>;
}
