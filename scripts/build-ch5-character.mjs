/**
 * Bakes the founder-exported Ch5 Red Cross field medical worker into a
 * web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking / --texture):
 *   - Two GLB exports of the same Mixamo-rigged Meshy body, one animation each
 *     (the real clip in both files is named "mixamo.com"). Both are seated —
 *     hips sit at y 0.61 / 0.68 against a ~0.98 standing hip height.
 *   - Unlike every earlier chapter, these came through FBX and carry NO
 *     textures at all: the single material is "__DEFAULT", a flat grey. The
 *     Meshy base-colour map ships beside the OBJ instead, so it is wired onto
 *     the material here. The UVs survived the round-trip (the mesh node is
 *     still named after the texture file, and TEXCOORD_0 spans a full 0..1).
 *   - The FBX converter also stripped the colons out of the Mixamo bone names
 *     ("mixamorigHips", not "mixamorig:Hips"). That is harmless — both source
 *     files agree, so the clip retarget below still matches by name.
 *
 * Output:
 *   - public/models/ch5-nurse.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", texture compressed, welded, meshopt-compressed)
 *
 * Run:  node scripts/build-ch5-character.mjs
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

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/padma/Downloads';
const IDLE = arg('idle', `${SRCDIR}/Sitting Idle.fbx.glb`);
const TALKING = arg('talking', `${SRCDIR}/Talking.fbx.glb`);
const TEXTURE = arg(
  'texture',
  `${SRCDIR}/claude use this folder/claude use this folder/Meshy_AI_World_War_II_Red_Cros_0727230656_texture.png`,
);
const OUT_GLB = 'public/models/ch5-nurse.glb';

/* one Meshy mesh, one material: cloth-ish, never shiny */
const ROUGHNESS = 0.82;

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

  /* -- 2b. idle frame 0 becomes the rest pose (no more T-pose fallback) */
  bakeRestPoseFromClip(idleClip);

  /* -- 2c. report the seated head height, for the registry's scale/offset */
  for (const bone of ['mixamorigHeadTop_End', 'mixamorigHead', 'mixamorigHips']) {
    const n = byName.get(bone);
    if (!n) continue;
    const m = n.getWorldMatrix();
    console.log(`seated ${bone} (rig units): x ${m[12].toFixed(3)}, y ${m[13].toFixed(3)}, z ${m[14].toFixed(3)}`);
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

  /* -- 4. material: wire the Meshy base-colour map onto __DEFAULT ------ */
  // The FBX round-trip left the material a flat 0.60 grey with no maps. The
  // grey is a baseColorFactor, which MULTIPLIES the texture — left alone it
  // would darken the whole character by 40%, so it goes back to white.
  const image = fs.readFileSync(TEXTURE);
  const tex = doc
    .createTexture('ch5-basecolor')
    .setImage(image)
    .setMimeType('image/png');
  for (const mat of root.listMaterials()) {
    mat.setBaseColorTexture(tex);
    mat.setBaseColorFactor([1, 1, 1, 1]);
    mat.setMetallicFactor(0).setRoughnessFactor(ROUGHNESS);
    mat.setAlphaMode('OPAQUE').setDoubleSided(false);
  }

  /* -- 4b. flip V ------------------------------------------------------ */
  // This export carries OBJ/OpenGL-convention UVs (v = 0 at the BOTTOM of the
  // image); glTF puts v = 0 at the top, and three.js follows the spec. Left
  // alone, every island samples the mirrored row of the atlas: the face lands
  // on uniform cloth and she reads as olive camo from head to foot. The tell
  // is that sampling the hands the file's way gives 91% skin, the spec's way
  // 27%. One flip here beats fixing it per-consumer forever.
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
  // weld() matters more here than in the other chapters: this mesh arrives as
  // an unindexed 307k-vertex triangle soup.
  await doc.transform(
    dedup(), weld(), resample(), prune(), unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [2048, 2048] }),
  );
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '));
  console.log('materials:', root.listMaterials().map((m) => `${m.getName()} ${m.getAlphaMode()} tex=${!!m.getBaseColorTexture()}`).join(', '));
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      console.log(`verts: ${prim.getAttribute('POSITION').getCount()} indices: ${prim.getIndices()?.getCount()}`);

  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);
  console.log(`${OUT_GLB}: ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
