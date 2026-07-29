'use client';
/**
 * True while the character is delivering a line — drives the talking
 * animation on the 3D stage. The voiced audio (voicePlayer) is the source of
 * truth: while a line's audio is pending the animation holds, and opens on
 * the 'start' event so mouth and sound begin together. When no voice comes
 * (no key / TTS error / voice off) it mimes for roughly the on-screen
 * text-reveal window instead, on the same hold-then-give-up gate the
 * SubtitleLine uses (~80 chars/sec reveal pacing).
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

  // A character line just landed. If its audio is on its way
  // (voicePlayer.pending), hold still and let the 'start' event open the
  // mouth exactly when the sound begins — the same gate the subtitle uses,
  // so words, voice and animation land together. Only when the voice gives
  // up (fetch failed, voice off) does the mime carry the reveal window.
  const msgCount = messages.length;
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'character') return;
    const t = timers.current;
    clearTimeout(t.probe);
    clearTimeout(t.end);
    const t0 = performance.now();
    const probe = () => {
      t.probe = undefined;
      if (voicePlayer.speaking) return; // voice took over — events drive it
      const waited = performance.now() - t0;
      if (voicePlayer.pending && waited < 8000) {
        t.probe = setTimeout(probe, 150); // still coming — keep holding
        return;
      }
      setSpeaking(true); // no voice for this line: mime the reveal window
      t.end = setTimeout(() => {
        t.end = undefined;
        setSpeaking(false);
      }, 600 + (last.text.length / 80) * 1000);
    };
    t.probe = setTimeout(probe, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgCount]);

  return speaking;
}
