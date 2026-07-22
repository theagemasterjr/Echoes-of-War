'use client';
import { useEffect } from 'react';

/** Fires when the word is typed anywhere outside a text field. */
export function useSecretCode(word: string, onTrigger: () => void) {
  useEffect(() => {
    let buffer = '';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-word.length);
      if (buffer === word) {
        buffer = '';
        onTrigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);
}
