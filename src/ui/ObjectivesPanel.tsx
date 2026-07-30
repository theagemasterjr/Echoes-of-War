'use client';
/**
 * The Objectives panel. A row is either open or ticked — nothing in between.
 * It lands with a gold flash the instant the player says the words (or, a beat
 * later, when the character finishes teaching that row), so the player catches
 * it happening out of the corner of an eye. Once ticked, a row stays ticked.
 *
 * Shared, because the panel outlives the conversation: chapter 4's war-table
 * minigame keeps it on screen and ticks the last three rows as the board is laid
 * out. It takes a plain list of rows, so a minigame can show them without the
 * conversation engine being involved.
 *
 * Every row is also a disclosure button: tapping (or Enter/Space-ing) it
 * expands a short kid-friendly note about what to ask and why it matters. The
 * detail copy is keyed by the row's on-screen label rather than its id,
 * because ids are only unique within one chapter's content file (e.g. ch3 and
 * ch4 both use the id "obj-why" for a different row) while labels are not.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Kid-friendly detail copy for every objective row across the game, keyed by
 * the row's label (see src/content/trees/chN.ts for chapters 1–5, and
 * src/chapters/ch4/uranusStore.ts for the war-table minigame's own rows,
 * which reuse ch4's labels). One to three short sentences: what to ask about,
 * and why it mattered.
 */
const OBJECTIVE_DETAILS: Record<string, string> = {
  // Chapter 1 — Zofia
  'The Treaty of Versailles':
    'Ask Zofia about the peace deal that ended the First World War. It punished Germany so harshly that the anger it caused helped set the stage for a second war.',
  'Germany under the treaty':
    "Ask about life in Germany after the treaty, especially during the Great Depression. Hard times and hunger made people desperate enough to listen to extreme leaders.",
  'Hitler’s rise to power':
    'Ask how Hitler became Germany’s leader. He turned a struggling democracy into a one-man dictatorship in less than a year.',
  'The road to war':
    "Ask about the land Hitler took before the war even started. Other countries let him get away with it again and again, hoping it would keep the peace — it didn't.",
  'Germany invades Poland':
    'Ask what is happening right now, in Zofia’s own city. This is the moment the war actually began, and why Britain and France finally stepped in.',

  // Chapter 2 — Tom
  'Escape at Dunkirk':
    'Ask Tom how the British army got trapped — and rescued — on a French beach. Hundreds of small boats saved an army so it could fight another day.',
  'France’s Surrender':
    'Ask what happened when France gave up the fight. It left Britain standing alone against Germany, with an invasion looming.',
  'Eagle Day':
    'Ask about the huge air attack that opened the battle. Germany had to beat the Royal Air Force before it could even try to invade.',
  'The Blitz':
    "Ask why the bombing suddenly shifted from airfields to cities like London. It was terrible for people on the ground, but it gave Britain's exhausted pilots a chance to recover.",
  'How Britain Won':
    "Ask why Germany couldn't finish the job. Better defences, faster aircraft production, and pilots from all over the world tipped the fight in Britain's favour.",

  // Chapter 3 — Ray
  'Why did Japan attack America?':
    "Ask Ray why Japan struck without warning. Japan needed oil and resources it couldn't get once America cut off trade, so it tried to knock the US fleet out of the way.",
  'What was Japan’s target at Pearl Harbor?':
    'Ask what Japan was really aiming for. The battleships were hit hard, but the aircraft carriers — the ships that mattered most — were out at sea and escaped untouched.',
  'Why did America join the war — and how did that change it?':
    'Ask what happened after the attack. America declared war within a day, and the fighting became a true world war almost overnight.',

  // Chapter 4 — Nikolai (conversation rows and the matching war-table rows)
  'The Broken Pact':
    'Ask Nikolai about the promise Germany broke. Germany and the Soviet Union had agreed not to fight each other — until Germany invaded anyway.',
  'Why did Germany choose Stalingrad':
    "Ask why this one city mattered so much. It sat on a key supply river and stood between Germany and the oil it desperately needed — and it carried Stalin's own name.",
  'Battle in the Ruins':
    'Ask what the fighting was actually like. The city was smashed to rubble and fought over street by street, house by house.',
  'Operation Uranus':
    'Ask how the Soviets turned the battle around. Instead of attacking the strong German army in the city, they struck the weaker allied armies guarding its flanks.',
  'The Turning Point':
    'Ask how the battle ended. Trapped and cut off from supplies, an entire German army was forced to surrender — and Germany never advanced east again.',

  // Chapter 5 — Corporal Ted Marsh
  'The Second Front':
    'Ask Corporal Marsh why the Allies needed to invade France at all. Opening a new front in the west took pressure off the Soviet Union, which had been fighting Germany alone in the east for years.',
  'The Great Build-Up':
    'Ask how the invasion was prepared. Troops, ships and even artificial harbours had to be gathered in Britain, and the whole plan hinged on picking exactly the right day and weather.',
  'The Deception':
    'Ask how the Allies tricked Germany. A deliberate deception convinced Germany the attack would come at Calais, keeping German divisions waiting in the wrong place.',
  'D-Day':
    'Ask what happened on the day itself. Paratroopers, warships and thousands of soldiers landed on five beaches, opening the fight that would finally push Germany out of Western Europe.',
};

/** Any row without a listed label (a future chapter, say) still gets a sensible note. */
const DEFAULT_DETAIL = 'Talk to find out what this is about and why it mattered.';

export function ObjectivesPanel({
  objectives,
  doneIds,
  mobileTop = 'top-16',
}: {
  objectives: { id: string; label: string }[];
  doneIds: string[];
  /** Where the phone-size counter pill sits (Tailwind top-* class) — each
   *  screen passes a spot clear of its own header text. */
  mobileTop?: string;
}) {
  const doneSet = useMemo(() => new Set(doneIds), [doneIds]);
  // which row just completed — drives the one-off celebration
  const [justDone, setJustDone] = useState<string | null>(null);
  const seen = useRef<string[]>([]);
  useEffect(() => {
    const fresh = doneIds.find((id) => !seen.current.includes(id));
    seen.current = doneIds;
    if (!fresh) return;
    setJustDone(fresh);
    const t = setTimeout(() => setJustDone(null), 1600);
    return () => clearTimeout(t);
  }, [doneIds]);

  // which rows are expanded to show their detail note — several may be open at once
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // phones: the panel would sit on top of the character, so it starts closed
  // behind a small counter pill and opens (over the stage, scrollable) on tap
  const [mobileOpen, setMobileOpen] = useState(false);

  // Rendered twice (desktop panel + phone overlay) — both copies stay in the
  // DOM with only `display` differing, so each needs its own id namespace or
  // every row's detail id (and its aria-controls target) would be duplicated.
  const list = (idPrefix: string) => (
    <ul className="mt-3 space-y-2.5">
        {objectives.map((o) => {
          const done = doneSet.has(o.id);
          const celebrating = justDone === o.id;
          const open = expanded.has(o.id);
          const detailId = `${idPrefix}-objective-detail-${o.id}`;
          const detail = OBJECTIVE_DETAILS[o.label] ?? DEFAULT_DETAIL;
          return (
            <motion.li
              key={o.id}
              animate={celebrating ? { scale: [1, 1.045, 1] } : { scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-xs leading-snug"
            >
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-expanded={open}
                aria-controls={detailId}
                className="flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-amber-300/70"
              >
                <span aria-hidden="true" className="relative mt-px shrink-0 text-sm">
                  <motion.span
                    animate={{ color: done ? '#fcd34d' : '#57534e' }}
                    transition={{ duration: 0.4 }}
                  >
                    {done ? '✓' : '○'}
                  </motion.span>
                  {celebrating && (
                    /* a single ring pushing outward from the new tick */
                    <motion.span
                      initial={{ opacity: 0.85, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2.6 }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full border border-amber-300"
                    />
                  )}
                </span>
                <motion.span
                  animate={{ color: done ? '#fde68a' : '#a8a29e' }}
                  transition={{ duration: 0.5 }}
                  style={celebrating ? { textShadow: '0 0 14px rgba(252,211,77,0.65)' } : undefined}
                  className="flex-1"
                >
                  {o.label}
                </motion.span>
                <span
                  aria-hidden="true"
                  className="mt-px shrink-0 text-stone-500 transition-transform duration-300"
                  style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  ›
                </span>
              </button>
              <div
                className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
              >
                <div className="min-h-0 overflow-hidden">
                  <p
                    id={detailId}
                    aria-hidden={!open}
                    className="pl-5 pr-1 pt-1.5 text-[11px] leading-snug text-stone-400"
                  >
                    {detail}
                  </p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
  );

  return (
    <>
      {/* laptops and up: the panel as it has always been, open on the left */}
      <div className="pointer-events-auto absolute left-4 top-16 hidden w-56 rounded-md border border-stone-800 bg-stone-950/70 p-4 backdrop-blur-sm md:block">
        <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Objectives</div>
        {list('desk')}
      </div>

      {/* phones and small tablets: a counter pill that opens the same panel */}
      <div className={`absolute left-4 ${mobileTop} flex flex-col items-start md:hidden`}>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          className="pointer-events-auto rounded-sm border border-stone-700 bg-stone-950/70 px-3 py-2 text-[10px] uppercase tracking-widest text-amber-200/80 backdrop-blur-sm transition hover:bg-stone-800"
        >
          Objectives {objectives.filter((o) => doneSet.has(o.id)).length}/{objectives.length}{' '}
          {mobileOpen ? '▴' : '▾'}
        </button>
        {mobileOpen && (
          <div className="pointer-events-auto mt-2 max-h-[50vh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-stone-800 bg-stone-950/90 p-4 backdrop-blur-sm">
            {list('mobile')}
          </div>
        )}
      </div>
    </>
  );
}
