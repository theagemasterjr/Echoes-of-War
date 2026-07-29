'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChapterId } from '@/chapters/types';
import { chapterMeta } from '@/chapters/registry';
import { useConversation } from './engine';
import { ObjectivesPanel } from '@/ui/ObjectivesPanel';
import { voicePlayer } from '@/audio/voicePlayer';
import { useSettingsStore } from '@/state/settingsStore';

/** First name only — warmer, and short enough to sit beside the dots. The
 *  ch5–ch6 skeletons still carry "Placeholder: …" names, so those fall back to
 *  a plain label rather than printing the word Placeholder at a player. */
function thinkingLabel(characterName: string): string {
  const first = characterName.split(/[\s:]+/)[0];
  if (!first || /placeholder/i.test(characterName)) return 'Thinking…';
  return `${first} is thinking…`;
}

/**
 * Shown while a reply is on its way. Loud on purpose: this used to be a small
 * grey ellipsis, which read as nothing happening at all — and a player who
 * believes the game has frozen starts clicking things. Naming the character and
 * keeping the dots moving makes the wait obviously *her*, not a stall.
 */
function ThinkingIndicator({ characterName }: { characterName: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-16 flex-col items-center justify-center gap-3"
    >
      <span className="flex items-end gap-2" aria-hidden>
        {[0, 1, 2].map((k) => (
          <motion.span
            key={k}
            className="h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(252,211,77,0.6)]"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: k * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </span>
      <span className="text-[15px] tracking-wide text-amber-100">
        {thinkingLabel(characterName)}
      </span>
    </div>
  );
}

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
  // The subtitles setting only ever hides caption text while voice is doing
  // the talking; with voice off, text is the only thing carrying the line, so
  // it always shows regardless of the setting.
  const subtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const showSubtitleText = subtitlesEnabled || !voiceEnabled;
  // Voice is the default way to talk — every conversation opens in voice mode
  // wherever the browser supports it (checked on mount, so the server render
  // stays deterministic). "Type instead" switches to the text box any time.
  const [voiceMode, setVoiceMode] = useState(false);
  useEffect(() => {
    if (getSpeechCtor()) setVoiceMode(true);
  }, []);
  const [lineDone, setLineDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);
  const msgCount = convo.messages.length;
  // Every row ticked? Then CONTINUE just goes. Otherwise it asks first — this
  // is the one thing standing between a student and skipping their objectives
  // by accident. A chapter with no objectives (the ch4–ch6 skeletons) is
  // vacuously done, so it never nags.
  const objectivesLeft = convo.objectives.filter(
    (o) => !convo.objectivesDone.includes(o.id),
  ).length;
  const leave = () => {
    setConfirming(false);
    onContinue();
  };
  const tryContinue = () => {
    if (objectivesLeft === 0) leave();
    else setConfirming(true);
  };

  // a new line starts un-finished; guided chips wait until it has fully played
  useEffect(() => setLineDone(false), [msgCount]);

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

      {/* left-side objectives — a row checks off the moment the PLAYER's own
          words mention it, and (where the chapter maps a row to its learning
          points) once the character has taught all of them.
          Hidden when there are no objectives (no-key case, ch5–ch6 skeletons). */}
      {convo.objectives.length > 0 && (
        <ObjectivesPanel objectives={convo.objectives} doneIds={convo.objectivesDone} />
      )}

      {confirming && (
        <UnfinishedObjectivesDialog
          left={objectivesLeft}
          onStay={() => setConfirming(false)}
          onLeave={leave}
        />
      )}

      {voiceMode ? (
        <VoiceMode
          onExit={() => setVoiceMode(false)}
          onContinue={tryContinue}
          characterName={meta.characterName}
        />
      ) : (
      <div className="mx-auto mb-4 w-full max-w-3xl px-4">
        {/* subtitle line */}
        <div className="min-h-24 rounded-md bg-stone-950/70 px-6 py-4 text-center backdrop-blur-sm">
          {convo.status === 'error' ? (
            <div>
              <p className="italic text-stone-400">
                …they pause, distracted for a moment. “Sorry — say that again?”
              </p>
              <button
                onClick={() => convo.retry()}
                className="mt-2 rounded-sm border border-amber-200/40 px-4 py-1 text-xs tracking-widest text-amber-100"
              >
                REPEAT
              </button>
            </div>
          ) : convo.status === 'sending' ? (
            <ThinkingIndicator characterName={meta.characterName} />
          ) : (
            <SubtitleLine
              key={convo.messages.length}
              text={lastCharacterLine}
              className="text-[15px] leading-relaxed text-stone-100"
              onDone={() => setLineDone(true)}
              hidden={!showSubtitleText}
            />
          )}
        </div>

        {/* guided questions */}
        {convo.status === 'idle' && lineDone && convo.guided.length > 0 && (
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
          {/* Always available: the guard is the pop-up, not a locked button —
              a player who wants to move on can, and a player who forgot an
              objective is asked once. */}
          <motion.button
            onClick={tryContinue}
            animate={{ opacity: objectivesLeft === 0 ? 1 : 0.75 }}
            title={
              objectivesLeft === 0
                ? 'Continue the chapter'
                : 'You still have objectives left — we’ll check first'
            }
            className="rounded-sm border border-amber-200/50 bg-amber-200/10 px-5 text-xs tracking-widest text-amber-100 transition hover:bg-amber-200/20"
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

/**
 * "Are you sure?" — the one thing between a student and accidentally walking
 * out on their objectives. Deliberately weighted toward staying: staying is
 * the bright, obvious button; leaving is the quiet one. Nothing is scolded,
 * nothing is blocked.
 *
 * Sized and spaced for the easy-read font: no cramped lines, no tiny type, no
 * tight letter-spacing on anything that has to be read as words.
 */
function UnfinishedObjectivesDialog({
  left, onStay, onLeave,
}: {
  left: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="objectives-guard-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-md rounded-md border border-amber-200/30 bg-stone-950/95 p-7 text-center shadow-2xl"
      >
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60">
          Hold on a moment
        </div>
        <h2
          id="objectives-guard-title"
          className="mt-3 text-xl font-light leading-snug text-stone-100"
        >
          You still have {left} {left === 1 ? 'objective' : 'objectives'} to finish.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          A few more questions and {left === 1 ? 'it’s' : 'they’re'} yours. Are you sure you
          want to go on?
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            ref={stayRef}
            onClick={onStay}
            className="rounded-sm border border-amber-200/60 bg-amber-200/15 px-6 py-3 text-sm tracking-wide text-amber-100 transition hover:bg-amber-200/25"
          >
            Stay and keep learning
          </button>
          <button
            onClick={onLeave}
            className="rounded-sm border border-stone-700 px-6 py-2.5 text-sm text-stone-400 transition hover:border-stone-500 hover:text-stone-200"
          >
            Continue anyway
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Minimal Web Speech typings (not in lib.dom for all targets). */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  /** Discards everything heard and ends; stop() would deliver (and send) it. */
  abort?: () => void;
  /** Fires when the mic is actually capturing — after the permission prompt. */
  onaudiostart: (() => void) | null;
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
      title="Talk with your voice instead of typing"
      aria-label="Open voice mode"
      className="flex shrink-0 items-center gap-2 rounded-sm border border-amber-200/50 bg-amber-200/10 px-4 text-amber-100 transition hover:bg-amber-200/20"
    >
      <span className="text-lg leading-none">🎙</span>
      <span className="text-xs tracking-widest">VOICE</span>
    </button>
  );
}

/**
 * Voice mode: talk with the character out loud.
 *
 * THE MICROPHONE ONLY EVER TURNS ON WHEN THE PLAYER PRESSES THE BUTTON. It
 * does not switch itself on when the character finishes speaking, and it does
 * not switch itself on at any other moment — after a reply it sits off and
 * waits. (It used to start listening the instant the voice ended, which meant
 * a classroom full of children were being recorded without having asked.)
 * The button says which state it is in, in words and in colour, always.
 *
 * You press, you speak; when you stop, the question is sent (the character
 * never talks over you) and the mic goes off. The answer plays in voice while
 * the words appear on screen. The 3D character stays visible — this overlay
 * only owns the bottom of the screen.
 */
function VoiceMode({
  onExit, onContinue, characterName,
}: {
  onExit: () => void;
  onContinue: () => void;
  characterName: string;
}) {
  const convo = useConversation();
  const subtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const showSubtitleText = subtitlesEnabled || !voiceEnabled;
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
      // Continuous, with our own silence window. The browser's built-in
      // endpointer (continuous=false) sends after barely a second of quiet,
      // which cut players off mid-thought — a kid pausing to find a word is
      // not finished. Now the mic stays open until SILENCE_MS passes with
      // nothing new heard (or the player taps to send, unchanged).
      const SILENCE_MS = 2800; // the pause a thinking player is allowed
      const FIRST_SPEECH_MS = 8000; // give up if nothing is ever heard at all
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      finalRef.current = '';
      let silence: ReturnType<typeof setTimeout> | null = null;
      const armSilence = (ms: number) => {
        if (silence) clearTimeout(silence);
        silence = setTimeout(() => {
          try {
            rec.stop(); // onend below sends whatever was heard
          } catch {}
        }, ms);
      };
      // The give-up clock must not start until the mic is actually capturing:
      // rec.start() first has to get through the permission prompt and the
      // recognizer warm-up, when nothing can possibly be heard — a kid taking
      // ten seconds to read the prompt and press Allow must not open onto a
      // dead mic. And when it fires, it aborts rather than stops: nothing was
      // understood, so nothing should be flushed mid-word and sent.
      let giveUp: ReturnType<typeof setTimeout> | null = null;
      rec.onaudiostart = () => {
        giveUp = setTimeout(() => {
          try {
            (rec.abort ?? rec.stop).call(rec);
          } catch {}
        }, FIRST_SPEECH_MS);
      };
      rec.onresult = (e) => {
        if (giveUp) {
          clearTimeout(giveUp);
          giveUp = null; // something was heard — the quiet clock takes over
        }
        // e.results is cumulative for the whole session: with continuous=true
        // a finished segment stays in the list and is delivered again with
        // every later event. Rebuild the transcript from scratch each time —
        // appending would repeat every finished segment once per new event.
        let final = '';
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const t = r[0]?.transcript ?? '';
          if (r.isFinal) final += (final ? ' ' : '') + t.trim();
          else interim += t;
        }
        finalRef.current = final;
        setHeard(final || interim);
        armSilence(SILENCE_MS); // every new word restarts the quiet clock
      };
      rec.onerror = () => {
        if (silence) clearTimeout(silence);
        if (giveUp) clearTimeout(giveUp);
        setMode('ready');
      };
      rec.onend = () => {
        // we stopped it (silence window) or the player tapped — send now
        if (silence) clearTimeout(silence);
        if (giveUp) clearTimeout(giveUp);
        if (modeRef.current !== 'listening') return;
        const text = finalRef.current.trim();
        setHeard('');
        if (text) {
          useConversation.getState().send(text);
          setMode('thinking');
        } else setMode('ready');
      };
      recRef.current = rec;
      rec.start(); // the FIRST_SPEECH_MS clock arms in onaudiostart, not here
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

  // when the spoken line ends, the mic stays OFF and waits for a press —
  // never opened by anything but the player's own hand
  useEffect(() => {
    const un = voicePlayer.subscribe((e) => {
      if (e === 'start') clearSafety();
      if (e === 'end' && modeRef.current === 'speaking') {
        clearSafety();
        setMode('ready');
      }
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

  /** The one thing that matters here: is this microphone hearing you? */
  const micOn = mode === 'listening';

  /**
   * A reply is still on its way. `mode` alone misses the opening line — that
   * request is in flight before the player has done anything, so voice mode
   * used to sit on "tap the microphone to speak" while the character was in
   * fact thinking, and a tap there started recording a question the engine
   * would then drop (it refuses a send while one is in flight, which left the
   * mic stuck on "thinking" with nothing ever coming back).
   */
  const waiting = !micOn && (mode === 'thinking' || convo.status === 'sending');

  const tap = () => {
    if (convo.status === 'error') {
      convo.retry();
      setMode('thinking');
      return;
    }
    if (waiting) return; // let her finish answering before taking a question
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
      : micOn
        ? 'Listening… tap when you finish'
        : waiting
          ? 'Wait for the answer'
          : mode === 'speaking'
            ? 'Tap the microphone to talk'
            : 'Tap the microphone to speak';

  return (
    <div className="pointer-events-auto flex flex-col items-center pb-8">
      {/* the words, as they are spoken. The line stays on screen after the
          voice ends — the mic is off and waiting, so there is nothing to
          hurry the reader along. */}
      <div className="mb-6 min-h-16 w-full max-w-2xl px-6 text-center">
        {micOn ? (
          heard && <p className="text-[15px] leading-relaxed text-sky-200/90">{heard}</p>
        ) : waiting ? (
          <ThinkingIndicator characterName={characterName} />
        ) : (
          lastCharacterLine &&
          showSubtitleText && (
            <SubtitleLine
              key={msgCount}
              text={lastCharacterLine}
              className="rounded-md bg-stone-950/60 px-4 py-3 text-[15px] leading-relaxed text-stone-100 backdrop-blur-sm"
            />
          )
        )}
      </div>

      {/* The microphone. Off unless the player put it on: a live ring and the
          word ON while it hears you, dark and struck through while it does
          not. Never ambiguous, never on by itself. */}
      <button
        onClick={tap}
        disabled={waiting}
        aria-label={
          micOn
            ? 'Microphone on — tap to stop and send'
            : waiting
              ? 'Waiting for the answer'
              : 'Tap to turn the microphone on'
        }
        aria-pressed={micOn}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl transition ${
          micOn
            ? 'border-amber-300 bg-amber-200/25 text-amber-100 shadow-[0_0_28px_rgba(252,211,77,0.45)]'
            : 'border-stone-600 bg-stone-950/80 text-stone-500 hover:border-amber-200/50 hover:text-stone-300'
        } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-600 disabled:hover:text-stone-500`}
      >
        {micOn && (
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-amber-300/60" />
        )}
        <span className="relative">🎙</span>
        {!micOn && (
          /* struck through — the mic is not hearing anything */
          <span
            aria-hidden
            className="absolute h-[2px] w-11 rotate-45 rounded-full bg-stone-500"
          />
        )}
      </button>
      <p
        className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] ${
          micOn ? 'text-amber-200' : 'text-stone-500'
        }`}
      >
        {micOn ? '● Mic on' : 'Mic off'}
      </p>
      <p className="mt-1 text-xs text-stone-400">{hint}</p>

      {/* the way out for anyone who would rather type sits right beside
          CONTINUE — one row at the bottom, where every control lives, so
          nobody has to hunt the corners of the screen for it */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onExit}
          title="Switch to typing your questions"
          className="flex items-center gap-2 rounded-sm border border-amber-200/40 bg-stone-950/80 px-4 py-1.5 text-xs tracking-wide text-amber-100 backdrop-blur-sm transition hover:bg-amber-200/10"
        >
          <span className="text-base leading-none">⌨</span>
          <span>Type instead</span>
        </button>
        <button
          onClick={onContinue}
          className="rounded-sm border border-amber-200/50 bg-amber-200/10 px-5 py-1.5 text-xs tracking-widest text-amber-100 transition hover:bg-amber-200/20"
        >
          CONTINUE →
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-stone-600">
        Character responses are AI-generated and may contain errors.
      </p>
    </div>
  );
}

/** Split a reply into sentences for subtitle-style delivery. */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+[”"’']?\s*|[^.!?…]+$/g);
  const out = (parts ?? [text]).map((s) => s.trim()).filter(Boolean);
  return out.length > 0 ? out : [text];
}

/** Film-subtitle delivery: only the current sentence is on screen. While the
 *  voice is playing, the sentence on screen is the one being spoken: we read
 *  the audio clock every tick and map it onto the line (each sentence gets a
 *  share of the clip proportional to its length), so the words stay locked to
 *  the voice instead of drifting off pre-computed timers. With no voice, each
 *  sentence waits for a tap, so slow readers are never rushed. Calls onDone
 *  when the last sentence is shown. `hidden` keeps the pacing effects (and
 *  the onDone call they end in) running while rendering nothing — used when
 *  the subtitles setting is off but voice is on, so guided questions still
 *  unlock in step with the (unseen) line. */
function SubtitleLine({
  text, className, onDone, hidden,
}: {
  text: string;
  className?: string;
  onDone?: () => void;
  hidden?: boolean;
}) {
  const sentences = useMemo(() => splitSentences(text), [text]);
  const [i, setI] = useState(0);
  const [tapMode, setTapMode] = useState(false);
  // The line is HELD — nothing rendered — until its audio actually starts, so
  // words, voice and the talking animation land together. Held is released
  // three ways: the voice starts (follow it), the voice gives up (fetch
  // failed / voice off — reader sets the pace), or the hard cap passes.
  const [held, setHeld] = useState(true);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setI(0);
    setTapMode(false);
    setHeld(true);
    if (!text) return;

    // Where in the clip each sentence ends, as a fraction. Characters stand in
    // for speaking time — close enough that a sentence never lands early or
    // hangs around after the voice has moved on.
    const total = sentences.reduce((a, s) => a + s.length, 0) || 1;
    const endsAt: number[] = [];
    let acc = 0;
    for (const s of sentences) {
      acc += s.length;
      endsAt.push(acc / total);
    }

    let follow: ReturnType<typeof setInterval> | null = null;
    let waitForVoice: ReturnType<typeof setInterval> | null = null;
    const stopFollow = () => {
      if (follow) clearInterval(follow);
      follow = null;
    };
    const stopWaiting = () => {
      if (waitForVoice) clearInterval(waitForVoice);
      waitForVoice = null;
    };

    const startFollowing = () => {
      stopWaiting();
      setTapMode(false);
      setHeld(false); // the voice is playing — show the words with it
      if (follow) return;
      follow = setInterval(() => {
        const dur = voicePlayer.durationSec;
        if (!voicePlayer.speaking || dur <= 1) return;
        const at = voicePlayer.currentTime / dur;
        let k = 0;
        while (k < endsAt.length - 1 && at >= endsAt[k]) k++;
        setI((v) => (k > v ? k : v)); // subtitles only ever move forward
      }, 100);
    };

    const un = voicePlayer.subscribe((e) => {
      // voice arrived (possibly late): hand the pacing over to it
      if (e === 'start') startFollowing();
      // voice finished: land on the last sentence whatever the clock said
      if (e === 'end') {
        stopFollow();
        setI(sentences.length - 1);
      }
    });

    if (voicePlayer.speaking) {
      startFollowing();
    } else {
      // Hold the words for the voice. While the line's audio is still on its
      // way (voicePlayer.pending) keep holding — up to a hard cap — so the
      // text never runs ahead of the sound; the moment the voice gives up
      // (fetch failed, voice off) the reader takes over immediately.
      const t0 = performance.now();
      waitForVoice = setInterval(() => {
        if (voicePlayer.speaking) return; // 'start' already handed over
        const waited = performance.now() - t0;
        if (waited > (voicePlayer.pending ? 8000 : 300)) {
          stopWaiting();
          setHeld(false);
          setTapMode(true);
        }
      }, 120);
    }
    return () => {
      stopFollow();
      stopWaiting();
      un();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const last = i >= sentences.length - 1;
  useEffect(() => {
    // a held line hasn't been shown yet — a one-sentence reply must not
    // count as delivered while it is still waiting for its audio
    if (last && !held) doneRef.current?.();
  }, [last, held]);

  // still waiting for the voice to begin: nothing on screen yet
  if (held) return null;

  // `hidden` assumes the voice is carrying the line. If the voice never
  // arrived (tapMode — no key, rate limit, network), the text is the only
  // channel left, so it shows regardless of the subtitles setting.
  if (hidden && !tapMode) return null;

  return (
    <div
      onClick={() => {
        if (tapMode && !last) setI((v) => Math.min(v + 1, sentences.length - 1));
      }}
      className={tapMode && !last ? 'cursor-pointer select-none' : undefined}
    >
      <motion.p
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={className}
      >
        {sentences[i] ?? ''}
      </motion.p>
      {tapMode && !last && (
        <p className="mt-1 animate-pulse text-[10px] tracking-widest text-stone-500">
          TAP FOR MORE ▸
        </p>
      )}
    </div>
  );
}
