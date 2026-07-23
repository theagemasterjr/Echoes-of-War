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
> A miniature Supermarine Spitfire fighter plane, RAF dark green and brown camouflage over duck-egg underside, roundel insignia, propeller, slightly weathered…

### `ch3.marker` — warship (A World at War)
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

### `ch1.character` — Polish radio journalist (Warsaw, 1939)
> A photorealistic full-body 1930s Polish radio journalist, man in his thirties, tired intelligent face, rumpled grey three-piece suit with loosened tie, press card in breast pocket, headphones hanging around his neck, standing naturally.

### `ch2.character` — RAF pilot (England, 1940)
> A photorealistic full-body young RAF fighter pilot of 1940, early twenties, fatigue in his eyes, tan Irvin flying jacket over blue-grey uniform, life vest, leather flying helmet held in one hand, standing at ease.

### `ch3.character` — US Navy sailor (Pearl Harbor, 1941)
> A photorealistic full-body young US Navy sailor of 1941, white "dixie cup" cap, blue chambray work shirt and dungarees, honest open face, standing at ease.

### `ch4.character` — Soviet combat medic (Stalingrad, 1942)
> A photorealistic full-body Soviet female combat medic of 1942, heavy winter greatcoat with fur ushanka hat, medical bag across her shoulder, chapped hands, weary steady expression, standing in the cold.

### `ch5.character` — Allied field medical worker (Normandy, 1944)
> A photorealistic full-body Allied medical corps worker of 1944, olive-drab uniform with red cross armband, helmet with red cross, practical weathered field gear, kind exhausted face, standing naturally.

### `ch6.character` — Hiroshima doctor (Japan, 1945)
> A photorealistic full-body middle-aged Japanese hospital doctor of 1945, worn white medical coat over simple clothing, round glasses, gentle grave expression, standing quietly. Dignified and unharmed in appearance.

---

## Later (not needed for the framework)
- Per-chapter 2D painted backdrops (image generations, not models) — one per chapter scene.
- Pins, thread spools, small photographs and paper labels to dress the map once the real map texture exists.
