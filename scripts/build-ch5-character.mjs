/**
 * Bakes the founder-exported Ch5 field medical orderly ("Army Character 3")
 * into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking):
 *   - Two GLB exports of the same Mixamo-rigged body, one animation each (the
 *     real clip in both files is named "Armature|mixamo.com|Layer0"), coming
 *     through imagetostl.com from an FBX. Bone names carry the colon
 *     ("mixamorig:Hips"), unlike the previous ch5 model.
 *   - Eight meshes, one per body part, each named "Object_<key>.jpgmesh" and
 *     carrying NO material at all — every material is built here from the
 *     matching jpg in TEXDIR. The uniform texture's OBJ material name was
 *     "navy" (see mat_2-navy.jpg in the source .obj), but the founder's
 *     texture folder ships it as "camouflage.jpg" — TEXTURE_MAP below is
 *     where that rename is bridged.
 *   - Same OBJ round-trip as the previous ch5 model, so the same OpenGL/OBJ
 *     V-flip applies (see step 4b below) — left alone, every texture samples
 *     its mirrored row.
 *
 * Output:
 *   - public/models/ch5-nurse.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", textures compressed, welded, meshopt-compressed) —
 *     filename kept from the previous character so nothing else in the
 *     registry needs to change.
 *
 * Run:  node --max-old-space-size=8192 scripts/build-ch5-character.mjs
 */
// sharp MUST be imported before @gltf-transform/functions. Something functions
// pulls in loads a conflicting native library first, and sharp's own .node
// binding then fails to dlopen ("the specified procedure could not be found").
// Import order is the whole fix — on machines where functions happens to win
// the race, every other build script here hits the same wall.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { Node, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { copyToDocument, dedup, weld, resample, prune, meshopt, unpartition, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';
import { yawClip, closeLoop } from './lib/clip-fixes.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/chapter 5 new model';
const IDLE = arg('idle', `${SRCDIR}/source/extracted/Sitting Idle (5).glb`);
const TALKING = arg('talking', `${SRCDIR}/source/extracted/Sitting Talking (3).glb`);
const TEXDIR = arg('textures', `${SRCDIR}/textures`);
const OUT_GLB = 'public/models/ch5-nurse.glb';

/* mesh name (Object_<key>.jpgmesh) -> texture file in TEXDIR. The OBJ's own
 * material name for the uniform was "navy"; the founder's texture folder
 * ships that map as "camouflage.jpg". */
const TEXTURE_MAP = {
  body: 'body.jpg',
  eye: 'eye.jpg',
  feet: 'feet.jpg',
  hand: 'hand.jpg',
  head: 'head.jpg',
  lowr_diff: 'lowr_diff.jpg',
  navy: 'camouflage.jpg',
  sumka: 'sumka.jpg',
};

/* cloth/skin mix, never shiny — same flat value every other chapter's
 * founder-sourced body uses */
const ROUGHNESS = 0.82;

/* First build measured idle gaze yaw +1.7°, talking gaze yaw -39.3° — he
 * talks to someone off to the side, same as ch4/ch6's takes. Corrected the
 * same way (see docs/character-animation-guide.md step 4/5). */
const TALK_YAW_FIX = 41;
const YAW_BONES = ['mixamorig:Neck', 'mixamorig:Head'];
const TALK_LOOP_BLEND = 0.6;

const realClip = (doc) =>
  doc.getRoot().listAnimations().find((a) => a.listChannels().length > 0);

async function main() {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  const doc = await io.read(IDLE);
  const root = doc.getRoot();
  doc.createExtension(EXTTextureWebP).setRequired(true);

  /* -- 0. undo an extra 0.01 scale imagetostl.com baked onto the scene's
          root nodes ("Armature" and its sibling empty node) on top of an
          otherwise correctly-scaled rig: mesh vertex data and the skin's
          inverseBindMatrices already compensate each other (vertex bboxes
          ~0.01 units, inverseBindMatrix rotation blocks carrying a built-in
          ×100), and the joint chain's own local translations are already
          proper metre-scale (~1.5-1.8m head height) — this ancestor scale is
          pure double-counting that shrinks the whole character to ~1.5cm.
          Fixing it here (rather than in the registry) keeps this model on
          the same scale=4.76 convention as every other chapter. ------------ */
  for (const n of root.getDefaultScene().listChildren()) {
    const [sx, sy, sz] = n.getScale();
    if (Math.abs(sx - 0.01) < 1e-4 && Math.abs(sy - 0.01) < 1e-4 && Math.abs(sz - 0.01) < 1e-4) {
      n.setScale([1, 1, 1]);
      console.log(`reset "${n.getName()}" scale 0.01 -> 1 (redundant unit conversion)`);
    }
  }

  /* -- 1. safety: attach any orphaned skeleton roots to the scene ----- */
  const scene = root.listScenes()[0];
  const inScene = new Set(scene.listChildren());
  for (const n of root.listNodes())
    if (!inScene.has(n) && n.getParentNode() === null && n.listChildren().length > 0) {
      scene.addChild(n);
      console.log(`attached orphan root "${n.getName()}" to scene`);
    }

  /* -- 2. clips: keep idle's real clip, merge talking's in ------------ */
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const idleClip = realClip(doc);
  idleClip.setName('Idle_Loop');

  const talkDoc = await io.read(TALKING);
  const copied = copyToDocument(doc, talkDoc, [realClip(talkDoc)]);
  const talkClip = copied.get(realClip(talkDoc));
  talkClip.setName('Talking_Loop');
  // retarget the copied channels onto the original skeleton (the copy
  // brought a duplicate node graph along; prune() clears it afterwards)
  let unmatched = 0;
  for (const ch of talkClip.listChannels()) {
    const orig = byName.get(ch.getTargetNode()?.getName());
    if (orig) ch.setTargetNode(orig);
    else unmatched++;
  }
  if (unmatched) throw new Error(`${unmatched} talking channels missing a matching idle node`);
  for (const copy of copied.values()) if (copy instanceof Node) copy.dispose();
  for (const a of root.listAnimations())
    if (a !== idleClip && a !== talkClip) a.dispose();

  /* -- 2b. bring the talking clip's gaze round to the camera, and make it
           loop cleanly (see TALK_YAW_FIX / closeLoop above) -------------- */
  if (TALK_YAW_FIX) yawClip(talkClip, doc, YAW_BONES, TALK_YAW_FIX);
  closeLoop(talkClip, TALK_LOOP_BLEND);

  /* -- 2c. idle frame 0 becomes the rest pose (no more T-pose fallback) */
  bakeRestPoseFromClip(idleClip);

  /* -- 2d. report the seated head height, for the registry's scale/offset */
  const head = byName.get('mixamorig:HeadTop_End');
  if (head) {
    const m = head.getWorldMatrix();
    console.log(`seated head top (rig units): x ${m[12].toFixed(3)}, y ${m[13].toFixed(3)}, z ${m[14].toFixed(3)}`);
  }

  /* -- 3. drop unused vertex attributes ------------------------------- */
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics())
        if (sem === 'TANGENT' || sem.startsWith('COLOR_')) {
          const acc = prim.getAttribute(sem);
          prim.setAttribute(sem, null);
          acc?.dispose();
        }

  /* -- 4. materials: build one per mesh from TEXTURE_MAP -------------- */
  const texCache = new Map(); // texture file -> gltf-transform Texture
  const matCache = new Map(); // texture file -> gltf-transform Material
  let wired = 0;
  for (const mesh of root.listMeshes()) {
    const key = mesh.getName().match(/^Object_(.+)\.jpgmesh$/)?.[1];
    const file = key && TEXTURE_MAP[key];
    if (!file) {
      console.warn(`no texture mapping for mesh "${mesh.getName()}" — left untextured`);
      continue;
    }
    if (!matCache.has(file)) {
      let tex = texCache.get(file);
      if (!tex) {
        tex = doc.createTexture(file).setImage(fs.readFileSync(path.join(TEXDIR, file))).setMimeType('image/jpeg');
        texCache.set(file, tex);
      }
      const mat = doc.createMaterial(key)
        .setBaseColorTexture(tex)
        .setBaseColorFactor([1, 1, 1, 1])
        .setMetallicFactor(0).setRoughnessFactor(ROUGHNESS)
        .setAlphaMode('OPAQUE').setDoubleSided(false);
      matCache.set(file, mat);
    }
    const mat = matCache.get(file);
    for (const prim of mesh.listPrimitives()) prim.setMaterial(mat);
    wired++;
  }
  console.log(`wired ${wired} mesh(es) to ${matCache.size} material(s)`);

  /* -- 4b. flip V ------------------------------------------------------ */
  // This export carries OBJ/OpenGL-convention UVs (v = 0 at the BOTTOM of the
  // image); glTF puts v = 0 at the top, and three.js follows the spec. Left
  // alone, every island samples the mirrored row of its texture. Same fix as
  // the previous ch5 model (see that build's note for the diagnostic).
  const flipped = new Set();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!uv || flipped.has(uv)) continue; // primitives can share an accessor
      flipped.add(uv);
      const el = [];
      for (let i = 0; i < uv.getCount(); i++) {
        uv.getElement(i, el);
        el[1] = 1 - el[1];
        uv.setElement(i, el);
      }
    }
  console.log(`flipped V on ${flipped.size} UV set(s)`);

  /* -- 5. shrink and write -------------------------------------------- */
  await doc.transform(
    dedup(), weld(), resample(), prune(), unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [2048, 2048] }),
  );
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '));
  console.log('materials:', root.listMaterials().map((m) => `${m.getName()} ${m.getAlphaMode()} tex=${!!m.getBaseColorTexture()}`).join(', '));

  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);
  console.log(`${OUT_GLB}: ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
