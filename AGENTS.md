<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Echoes of War — project brief for AI instances

Interactive, cinematic WW2 educational web app for the **Prometheus July AI Challenge**
(deadline **July 30, 2026**; deliverables: working prototype, GitHub source, 2-minute
demo video). Judged equally on educational impact, creative use of AI, technical
execution, and the demo. **Stability beats ambition. The live AI character
conversations are the heart of the product — there is NO mock/scripted mode.**

The founders are **non-technical**: talk UX and flow, never implementation detail.
Ask before big changes or scope cuts; small technical decisions are yours.

## Experience (decided — do not re-ask)

- 3D tabletop **war-room map** (dark wood, paper map, warm lamp) with **six chapter
  markers as miniature props**, all unlocked from the start, suggested order 1→6.
- Chapter flow, always: short overview → **live AI conversation** → required fixed
  minigame → completion mark on the map (localStorage save; replay allowed, convo fresh).
- Camera mostly automatic (presets + one reusable dive/black/title-card/dissolve
  transition). Audience: **teens/high school**. Typography: clean modern. Sound:
  silent for now (audioManager stub + volume control already wired).
- Conversation UI is cinematic dialogue (subtitle text, guided-question chips,
  quiet progress circle, CONTINUE lights when coverage is met, player leaves when
  ready). Persistent "AI-generated, may contain errors" label.
- Hidden debug menu: **type `debug`** — jump to any chapter/beat, reset save,
  character test screen (live node + covered learning points).
- Opening: short skippable title over the darkened war room.

## Hard rules

- **Never build hero 3D models.** The founders generate them externally (Meshy /
  open-source). You build placeholder primitives only, routed through
  `src/assets/registry.tsx` — a swap is one registry line, never logic changes.
  Prompts live in `docs/model-prompts.md`.
- **No chapter imports another chapter's internals.** Chapters are lazy modules
  reached only via `src/chapters/registry.ts`. Filling in a chapter must never touch
  shared systems.
- **The app must never white-screen.** Error boundaries stay; API failure shows an
  in-character retry, screening deflections stay in character.
- All fixed historical content must be accurate — mark uncertainty TODO for founder
  review. Restrained, non-sensational language about death/suffering (Ch4 and Ch6
  most of all). Never glorify fascism, war crimes, or violence.
- The Anthropic key exists only server-side (`ANTHROPIC_API_KEY`; `src/server/*` is
  imported only by API routes). Character = Claude Sonnet, screening/coverage =
  Haiku, ~$20 total budget; rate limits in `src/server/rateLimit.ts`.

## Architecture map

- `src/core/` — App root (single persistent R3F Canvas), SceneRouter + CameraDirector
  (gsap presets/dives), ErrorBoundary, debug tools.
- `src/state/appStore.ts` — view + transition phase machine (`out → commit →
  titleCard/in → idle`), driven by `src/cinematics/TransitionLayer.tsx` (DOM black
  overlay + title card; also the lazy-load shield).
- `src/warroom/` — map scene + markers (hover previews via drei Html, completion rings).
- `src/chapters/` — types, registry (metadata + lazy loaders), per-chapter folders
  (`Overview` + `Minigame` DOM beats). `placeholderBeats.tsx` = shared shell stubs.
- `src/conversation/` — client engine store (`engine.ts`), cinematic UI, shared
  types (`treeTypes.ts`).
- `src/content/trees/chN.ts` — one constraint tree per character: persona, knowledge
  bounds, deflections, stage nodes (learning points, guided questions, behavior
  rules, advance conditions). **ch1 is the worked example; ch2–ch6 are skeletons.**
  This is the founders' editing surface.
- `src/app/api/chat/route.ts` — pipeline: rate limit → Haiku screen → Sonnet reply
  → Haiku coverage check → node advancement. Tree resolved server-side.
- Docs: `docs/chapter-guide.md` (founder how-to), `docs/model-prompts.md` (Meshy
  prompts + how to swap a GLB in), `.harness/progress.md` (session log — keep updated).

## Current state / next steps

Foundation + vertical slice done and visually verified (2026-07-22). Everything
labeled "placeholder" is intentionally so. Pending: founder adds ANTHROPIC_API_KEY
(.env.local + Vercel env var) and connects the GitHub repo to Vercel; live-convo
end-to-end test once the key exists; then chapters get filled in one at a time
(overview scenes, real trees, real minigames), real models swapped into the
registry, sound pass, and the demo video (recorded via the debug menu).
