'use client';
/**
 * True while the character is delivering a line — drives the talking
 * animation on the 3D stage. The voiced audio (voicePlayer) is the source of
 * truth; when no voice is configured (no key / TTS error) it falls back to
 * miming for roughly the on-screen text-reveal window, matching the
 * Typewriter's 1.2s wait + ~80 chars/sec pacing.
 */
import { useEffect, useRef, useState } from 'react';
import { voicePlayer } from '@/audio/voicePlayer';
import { useConversation } from './engine';

export function useCharacterSpeaking(): boolean {
  const [speaking, setSpeaking] = useState(false);
  const messages = useConversation((s) => s.messages);
  const timers = useRef<{ probe?: ReturnType<typeof setTimeout>; end?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const t = timers.current;
    const clear = () => {
      clearTimeout(t.probe);
      clearTimeout(t.end);
      t.probe = t.end = undefined;
    };
    const un = voicePlayer.subscribe((e) => {
      clear(); // real voice overrides any mimed fallback
      setSpeaking(e === 'start');
    });
    // voicePlayer.stop() is deliberately silent (no 'end' event) — re-sync so
    // a cut-off line doesn't leave the character talking forever
    const iv = setInterval(() => {
      setSpeaking((s) => (s && !voicePlayer.speaking && !t.end ? false : s));
    }, 500);
    return () => {
      un();
      clearInterval(iv);
      clear();
    };
  }, []);

  // a character line just landed: if the voice hasn't started shortly, mime
  // for the reveal window instead
  const msgCount = messages.length;
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'character') return;
    const t = timers.current;
    clearTimeout(t.probe);
    clearTimeout(t.end);
    t.probe = setTimeout(() => {
      t.probe = undefined;
      if (voicePlayer.speaking) return; // voice took over — events drive it
      setSpeaking(true);
      t.end = setTimeout(() => {
        t.end = undefined;
        setSpeaking(false);
      }, 600 + (last.text.length / 80) * 1000);
    }, 1300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgCount]);

  return speaking;
}
