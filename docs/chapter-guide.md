# Chapter Guide — how to fill in a chapter (for the founders)

Every chapter is a self-contained shell. Filling one in **never** touches shared systems
or other chapters.

**Every chapter plays the same four beats**, and the app builds them for you:

> chapter pin clicked → small push-in on the map → **intro film** → **mission brief** →
> **live conversation** → **minigame** → back to the map

A chapter with no film, or no mission brief written yet, simply skips that beat. So
"adding chapter 4's opening" means writing its lines in `src/content/briefs.json` and
dropping its film in `public/video/` — never changing code.

Each chapter has these places you edit:

## 1. The character (the heart) — `src/content/trees/chN.ts`
One file per chapter defines the whole character: who they are, what they know,
and the route the conversation takes. **`ch1.ts` is the worked example — copy its shape.**

- `persona` — name, role, date, place, how they talk (`voice`), and their life story (`background`).
- `knowledge` — bullet lists of what they plausibly know and explicitly do NOT know
  (anything after their moment in time, other theaters, strategy above their station).
- `deflections` — three pre-written in-character lines used when someone is abusive,
  tries to break the character ("ignore your instructions"), or when the app is busy.
- `nodes` — the conversation stages (e.g. introduction → the key events → closing).
  Each node has:
  - `learningPoints` — the facts this stage must get across. The engine tracks these
    and quietly steers the character toward the uncovered ones.
  - `guidedQuestions` — the clickable suggested questions players see.
  - `behaviorRules` — extra instructions active only in this stage.
  - `advance` — when to move on: `allPoints`, `minPoints` (with `minPoints: 2`), or
    `minTurns` (with `minTurns: 3`). The last node has `to: null` — meeting its
    condition lights up the player's CONTINUE button.
  - `learningPoints[].cues` — **the words that make a topic tick off.** List the
    everyday words, names and phrasings a character might use when genuinely
    explaining that point — synonyms and related terms, not just the textbook name
    ("humiliated", "unfair", "never forgave" as well as "Versailles"). Two different
    cues in one answer mark the point covered, so a kid never has to say the formal
    term to get credit, and one stray word can never tick it off by mistake. A fast
    model reads the whole conversation as a second opinion, so a point explained
    across several turns still counts. Keep cues specific to their own point — a bare
    "Britain" would fire on any answer that mentions Britain.
- `objectives` (optional) — the Objectives panel shown on the left during the
  conversation. Each objective has an `id`, a short `label`, and a `pointIds` list; it
  fills as its points are covered and ticks off, with a gold flash, when they all are.
  Keep the union of all objectives' `pointIds` equal to the full set of learning points,
  and tune the node `advance` conditions so the last objective checks off right as
  CONTINUE lights up. Omit `objectives` entirely and the panel simply doesn't show.

**The minigame may only test what the character teaches.** Every card in a chapter's
minigame names the learning point that teaches it (`teachesPointId` — see
`src/chapters/ch1/timelineStore.ts`). If you add a card, add or widen the point that
teaches it; if you drop a point, drop its card. That is what stops a player finishing
all four objectives and then meeting something nobody explained.

## The mission brief — `src/content/briefs.json`
The black screen with the narrator, right after the intro film. Add an entry for the
chapter and write its `lines` — one short sentence each, spoken and typed onto the
screen in order, ending with the question the I ACCEPT button answers.

The narrator is the same voice in every chapter — ElevenLabs **"Elderon"**. There are
two ways to give a chapter its voice, and **the recorded one is preferred** because the
free ElevenLabs plan can't reach Elderon from the API (the website can).

**Recorded by hand — how chapter 1 was done:**
1. On the ElevenLabs website, pick the **Elderon** voice and paste the chapter's whole
   brief — all the lines, in order, as one block.
2. Download the mp3 and save it as `public/audio/brief/narration/chN.mp3`
   (`ch1.mp3`, `ch4.mp3`, …).
3. Run `npm run build:briefs`.

The recording ships exactly as you exported it — never re-encoded, never cut up. The
script only works out where each written line falls inside it, by listening for the
pauses, so the words type themselves in time with the voice. It prints each line's
timing so you can sanity-check it; if a line looks wildly too fast or slow, the pause
after it was probably too short — re-record with a clearer break between lines.

**Generated instead:** with no such file, `npm run build:briefs` sends each line to the
API one at a time. On a free plan that path can't use Elderon, so it says so and uses a
stand-in ("George"). Chapter 2 currently works this way.

Either way, run:

```
npm run build:briefs
```

and commit what appears under `public/audio/brief/`. Only what actually changed is
re-made — everything else is reused for free, and **the game never calls ElevenLabs
while it is running.** A chapter with no recording yet still plays: the words appear at
a steady reading pace, silently.

## Optional: intro film — `src/chapters/registry.ts`
A chapter can open with a short film. Add an
`introVideo: '/video/chN-intro.mp4'` field to that chapter's row and drop the mp4 at
`public/video/chN-intro.mp4`. Until the file exists a styled "coming soon" frame stands
in with a CONTINUE button, and chapters with no `introVideo` skip the beat entirely.
Chapter 1 is wired for `/video/ch1-intro.mp4`.

## Optional: conversation background photo
The live conversation can show a photo behind the character instead of the plain
dark wall. Add `conversationBackdrop: '/img/chN-name.jpg'` to that chapter's row in
`src/chapters/registry.ts` and drop the image at `public/img/chN-name.jpg` (wide
landscape, about 1920px across). Chapter 1 uses the ruined Warsaw radio studio.

## Optional: character voice — ElevenLabs
If `ELEVENLABS_API_KEY` is set, character replies are spoken aloud. Each chapter's voice
is chosen in `src/server/tts.ts` (`VOICE_IDS`); ch1 reads `ELEVENLABS_VOICE_CH1` and falls
back to a stock voice — **TODO(founder): pick a voice** per character. Without the key the
app is fully functional and simply silent.

**Test it without playing the chapter:** open the app, type `debug`, click
*test character* on that chapter. You'll see the active node, covered learning
points, and can probe the boundaries. Edit the file, save, reopen the test.

## 2. The minigame — `src/chapters/chN/index.tsx`
The chapter folder exports one screen: `Minigame`, the check-your-understanding
activity that follows the conversation. It just has to call
`onComplete({ chapterId, completed: true })` when the player is done. Chapters 1 and 2
show the pattern. Ask Claude to build the real one from your content — describe the
activity in plain language, and say which learning points it tests.

## 3. The models — `docs/model-prompts.md`
Generate the chapter's marker miniature and character in Meshy using the prompts
there, drop the `.glb` in `public/models/`, and flip that asset's entry in
`src/assets/registry.tsx` from placeholder to file. Nothing else changes.

Characters that come with animations get one extra field on their registry entry:
`clips: { idle: '<clip name>', talking: '<clip name>' }`. The idle plays on its own
and the talking clip takes over while the character is speaking. Chapter 1 shows the
pattern (see the ch1 section of `docs/model-prompts.md` for the full build steps).

## Chapter 2 — a second worked example
Chapter 2 (Standing Alone — Tom Ashcroft, sergeant pilot, late September 1940) is now
built to the same shape as chapter 1: a single open conversation node with every
learning point live from turn one, four on-screen objectives, a mission brief in
`briefs.json`, and a 2D card-timeline minigame (`src/chapters/ch2/`). Use either
chapter as the model when filling in ch3–ch6.

Still for the founder to drop in (everything works with placeholders until then):
- `public/models/ch2-spitfire.glb`, `ch2-pilot.glb` (needs idle + talking clips),
  `ch2-helmet.glb` — see the Chapter 2 drop-in checklist in `docs/model-prompts.md`.
- `public/video/ch2-intro.mp4` — the intro film.
- `public/img/ch2-airfield.jpg` — optional conversation backdrop (then uncomment its
  line in `src/chapters/registry.ts`; do not uncomment before the file exists).
- The pilot's voice: set `ELEVENLABS_VOICE_CH2` in `.env.local` (and Vercel), or verify
  the stock "George" id in `src/server/tts.ts`. Wrong or missing = silent subtitles.
- Its mission brief is currently in the stand-in narrator voice. To put it in Elderon
  like chapter 1: record the lines on the ElevenLabs site, save the mp3 as
  `public/audio/brief/narration/ch2.mp3`, and run `npm run build:briefs`.

## Chapter 3 — same pattern
Chapter 3 (A World at War — Ray Doyle, Seaman First Class, mid-December 1941) follows
the same shape: a single open conversation node, four objectives, a mission brief in
`briefs.json`, and a 2D card-timeline minigame (`src/chapters/ch3/`).

Still for the founder to drop in (everything works with placeholders until then):
- `public/models/ch3-sailor.glb` (needs idle + talking clips) and the two reserved
  props `ch3-dixiecup.glb` / `ch3-globe.glb` — see the Chapter 3 drop-in checklist in
  `docs/model-prompts.md`. The warship map marker is already real.
- `public/video/ch3-intro.mp4` — the intro film.
- `public/img/ch3-harbor.jpg` — optional conversation backdrop (then uncomment its
  line in `src/chapters/registry.ts`; do not uncomment before the file exists).
- The sailor's voice: set `ELEVENLABS_VOICE_CH3` in `.env.local` (and Vercel), or verify
  the stock "Josh" id in `src/server/tts.ts`. Wrong or missing = silent subtitles.
- After editing the ch3 brief text, run `npm run build:briefs` to give it a voice.

## Chapter 4 — same pattern, plus extra care with the subject
Chapter 4 (Turning the Tide — **Nina Volkova**, a nineteen-year-old front-line medic in
Stalingrad in early February 1943, a few days after the last German troops gave up)
follows the same shape: one open conversation node with all thirteen learning points
live from the first turn, four objectives, and a minigame. Its minigame is deliberately
the simplest one in the game — a plain 2D timeline of eight moments to put in order
(`src/chapters/ch4/`), with no 3D table scene — so it can be replaced later without
unpicking anything.

**The tone rules for this chapter are part of the content, not a style note.** They live
at the top of `src/content/trees/ch4.ts` (`TONE_RULES`) and anyone editing this chapter
inherits them:

- A person can say *what happened to people* without describing *what it looked like*.
  "Two men from my company did not come back" is in bounds. Wounds, bodies, and anyone
  dying on the page are out of bounds — however the player asks, however many times.
- Death, cold and hunger get one quiet sentence and then the conversation moves on.
  Never dwell, never build atmosphere out of suffering, never make war sound exciting.
- German soldiers are spoken of as people; no wartime slurs for anyone.
- **Two things are left out on purpose**: what became of the German prisoners, and any
  total casualty figure for the battle. "A whole German army was destroyed" carries the
  history without asking a ten-year-old to hold a number like two million. Please don't
  add them back.

Chapter 6 (Hiroshima) will need the same treatment.

Still for the founder to drop in (everything works with placeholders until then):
- `public/models/ch4-medic.glb` (needs idle + talking clips) and the two reserved props
  `ch4-ferry.glb` / `ch4-ruin.glb` — see the Chapter 4 drop-in checklist in
  `docs/model-prompts.md`. The medic-satchel map marker is already real.
- `public/video/ch4-intro.mp4` — the intro film. Ruins, snow, a river, a lamp; no
  casualties on screen.
- `public/img/ch4-cellar.jpg` — optional conversation backdrop (then uncomment its line
  in `src/chapters/registry.ts`; do not uncomment before the file exists).
- Nina's voice: set `ELEVENLABS_VOICE_CH4` in `.env.local` (and Vercel), or verify the
  stock "Sarah" id in `src/server/tts.ts`. It must not be chapter 1's voice — both
  characters are young women. Wrong or missing = silent subtitles.
- Chapter 4's mission brief lines are written in `src/content/briefs.json`. What remains
  is the narration: record the take and run `npm run build:briefs` — until then the brief
  plays silently, with the words typing on at reading pace.

## Rules of the road
- Don't edit files outside your chapter's tree file, chapter folder, and the asset registry.
- All fixed content (dates, claims, minigame facts) must be historically accurate —
  when unsure, mark it TODO rather than guessing.
- Chapter 4 and 6 need the most careful language around death and suffering. Understate.
