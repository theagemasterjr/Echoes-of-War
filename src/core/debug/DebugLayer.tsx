'use client';
/**
 * Hidden tooling — opened by typing "debug". Judges never see this.
 * Jump menu reaches every chapter and beat instantly (for demo recording),
 * and the character test screen exercises any constraint tree in a bare chat.
 */
import { useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useProgressStore } from '@/state/progressStore';
import { CHAPTERS } from '@/chapters/registry';
import type { Beat, ChapterId } from '@/chapters/types';
import { useConversation } from '@/conversation/engine';

const BEATS: Beat[] = ['overview', 'conversation', 'minigame'];

export function DebugLayer() {
  const open = useAppStore((s) => s.debugOpen);
  const testChapter = useAppStore((s) => s.characterTestChapter);
  if (testChapter) return <CharacterTest chapterId={testChapter} />;
  if (!open) return null;
  return <DebugMenu />;
}

function DebugMenu() {
  const { gotoChapter, returnToMap, setDebugOpen, setCharacterTestChapter } =
    useAppStore.getState();
  const reset = useProgressStore((s) => s.reset);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[540px] rounded-md border border-stone-700 bg-stone-950 p-5 text-stone-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-widest text-amber-200/80">Debug</h2>
          <button onClick={() => setDebugOpen(false)} className="text-xs text-stone-500 hover:text-stone-200">
            close (or type “debug”)
          </button>
        </div>
        <table className="mt-4 w-full text-xs">
          <tbody>
            {CHAPTERS.map((c) => (
              <tr key={c.id} className="border-t border-stone-800">
                <td className="py-2 pr-2 text-stone-400">
                  {c.index}. {c.title}
                </td>
                {BEATS.map((b) => (
                  <td key={b} className="py-2 pr-1">
                    <button
                      onClick={() => {
                        setDebugOpen(false);
                        gotoChapter(c.id, b, true);
                      }}
                      className="rounded border border-stone-700 px-2 py-1 hover:bg-stone-800"
                    >
                      {b}
                    </button>
                  </td>
                ))}
                <td className="py-2">
                  <button
                    onClick={() => setCharacterTestChapter(c.id)}
                    className="rounded border border-amber-200/40 px-2 py-1 text-amber-100 hover:bg-amber-200/10"
                  >
                    test character
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex gap-2 border-t border-stone-800 pt-4 text-xs">
          <button
            onClick={() => {
              setDebugOpen(false);
              returnToMap(true);
            }}
            className="rounded border border-stone-700 px-3 py-1.5 hover:bg-stone-800"
          >
            map
          </button>
          <button
            onClick={() => reset()}
            className="rounded border border-red-900 px-3 py-1.5 text-red-300 hover:bg-red-950"
          >
            reset save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bare chat against any tree, with live engine internals on display. */
function CharacterTest({ chapterId }: { chapterId: ChapterId }) {
  const convo = useConversation();
  const [draft, setDraft] = useState('');
  const setCharacterTestChapter = useAppStore((s) => s.setCharacterTestChapter);
  const started = convo.chapterId === chapterId && convo.messages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex bg-stone-950 text-stone-200">
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-widest text-amber-200/80">
            Character test — {chapterId}
          </h2>
          <div className="flex gap-2 text-xs">
            {!started && (
              <button
                onClick={() => useConversation.getState().start(chapterId)}
                className="rounded border border-amber-200/40 px-3 py-1 text-amber-100"
              >
                start conversation
              </button>
            )}
            <button
              onClick={() => {
                useConversation.getState().reset();
                setCharacterTestChapter(null);
              }}
              className="rounded border border-stone-700 px-3 py-1 hover:bg-stone-800"
            >
              close
            </button>
          </div>
        </div>
        <div className="mt-3 flex-1 space-y-3 overflow-y-auto rounded border border-stone-800 p-3 text-sm">
          {convo.messages.map((m, i) => (
            <div key={i} className={m.role === 'player' ? 'text-sky-200' : 'text-stone-200'}>
              <span className="mr-2 text-[10px] uppercase text-stone-500">{m.role}</span>
              {m.text}
            </div>
          ))}
          {convo.status === 'sending' && <div className="animate-pulse text-stone-500">…</div>}
          {convo.status === 'error' && (
            <div className="text-red-300">
              request failed —{' '}
              <button onClick={() => convo.retry()} className="underline">
                retry
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                convo.send(draft.trim());
                setDraft('');
              }
            }}
            placeholder="probe the character…"
            className="flex-1 rounded border border-stone-800 bg-stone-900 px-3 py-2 text-sm outline-none focus:border-amber-200/40"
          />
        </div>
      </div>
      <aside className="w-72 border-l border-stone-800 p-4 text-xs">
        <h3 className="uppercase tracking-widest text-stone-500">Engine state</h3>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="text-stone-500">active node</dt>
            <dd className="text-amber-100">{convo.nodeId || '—'}</dd>
          </div>
          <div>
            <dt className="text-stone-500">covered learning points</dt>
            <dd className="break-words">{convo.covered.join(', ') || 'none yet'}</dd>
          </div>
          <div>
            <dt className="text-stone-500">progress</dt>
            <dd>
              {convo.progress.covered} / {convo.progress.total}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">turns in node</dt>
            <dd>{convo.turnsInNode}</dd>
          </div>
          <div>
            <dt className="text-stone-500">can continue</dt>
            <dd>{String(convo.canContinue)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">guided questions</dt>
            <dd className="space-y-1">
              {convo.guided.map((g) => (
                <div key={g} className="text-stone-400">
                  · {g}
                </div>
              ))}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-stone-600">
          Edit this character in <code>src/content/trees/{chapterId}.ts</code>, then close and
          reopen the test to reload.
        </p>
      </aside>
    </div>
  );
}
