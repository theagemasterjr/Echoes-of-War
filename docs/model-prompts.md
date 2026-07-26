# Model Generation Prompts (Meshy)

Prompts for every hero 3D model in Echoes of War, written for **Meshy** text-to-3D.
Generate them whenever you're ready — the app runs fine on placeholders until then.

## How to use these

1. In Meshy, use **Text to 3D**. Paste the *Prompt* into the description and the *Art style* note into the style field (or pick the closest style option — "Realistic" for everything here).
2. Recommended settings: **PBR maps ON**, target polycount **low** (≤ 30k for props, ≤ 60k for characters) — the app must run on ordinary school laptops.
3. Download as **.glb** and drop the file into `public/models/` in the project.
4. Open `src/assets/registry.tsx` and change that asset's line from `kind: 'placeholder'` to
   `{ kind: 'glb', url: '/models/<your-file>.glb', scale: 1 }` — nothing else changes anywhere.
   Adjust `scale` (and optional `rotation`) until it sits right; the placeholder's footprint is the size to match.

**Shared negative prompt for everything:** `cartoon, stylized, toy-like, oversaturated colors, text, watermark, gore, blood`

**Shared style note:** photorealistic, muted 1940s palette, physically believable materials, film-lighting friendly (neutral albedo, no baked-in shadows).

---

## War room

### `warroom.table` — the map table
> A large rectangular WWII-era war room table, dark stained oak with decades of wear, subtle scratches and ring stains, sturdy squared legs, slightly worn edges, realistic wood grain, no objects on top. Photorealistic, museum-quality prop.

Footprint to match: about 15.5 × 9 units, top surface flat (the map lies on it).

### `warroom.map` — the paper world map
This one is a **texture, not a model**: the map is a flat sheet in the app. Generate a high-resolution *image* (any image AI) instead:
> A 1940s printed paper world map, aged cream paper with fold creases and worn edges, muted period ink colors (faded sepia land, pale blue oceans), printed national borders of the late 1930s, small serif place-name labels, subtle coffee stains, viewed perfectly flat, top-down, full world Mercator projection, no modern countries, no text artifacts.

Save as `public/models/map-texture.jpg` and tell the developer/Claude to wire it onto the map sheet (one-line material change).

### Desk lamp — CUT (optional, not currently in the scene)
The warm light is a virtual spotlight and doesn't need a physical lamp. If we ever
want one for atmosphere: a 1940s brass banker's desk lamp with a green enamel shade,
worn brass, cloth-wrapped cord. Adding it back is a one-line registry entry.

---

## Chapter marker miniatures
All six should read as **small tabletop game pieces** on a round wooden base coin (~0.4 units across) so they feel like one set. Add to each prompt:
> …mounted on a small round wooden base like a miniature war-game piece, tabletop-miniature proportions, photorealistic materials.

### `ch1.marker` — 1940s radio (The Spark)
> A miniature 1930s wooden tube radio with rounded top, dark walnut cabinet, woven speaker cloth, small brass dials, a thin vertical antenna…

### `ch2.marker` — Spitfire (Standing Alone)
> A miniature Supermarine Spitfire fighter plane, RAF dark green and brown camouflage over duck-egg underside, roundel insignia, propeller, slightly weathered…mounted on a small round wooden base like a miniature war-game piece, tabletop-miniature proportions, photorealistic materials.

### `ch3.marker` — warship (A World at War) — ✅ delivered
Already generated, compressed (14MB→557KB) and live in the app (`/models/warship.glb`).
Nothing to do. Original prompt kept for re-generation:
> A miniature US Navy battleship of the early 1940s, haze grey hull, superstructure and gun turrets, subtle rust streaks at the waterline…

### `ch4.marker` — medic satchel (Turning the Tide)
> A miniature Soviet military medical satchel, worn olive canvas with leather straps and a small red cross patch, frost on the fabric…

### `ch5.marker` — medic helmet (The Road Back)
> A miniature WWII American M1 combat helmet, olive drab steel with chipped paint and a small white circle bearing a red cross, worn chin strap resting beside it…

### `ch6.marker` — paper lantern (The Cost of Victory)
> A miniature Japanese paper lantern (chochin), soft cream washi paper gently glowing from within, dark wooden top and bottom rings, quiet and delicate…

---

## Characters
One per chapter. Generate as **full-body standing figures, arms relaxed at sides (or a natural at-ease pose), neutral expression**, so they can later be rigged or posed. Roughly 1.7–1.8 units tall. Respectful, dignified, historically grounded — no weapons raised, no wounds, no insignia glorification.

### `ch1.character` — Zofia Kowalska, Warsaw student & diarist (1939) — ✅ model delivered
The founders' model is live in the app (woman in a business suit, idle + talking
animations, textures baked in). It is prepared by `scripts/build-ch1-character.mjs`
from three source pieces — **two** exported `.glb` files of the same character, one
per animation (an idle loop and a talking loop, geometry but no textures), and the
Character Creator `.fbm` texture folder. The script merges both clips into one model,
matches textures to materials by name, fixes transparency, throws away the ~1800
unused shape keys the exporter drags along, and shrinks 53 MB → ~3.7 MB.
To redo it (say, after a re-export with different animations):

```
npm run build:ch1-character -- --idle "<idle .glb>" --talking "<talking .glb>" --textures "<.fbm folder>"
```

The output lands at `public/models/ch1-journalist.glb`. The background photo behind
her is a separate job — use `scripts/set-backdrop.mjs`.
The two source files must be **the same character with the same skeleton** — the
script copies the talking clip onto the idle file's rig by node name and fails loudly
if any bone is missing. Each file may carry only one real clip; the script picks the
longest one in each and ignores the exporter's 1-frame stubs. Clips are written out
as `Idle_Loop` and `Idle_Talking_Loop`, the names wired in `src/assets/registry.tsx`
(`ch1.character` → `clips`). Note on the head texture: this exporter's head UVs are
already the right way up, so no flip is applied. An older export needed one, and the
build script still supports it (`flipV` on the `Std_Skin_Head` recipe). If a re-export
ever comes back with the face upside down — the giveaway is the lips smeared down onto
the chin — set `flipV: true` on that one recipe line.

Framing is also set in the registry: the model stands 1.81 units tall on its own
origin, and `scale: 4.76` + `offset: [0, -6.13, 0]` put the top of her head at
y = 2.48, which the chapter camera frames waist-up. If a re-export changes her
height, re-measure rather than eyeballing those two numbers.

**Character update (2026-07-24):** the persona is now **Zofia Kowalska** — a
19-year-old Warsaw student and diarist, talking with the player face to face in her
one-room apartment. The delivered female model now matches the persona. The
ElevenLabs voice ("Jessica", young female) already fits.

**Two optional swaps for a closer match, whenever you like:**
1. *Model* — the current model wears a modern business suit; a period outfit would
   sit better. Suggested Meshy prompt:
   > A photorealistic full-body young Polish woman, about nineteen, in 1939 Warsaw: simple knee-length wool skirt and hand-knitted cardigan over a plain blouse, low practical shoes, light-brown hair pinned back simply, a small journal held at her side, kind alert face, standing naturally at ease, neutral expression. Muted late-1930s palette, film-lighting friendly.
2. *Backdrop* — the photo behind her is `public/img/ch1-studio.jpg`. To change it,
   save the new picture anywhere and run:

   ```
   npm run set:backdrop -- "<image file>"
   ```

   That resizes it and writes it straight to `public/img/ch1-studio.jpg` — no model
   rebuild needed. (Add a chapter id, e.g. `… "<image>" ch2`, for another chapter,
   and uncomment that chapter's `conversationBackdrop` line in
   `src/chapters/registry.ts`.)

Original generation prompt for the first (male journalist) concept, kept for history:
> A photorealistic full-body 1930s Polish radio journalist, Aleksander Nowak, man in his late thirties, tired intelligent face with a day's stubble, rumpled grey three-piece wool suit with loosened tie and rolled shirtsleeves, press card tucked in the breast pocket, headphones resting around his neck, one hand relaxed at his side, standing naturally at ease. Muted late-1930s palette, film-lighting friendly.

### `ch1.prop.microphone` — 1930s ribbon microphone (optional)
Optional desk prop for the conversation stage — a period microphone beside the journalist. Not required; the scene reads fine without it.
> A miniature 1930s ribbon radio microphone, brushed chrome and dark bakelite body with a rounded grille head, mounted on a short weighted desk stand, subtle wear on the metal, a thin cloth-wrapped cable trailing from the base. Photorealistic, muted period materials, tabletop-prop proportions.

Wire-in: add a `'ch1.prop.microphone'` row to `src/assets/registry.tsx` (same one-line `{ kind: 'glb', … }` pattern) once generated.

### `ch2.character` — Tom Ashcroft, sergeant pilot (Kent, 1940)
Match the persona in `src/content/trees/ch2.ts`: twenty, understated, worn out but alert.
If generating for animation (Meshy rig), export with a calm standing **idle** clip and a
**talking** clip, the way the ch1 character was done.
> A photorealistic full-body young RAF sergeant pilot of 1940, about twenty, tired but alert face, tan Irvin sheepskin flying jacket over blue-grey uniform, yellow Mae West life vest, leather flying helmet and goggles pushed up on his head, scuffed black flying boots, standing naturally at ease, neutral expression. No weapons, no wounds. Muted 1940 palette, film-lighting friendly.

### `ch2.prop.helmet` — flying helmet on a deckchair (reserved)
For the future chapter 2 minigame scene — registered in the asset registry, not yet drawn.
> A 1940 RAF leather flying helmet with goggles and an oxygen mask resting on a folded wooden-and-canvas deckchair, worn leather, scratched goggle glass, photorealistic, muted period materials, tabletop-prop proportions.

**Chapter 2 drop-in checklist** (each swap is one registry line in `src/assets/registry.tsx`,
next to a comment showing the exact line):
1. `public/models/ch2-spitfire.glb` → uncomment the `ch2.marker` glb line.
2. `public/models/ch2-pilot.glb` (with idle + talking clips) → uncomment the `ch2.character`
   glb block and fill in the two real clip names from the file.
3. `public/models/ch2-helmet.glb` → flip `ch2.prop.helmet` to a glb entry (used only once the
   minigame scene exists).
Also: `public/video/ch2-intro.mp4` (intro film — a styled “coming soon” frame stands in until
then) and optionally `public/img/ch2-airfield.jpg` (conversation backdrop — then uncomment its
line in `src/chapters/registry.ts`).

### `ch3.character` — Ray Doyle, US Navy sailor (Pearl Harbor, 1941)
Match the persona in `src/content/trees/ch3.ts`: nineteen, midwestern, tired, steady.
If generating for animation (Meshy rig), export with a calm standing **idle** clip and a
**talking** clip — that is what the conversation stage cross-fades between.
> A photorealistic full-body young US Navy sailor of 1941, about nineteen, white "dixie cup" cap, blue chambray work shirt with rolled sleeves and dungaree trousers, black work shoes, open honest midwestern face, tired, standing naturally at ease with arms relaxed. Muted 1940s palette, film-lighting friendly.

### `ch3.prop.dixiecup` — sailor's cap on a footlocker (reserved)
For the future chapter 3 minigame scene — registered in the asset registry, not yet drawn.
> A white US Navy "dixie cup" sailor's cap and a folded set of blue dungarees resting on a small wooden footlocker, worn canvas and brass latches, photorealistic, muted period materials, tabletop-prop proportions.

### `ch3.prop.globe` — 1941 desk globe (reserved)
The chapter's "one world" object — registered in the asset registry, not yet drawn.
> A 1941 desk globe on a dark wooden stand, aged paper gores with muted period colors and 1930s borders, small brass meridian ring, gentle wear, photorealistic, tabletop-prop proportions.

**Chapter 3 drop-in checklist** (each swap is one registry line in `src/assets/registry.tsx`,
next to a comment showing the exact line):
1. `public/models/ch3-sailor.glb` — **must be exported with an idle loop and a talking
   loop** → uncomment the `ch3.character` glb block and fill in the two real clip names.
2. `public/models/ch3-dixiecup.glb` → flip `ch3.prop.dixiecup` to a glb entry (used only
   once the minigame scene exists).
3. `public/models/ch3-globe.glb` → flip `ch3.prop.globe` to a glb entry (same).
The map marker (`warship.glb`) is already real — leave it.
Also: `public/video/ch3-intro.mp4` (intro film — a styled "coming soon" frame stands in
until then) and optionally `public/img/ch3-harbor.jpg` (conversation backdrop — then
uncomment its line in `src/chapters/registry.ts`).

### `ch4.character` — Soviet combat medic (Stalingrad, 1942)
> A photorealistic full-body Soviet female combat medic of 1942, heavy winter greatcoat with fur ushanka hat, medical bag across her shoulder, chapped hands, weary steady expression, standing in the cold.

### `ch5.character` — Allied field medical worker (Normandy, 1944)
> A photorealistic full-body Allied medical corps worker of 1944, olive-drab uniform with red cross armband, helmet with red cross, practical weathered field gear, kind exhausted face, standing naturally.

### `ch6.character` — Hiroshima doctor (Japan, 1945)
> A photorealistic full-body middle-aged Japanese hospital doctor of 1945, worn white medical coat over simple clothing, round glasses, gentle grave expression, standing quietly. Dignified and unharmed in appearance.

---

## Chapter 1 timeline figures (`ch1.figure.*`) — 8 wooden game pieces

The chapter 1 minigame is played on the 3D war-room table: eight carved wooden
figures, one per timeline event. All eight currently share the same turned-wood
pawn placeholder. Swap each in `src/assets/registry.tsx` (`ch1.figure.<id>` →
`{ kind: 'glb', url: '/models/<file>.glb', scale, offset }`) — figures should
read at roughly **0.5 units tall** on a **0.3-unit base**; tune with `scale`.

Shared style suffix for every prompt below:
> …carved from a single piece of light varnished wood like a 1930s chess piece, simple rounded forms, small round base, subtle tool marks, warm wood grain, tabletop game piece proportions.

- `ch1.figure.versailles` — Treaty of Versailles: *A miniature rolled treaty scroll with a hanging wax seal, standing upright,* + suffix
- `ch1.figure.depression` — Great Depression: *A miniature dejected man in a long coat and flat cap, shoulders slumped, hands in pockets,* + suffix
- `ch1.figure.hitler` — Hitler becomes Chancellor: *A miniature speaker's lectern with a tiny eagle emblem on the front,* + suffix (no swastika — keep it suggestive, not literal)
- `ch1.figure.rhineland` — Rhineland: *A miniature marching soldier with a rifle over his shoulder, mid-stride,* + suffix
- `ch1.figure.munich` — Munich Agreement: *A miniature folded umbrella standing upright beside a signed paper,* + suffix
- `ch1.figure.pact` — German–Soviet deal: *Two miniature hands clasped in a handshake rising from a shared base,* + suffix
- `ch1.figure.invasion` — Invasion of Poland: *A miniature tank with a low turret,* + suffix
- `ch1.figure.declarations` — Britain and France declare war: *A miniature old radio microphone on a desk stand,* + suffix

## Later (not needed for the framework)
- Per-chapter 2D painted backdrops (image generations, not models) — one per chapter scene.
- Pins, thread spools, small photographs and paper labels to dress the map once the real map texture exists.
