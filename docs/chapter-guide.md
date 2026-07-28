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
  conversation. Each objective has an `id`, a short `label`, and **two ways to tick off**:
  - `keywords` — the row lands the instant the PLAYER's own message contains one of these.
    Lowercase, no apostrophes, and broad: every everyday way a kid might put the idea.
  - `pointIds` (optional) — the learning points that row is made of. The row also lands
    once the CHARACTER has covered all of them, which is what catches a player who asked
    in words no keyword list predicted (coverage is judged on substance, so different
    wording still counts). Keep the union of all rows' `pointIds` equal to the full set of
    learning points. Chapters 1–3 use keywords only; chapter 4 uses both.

  Omit `objectives` entirely and the panel simply doesn't show.

**The minigame may only test what the character teaches.** Every card or drop in a
chapter's minigame names the learning point that teaches it (`teachesPointId` — see
`src/chapters/ch1/timelineStore.ts` and `src/chapters/ch4/uranusStore.ts`). If you add
one, add or widen the point that teaches it; if you drop a point, drop what tested it.
That is what stops a player finishing every objective and then meeting something nobody
explained.

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

Finding those pauses needs an audio decoder on your machine: macOS has one built in
(`afconvert`), and on Windows or Linux the script uses **ffmpeg** (`winget install
ffmpeg`, or `brew install ffmpeg`). If neither is there it says so and stops, rather than
writing timings it could not measure.

**The chapter summary's take is timed the same way** — see the `TAKES` table in
`src/audio/summaryNarration.ts`, which holds one `{ start, end }` per topic, measured off
the recording with the same silence-finder (`scripts/lib/narration-segments.mjs`). Re-record
a summary and you re-measure that row.

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
Chapter 4 (Turning the Tide — **Nikolai Volkov**, a nineteen-year-old front-line medic in
Stalingrad in early February 1943, a few days after the last German troops gave up)
follows the same shape: one open conversation node with all twenty learning points live
from the first turn, and **five** objectives, in this order:

1. **The Broken Pact** · 2. **Why Stalingrad** · 3. **Battle in the Ruins** ·
4. **The Trap** · 5. **The Turning Point**

Those five names are the objectives panel, the five "Learn" lines of the mission brief, and
the five topics of the closing summary — one order, three places. Change one and change all
three (and re-time the two recordings).

**Its minigame is "Operation Uranus"** (`src/chapters/ch4/`), played on the war-room table
with the founder's own red-stained map and six pieces. Five drags, three phases, one
correct arrangement, no score and no timer:

1. *Mark what Germany came for* — the oil derrick onto the Caucasus, the barge onto the
   Volga.
2. *Where do you strike?* — the front line draws itself, the city and the German 6th Army
   land in the centre with one thin ally piece on each flank, and **three** slots glow for
   **two** hammers. That mismatch is the puzzle. A hammer dropped on the centre is refused
   and explained; the flanks lock in.
3. *Close it* — a third hammer behind the city, and the rest is scripted: the flank arms
   sweep round and meet, a blue wave crosses the map, the red stain drains away behind it,
   the ring seals, everything holds still, and the summary comes up.

Two things make it teach rather than just play, and neither is decoration:
**every piece on the table is labelled** (the flank labels most of all — without
*Romanian Army* and *Hungarian Army* the player only learns "hit the smaller piece"), and
**every wrong drop gets Nikolai's reason, never a bare no**. Both live in
`src/chapters/ch4/uranusStore.ts` with the rest of the board.

Nothing in the minigame asks anything Nikolai has not already taught: each slot names the
learning point that teaches it.

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

Chapter 6 (Hiroshima) carries the same treatment, one step stricter — see its section below.

**One thing is deliberately a placeholder**, and the chapter plays start to finish with
it missing:
- `public/video/ch4-intro.mp4` — **the intro film does not exist yet.** The beat still runs
  in the right order and holds on the styled "coming soon" frame, whose CONTINUE goes on to
  the mission brief. Dropping the file in needs nothing but the file. Ruins, snow, a river,
  a lamp; no casualties on screen.

Already in place (was a placeholder, now real):
- `public/models/ch4-medic.glb` — Nikolai's model, baked from the founder's two Music-folder
  exports by `scripts/build-ch4-character.mjs` (Idle_Loop + Talking_Loop merged, spec/gloss
  maps stripped to flat roughness, webp textures).
- `public/img/ch4-ruins.jpg` — the conversation backdrop (ruined snowy street), wired in
  `src/chapters/registry.ts`.
- Nikolai's voice: stock "Charlie" in `src/server/tts.ts`, verified against this account.
  Setting `ELEVENLABS_VOICE_CH4` in `.env.local` (and Vercel) overrides it without a code
  change. Wrong or missing = silent subtitles, in the conversation and for his corrections
  on the war table alike.

Already done and not to be re-done by hand: the mission brief lines
(`src/content/briefs.json`) and its recorded take, timed into
`public/audio/brief/manifest.json`; the closing summary's five topics
(`src/chapters/ch4/uranusStore.ts`) and its take, timed into
`src/audio/summaryNarration.ts`; the map images (`public/img/ch4-map-*.jpg` — the two are
pixel-aligned on purpose, which is what makes phase 3's wipe work) and all six table pieces.

## Chapter 5 — same pattern, told from a hospital tent
Chapter 5 (The Road Back — **Sister Grace Ellery**, a twenty-six-year-old British nursing
sister with a field surgical unit outside Bayeux, in late July 1944, seven weeks after
D-Day) follows the ch4 shape: one open conversation node with all seventeen learning
points live from the first turn, and **four** objectives, in this order:

1. **The Second Front** · 2. **The Great Build-Up** · 3. **The Deception** · 4. **D-Day**

Those four names are the objectives panel, the four "Learn" lines of the mission brief, and
the four topics of the closing summary — one order, three places. Change one and change all
three (and re-record and re-time the two recordings).

**Two things make Grace work, and both are constraints, not colour:**

- **She was not there on 6 June.** She landed on the 10th, onto a beach already working as
  a port. Every account she gives of the landing morning is attributed — what the men she
  nursed told her — and she says so out loud at least once. What she saw with her own eyes
  starts on D+4.
- **She knows the deception happened, not how it was done.** She lived it: sealed camp,
  real maps with false place names, assuming Calais like everyone, learning "Normandy"
  days before sailing and telling no one. She has never heard of inflatable tanks, dummy
  landing craft, a fake army, or double agents — still secret in July 1944. Asked how, she
  says she doesn't know how they did it, only that it was done — **and that it fooled her
  own side too.** That line is the best moment in the chapter; the machinery itself is
  taught by the brief and the minigame (Elderon is not time-locked; Grace is).

**The tone rules are part of the content**, exactly as in ch4 — they live at the top of
`src/content/trees/ch5.ts` (`TONE_RULES`): honest never graphic, never dramatic about
death, never romanticise, individuals not statistics, German prisoners treated and spoken
of plainly. **Two facts are left out on purpose and must not be added back anywhere in the
chapter**: aggregate D-Day casualty totals, and any account of what happened to wounded
men who could not be evacuated. Asked for numbers, she says the number was very large,
she has no figure, and counting them was not her job.

Her time-lock is late July 1944: no Paris, no May 1945, no atomic bomb, the Pacific only
"being fought". The Holocaust: rumours she cannot confirm, no speculation.

Already real: both narrations — the mission brief (`src/content/briefs.json` +
`public/audio/brief/narration/ch5.mp3`, timed into the manifest) and the closing summary
(`src/chapters/ch5/summary.ts` + `public/audio/summary/ch5.mp3`, timed into
`src/audio/summaryNarration.ts`). Grace's voice is stock "Lily" in `src/server/tts.ts`
(`ELEVENLABS_VOICE_CH5` overrides; audition it — she must not sound like Tom).
The map marker sits on the Normandy coast, recalibrated against ch1/ch3/ch4.

### The minigame — "Show it or hide it"
Between the conversation and the summary. The board is the supplied Channel map on the
war-room table: southern England along the top, northern France along the bottom. Eight
props wait in a row underneath, shuffled, and the player drags each one into one of two
outlined English regions — **Kent, "Make them look here"** or **South-West England, "Hide
the real one"**. One question decides all eight, and it stays on screen the whole time:
*do you want the Germans to see this?* Four were built to be seen (inflatable tank, dummy
landing craft, fake headquarters sign, radio truck); four hid the real thing (camouflage
netting, sealed camp, censored post, blackout). **Nothing on screen ever says it is four
and four** — the counter only ever reads "3 of 8 placed".

A thin arrow runs from each English region across the Channel to the French place it
decides — Kent to Pas de Calais, the south-west to Normandy — and both are drawn from the
first frame. That pairing is the whole lesson: what you do on your own coast decides where
the enemy looks on theirs. A correct piece locks in and earns one line explaining why. A
piece put in the other region shakes gently and slides home — no penalty, no score, no red,
and the counter does not move; after a second miss on the same piece Grace offers the
reasoning, never the answer. The two French places are labels, not targets: a piece let go
on France simply goes back, with nothing said.

Correct pieces answer on the map: each deception piece slides the grey German command pin
further toward Calais, and each concealment piece dims the Normandy marker. When the eighth
lands, a scripted ten-second payoff runs on its own — the pin locks at Calais, the grey
German markers gather there, the Normandy coast visibly empties, a pause, and then Allied
markers come ashore into the gap and the beachhead spreads inland. It is markers moving on
a map: no fighting, no casualties, no numbers anywhere. Then one card — Germany kept its
strongest reserves at Calais for seven weeks — and the existing summary screen.

Everything the player reads lives in `src/chapters/ch5/ShowOrHideMinigame.tsx`; every rule,
label, feedback line and hint lives in `showOrHideStore.ts` (that is the file to edit); the
board is `ShowOrHideScene.tsx`. The ten supplied assets are wired in
`src/assets/registry.tsx` (`ch5.piece.*`, `ch5.pin.german-command`) plus
`public/img/ch5-map.png`, and are prepared by `npm run build:ch5-pieces`. **The map image
is never scaled or cropped** — every zone, marker and path is a point read off its own
pixels, so the paper on the table keeps the image's exact aspect ratio. The camera is
pinned by `minigameCamera` on the ch5 registry row and never answers the mouse.

Still placeholders, and the chapter plays start to finish with all of them missing:
- `public/video/ch5-intro.mp4` — the intro beat holds on the styled "coming soon" frame;
  dropping the file in needs nothing but the file.
- Grace's model — the shared bust placeholder holds the stage; the drop-in block is ready
  in `src/assets/registry.tsx` (`ch5.character`).
- The conversation backdrop — the registry line stays commented out until the image file
  exists (an empty reference hangs the 3D scene).

## Chapter 6 — the character, and the strictest tone contract in the app
Chapter 6 (The Cost of Victory — **Dr Kenzo Arita**, a forty-four-year-old physician at a
small hospital in the north of Hiroshima, speaking in **late September 1945**) follows the
ch4/ch5 shape: one open conversation node with all twenty-two learning points live from the
first turn, and **five** objectives, in this order:

1. **A Country at War** · 2. **The Morning of the Sixth** ·
3. **A City That Could Not Help Itself** · 4. **The Sickness With No Name** ·
5. **The Cost of Victory**

As in chapters 4 and 5, those five names are meant to be one order in three places — the
objectives panel, the mission brief's "Learn" lines, and the closing summary's topics.
Only the first exists so far; write the other two to match.

He is a fictional composite grounded in the documented experience of the Hiroshima doctors
who survived and kept working — above all Dr Michihiko Hachiya, whose diary runs 6 August
to 30 September 1945, and Dr Terufumi Sasaki, who first charted the sickness nobody had a
name for. He is neither of them and belongs to no real hospital.

**Three things make Arita work, and all three are constraints, not colour:**

- **Late September 1945, not August.** A doctor locked to the days right after the bomb
  knows almost nothing — not what hit the city, not that the war is about to end, not that
  a second sickness is coming. Six weeks out he has all three as lived experience: the
  words "atomic bomb" (Japanese papers said "a new type of bomb" on 8 August; the Asahi
  first printed "atomic bomb" on 11 August), the Emperor's broadcast on the 15th, and the
  whole shape of the delayed sickness, which only revealed itself over weeks.
- **He knows the sickness happened, not why.** He watched people who walked away without a
  mark fall ill weeks later, and neither he nor anyone else could explain it. That is not a
  dodge — in September 1945 nobody could, American experts included. He never uses the word
  "radiation" as though he understood it, and he never guesses at a cause. **The not-knowing
  is the chapter's best teaching idea**: a whole city was hurt by something none of its
  doctors could name.
- **He will not say whether the bomb should have been dropped.** Asked, he says he was
  underneath it and so cannot be a fair judge, that the player should hear the people who
  made the decision too, and that they will have to decide it themselves. That refusal is
  the best moment in the chapter and it must survive any edit.

**What Arita cannot carry, and who carries it instead.** This is the ch5 pattern (Grace
lived the deception but never learned its machinery). The Pacific war *as a campaign* — the
island fighting, the kamikaze, Okinawa, the invasion that was planned and never happened,
the Potsdam ultimatum, and the long argument over whether the bomb should have been used —
is deliberately **not** in the tree, because a civilian doctor in Hiroshima had no way to
know any of it. **That material is the mission brief's and the minigame's job**, narrated by
Elderon, who is not time-locked. Arita supplies what only he can: what it was to be
underneath it.

**The tone rules are part of the content**, as in ch4 and ch5 — they live at the top of
`src/content/trees/ch6.ts` (`TONE_RULES`), and they are one step stricter than either.
The particular trap here: Arita is a *doctor*, so clinical detail would come naturally to
him, and a curious child will fish for exactly the images Hiroshima is remembered by. Being
a doctor is the reason for the restraint, not a licence for it — **he does not describe
patients, he describes work.** **Three things are left out on purpose and must not be added
back anywhere in the chapter**: any figure for the dead or injured; any physical description
of injuries, bodies or the dead; and any verdict on whether the bomb should have been dropped.

**The balance rule.** Chapter 3 is Pearl Harbor, so players will arrive here and ask
"didn't Japan start it?". Arita must never become a chapter in which Japan is only a victim.
His honest 1945 position: his country had been at war since 1937 and he knows it; he was
told a great deal that turned out to be untrue and he knows that now too; and what the army
did far away he did not see and will neither describe nor deny. He never claims his country
was innocent, and he never suggests the visitor was wrong to ask.

His voice is stock "Brian" in `src/server/tts.ts` (`ELEVENLABS_VOICE_CH6` overrides) —
deliberately the only older male voice in the app, since ch2, ch3 and ch4 are all young men.
Audition it before you ship.

Still to build for this chapter (everything plays with these missing):
- The mission brief (`src/content/briefs.json`) and its Elderon recording — **this is where
  the Pacific campaign and the decision belong.**
- The minigame (`src/chapters/ch6/` is still the placeholder shell) and the closing summary.
- `public/video/ch6-intro.mp4`, the character model, and the conversation backdrop.

## Rules of the road
- Don't edit files outside your chapter's tree file, chapter folder, and the asset registry.
- All fixed content (dates, claims, minigame facts) must be historically accurate —
  when unsure, mark it TODO rather than guessing.
- Chapter 4 and 6 need the most careful language around death and suffering. Understate.
