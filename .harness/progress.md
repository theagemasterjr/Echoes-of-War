# Echoes of War — progress

- 2026-07-22: Foundation + vertical slice built and visually verified locally.
  Next.js 16 + R3F app: war-room map hub (6 marker props, hover previews, completion
  rings), reusable transition (dive → black → title card → dissolve), 6 chapter shells,
  constraint-tree conversation engine (Sonnet character + Haiku screening/coverage,
  rate limits), debug menu ("debug") with character test screen, docs (model-prompts
  for Meshy, chapter-guide), README. Build passes. NOT yet done: founder must add
  ANTHROPIC_API_KEY (.env.local + Vercel) and connect repo to Vercel; live AI
  conversation untested pending key.
- 2026-07-22: Real models in (table, scroll map, radio, bandages, lantern) — compressed 100MB→2.8MB, markers placed on true map locations via click-calibration. Soundtrack wired (title+map, fades on chapter entry). Gold logo title image keyed + swapped in. Living camera (idle drift + mouse parallax) and lamp life (flicker + dust motes) added.
- 2026-07-22 (later): New clean logo image keyed and swapped in (no halo). Camera slow orbit sweep on map. Motes optimized (90, smaller). Music pauses on hidden tab, resumes on return.
- 2026-07-22 (later 2): Chapter showcase built — click marker → spin+blur fake transition → orbit close-up (-15° hero angle, 30s/lap) with right-side info panel + TALK TO THE [ROLE] button (placeholderBeats + ch1). FPS: table/map no longer cast shadows, dpr capped 1.5.
- 2026-07-23: World-map GLB retextured (new parchment map image on flat face, blank parchment texture on curled rolls) via offline GLB patch; title camera pulled back to wide shot. Verified in browser. Markers NOT yet recalibrated to new geography (user deferred).
- 2026-07-23 (later): Ch3 warship model in (Meshy wooden warship, 14MB→557KB, scale 0.2) — verified on map + showcase close-up. Title description trimmed to one sentence.
- 2026-07-23 (later 2): BEGIN transition fixed (camera drift double-add jump + wrong settle-bounce removed; title fades 0.9s BEFORE camera glide). Progressive map: only completed + current chapter markers shown; active marker hovers/rotates/1.18x with BattleFx (mini explosion flashes, smoke, flicker light); completes → settles, effects move on. 1–6 nav buttons removed. Verified in browser.
