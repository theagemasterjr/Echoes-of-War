# Character animation guide — dropping a new idle/talking clip into a chapter

Every chapter character is one file, `public/models/chN-<name>.glb`, holding **two
clips**: `Idle_Loop` (plays while the player reads or types) and `Talking_Loop` (plays
while the character speaks). A new animation from Mixamo/Meshy always arrives as a
separate export, so the job is: convert it, merge it into the chapter's model, fix the
two things these takes always get wrong, then set how the model sits on camera.

Chapter 4 (July 2026, the "Sitting Talking" take) is the worked example throughout.

---

## Step 1 — get a `.glb` out of the download

Founder exports arrive as `.fbx`, sometimes zipped, sometimes already converted by
imagetostl.com. Unzip it and put the `.glb` next to that chapter's other source files:

```
C:/Users/sagar/Music/chapter 4 eow models/Sitting Talking.glb
```

These source files are huge (~130 MB — full 4K textures). They stay outside the repo;
only the built model goes in `public/models/`.

The animation is the only thing taken from a talking export — the body, textures and
skeleton all come from the chapter's **idle** file. So a talking export of the wrong
character still works, as long as it is the **same rig** (same bone names).

## Step 2 — look inside it before building

```
node scripts/inspect-glb.mjs "C:/Users/sagar/Music/chapter 4 eow models/Sitting Talking.glb"
```

Check three things:

- **one real clip** (usually named `Armature|mixamo.com|Layer0`) — the build script picks
  the clip that actually has channels, so extra empty clips are harmless.
- **bone names match the idle file** (`mixamorig:Hips`, `mixamorig:Head`, …). If they
  don't, the build stops with `N talking channels missing a matching idle node` — the
  export came off a different rig and has to be re-exported.
- **the same body/material names** as the idle file, if you also plan to take the mesh
  from it.

## Step 3 — point the chapter's build script at it and build

Each chapter has `scripts/build-chN-character.mjs`. Set its `TALKING` default (or pass
the flag) and run it:

```
node --max-old-space-size=8192 scripts/build-ch4-character.mjs --talking "C:/.../Sitting Talking.glb"
```

The script merges the new clip onto the idle file's skeleton, names the two clips,
bakes the idle's first frame as the model's rest pose, cleans up materials, compresses
the textures to webp and writes `public/models/ch4-medic.glb` (~4 MB).

## Step 4 — measure how the new clip actually sits

```
node scripts/inspect-pose.mjs public/models/ch4-medic.glb
```

The report is per clip, and the header comment in that script explains every line. The
four numbers that decide everything:

| number | what it means | what you want |
| --- | --- | --- |
| `gaze yaw` | where the face points; `0` = at the player, positive = toward the player's right | idle and talking within a few degrees of **each other** |
| `hips y` | seat height | idle and talking within ~0.01, or he pops up when a line starts |
| `lowest` | bottom of the silhouette | ~0 — he rests on his own origin |
| `loop worst bone jump` | how far a bone teleports when the loop restarts | under ~1 cm |

Chapter 4's raw download measured `gaze yaw −39.4°` and a **45.3 cm** hand jump. Both
are fixed in the build, by the two knobs in the next step.

## Step 5 — the two fixes at the top of the build script

```js
const TALK_YAW_FIX = 41;              // degrees, positive = turn toward the player's right
const YAW_BONES = ['mixamorig:Neck', 'mixamorig:Head'];
const TALK_LOOP_BLEND = 0.6;          // seconds of the tail eased back onto frame 0
```

**`TALK_YAW_FIX` — he talks to someone off screen.** Set it to
`idle gaze yaw − talking gaze yaw` from step 4 (ch4: `1.7 − (−39.4) ≈ 41`). Rotating the
whole model in the registry cannot fix this: both clips share one rotation, so
straightening the talking clip would swing the idle away instead. The turn is taken out
of the clip itself, split over the neck and the head so the pose stays believable. Set
it to `0` when a take already faces the same way as the idle.

**`TALK_LOOP_BLEND` — the clip snaps when it restarts.** An animator ends a take
wherever they stop, so the last pose isn't the first pose. This eases every bone back
onto frame 0 over the last fraction of a second. `0.6` is a good default; the build
prints the size of the seam it closed (`biggest seam closed: 77.1°`). Longer clips can
take `0.8`–`1.0`; below ~0.3 the return itself starts to look like a flinch.

Both live in `scripts/lib/clip-fixes.mjs` and work for any chapter — import them the
same way ch4 does. Rebuild and re-run step 4 to confirm the numbers moved.

## Step 6 — position him on camera

The chapter camera is dead-on and identical for every chapter, so all the framing lives
in one row of `src/assets/registry.tsx`:

```js
'ch4.character': {
  source: {
    kind: 'glb', url: '/models/ch4-medic.glb',
    scale: 4.76, offset: [0, -3.79, -0.5], rotation: [0, 0.1, 0], castShadow: false,
    clips: { idle: 'Idle_Loop', talking: 'Talking_Loop' },
  },
},
```

- **`scale`** — `4.76` for every metre-scale rig. Don't change it to fix height.
- **`offset[1]`** — height. Every chapter's head lands on about the same line: multiply
  the `headBone` number from step 4 by `4.76` and subtract, aiming for ~1.49.
  (ch4: `4.76 × 1.108 − 3.79 = 1.48`.)
- **`offset[2]`** — `-0.5`, how far back he sits. Same for all chapters.
- **`rotation[1]`** — the turn, in radians. **Positive turns him toward the player's
  right**, negative to the left. `0.1` ≈ 6°. Use it for taste only — never to fix a clip
  that looks away (that's `TALK_YAW_FIX`).
- **`headTilt`** (optional, see ch1) — lifts the gaze when a clip is animated chin-down.

## Step 7 — look at it in the app

`npm run dev`, then type **`debug`** anywhere on the page — the debug panel opens with a
`conversation` button per chapter, which drops you straight onto the character. That
shows the **idle**. To watch the talking clip, temporarily set
`clips: { idle: 'Talking_Loop', … }` in the registry, look, then **put `Idle_Loop`
back** — leaving it swapped means the character never stops gesturing.

---

## When something looks wrong

| What you see | What it is | Fix |
| --- | --- | --- |
| He talks to the side / to someone off screen | talking take animated turned away | `TALK_YAW_FIX` (step 5) |
| A jerk or snap every few seconds while he talks | clip's last pose ≠ first pose | `TALK_LOOP_BLEND` (step 5) |
| He pops up or drops when a line starts | idle and talking sit at different `hips y` | ask for a talking take recorded from the same seated pose; a small difference can be hidden with a longer `TALK_LOOP_BLEND` on the idle |
| He never stops talking / the idle is gone | `clips.idle` was left on `Talking_Loop` from step 7 | set it back to `Idle_Loop` |
| Grey / white / untextured character | almost always the model file being rewritten while the page is open | wait for the rebuild to finish, then hard-reload. If it survives a reload, run `node scripts/inspect-glb.mjs` on the built file: every texture should be `image/webp`, and each material should name a `baseTex` and a `normTex` |
| T-posed, arms straight out | no clip is playing — the rest pose is showing | check the clip names in the registry match `inspect-glb.mjs`'s output exactly |
| He floats above or sinks into the seat | `offset[1]` | step 6 |
| Limbs flicker through each other | material alpha mode | the build sets `MASK`; check `inspect-glb.mjs` doesn't report `alpha=BLEND` |
| Build stops: `N talking channels missing a matching idle node` | the two exports are different rigs | re-export the talking take from the same character |
| Build runs out of memory | 130 MB sources | prefix with `node --max-old-space-size=8192` |

## The three commands

```
node scripts/inspect-glb.mjs  <file.glb>   # what's inside: clips, materials, textures, bones
node scripts/inspect-pose.mjs <file.glb>   # how it sits on camera: gaze, seat, loop seam
node scripts/build-chN-character.mjs       # source exports -> public/models/chN-*.glb
```

Related: `docs/chapter-guide.md` (filling in a chapter), `docs/model-prompts.md` (asking
for new models).
