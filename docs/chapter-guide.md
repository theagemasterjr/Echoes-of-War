# Chapter Guide — how to fill in a chapter (for the founders)

Every chapter is a self-contained shell. Filling one in **never** touches shared systems
or other chapters. Each chapter has exactly three places you edit:

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
- `objectives` (optional) — the learner-facing checklist shown on the left during the
  conversation ("what to listen for"). Each objective has an `id`, a short `label`, and
  a `pointIds` list; it checks off when all its points are covered. Keep the union of all
  objectives' `pointIds` equal to the full set of learning points, and tune the node
  `advance` conditions so the last objective checks off right as CONTINUE lights up.
  Omit `objectives` entirely and the panel simply doesn't show (as in ch2–ch6).

## Optional: intro film — `src/chapters/registry.ts`
A chapter can play a short film between its overview and the conversation. Add an
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

## 2. The overview and minigame — `src/chapters/chN/index.tsx`
The chapter folder exports two screens: `Overview` (the 30–60s scene-setter) and
`Minigame` (the check-your-understanding activity). They're currently labeled
placeholders. Chapter 1 shows the pattern — the minigame just has to call
`onComplete({ chapterId, completed: true })` when done; the overview calls
`onAdvance()` to move to the conversation. Ask Claude to build the real ones
from your content — describe the activity in plain language.

## 3. The models — `docs/model-prompts.md`
Generate the chapter's marker miniature and character in Meshy using the prompts
there, drop the `.glb` in `public/models/`, and flip that asset's entry in
`src/assets/registry.tsx` from placeholder to file. Nothing else changes.

Characters that come with animations get one extra field on their registry entry:
`clips: { idle: '<clip name>', talking: '<clip name>' }`. The idle plays on its own
and the talking clip takes over while the character is speaking. Chapter 1 shows the
pattern (see the ch1 section of `docs/model-prompts.md` for the full build steps).

## Rules of the road
- Don't edit files outside your chapter's tree file, chapter folder, and the asset registry.
- All fixed content (dates, claims, minigame facts) must be historically accurate —
  when unsure, mark it TODO rather than guessing.
- Chapter 4 and 6 need the most careful language around death and suffering. Understate.
