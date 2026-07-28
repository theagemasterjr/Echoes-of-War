/**
 * Bakes the founder-exported Ch3 US sailor into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking / --texture):
 *   - Two GLB exports of the same Mixamo-rigged Meshy body, one animation each
 *     (the real clip in both files is named "mixamo.com"). Both are seated.
 *   - Like ch5 (and unlike the earlier Navy1 export this replaces), these came
 *     through FBX and carry NO textures: the single material is "__DEFAULT",
 *     a flat grey. The Meshy base-colour map ships beside the OBJ in the
 *     sailor textures folder instead, so it is wired onto the material here.
 *   - The source files are named "soldier idle/talking.glb" in Downloads, but
 *     the mesh node inside both is "Meshy_AI_Sailor_in_a_T_Pose_0727232855_
 *     texture" — they are the sailor, just misnamed on export.
 *   - The FBX converter stripped the colons out of the Mixamo bone names
 *     ("mixamorigHips", not "mixamorig:Hips"). Harmless — both source files
 *     agree, so the clip retarget below still matches by name.
 *
 * Output:
 *   - public/models/ch3-sailor.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", texture compressed, welded, meshopt-compressed)
 *
 * Run:  node scripts/build-ch3-character.mjs
 */
// sharp MUST be imported before @gltf-transform/functions. Something functions
// pulls in loads a conflicting native library first, and sharp's own .node
// binding then fails to dlopen ("the specified procedure could not be found").
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
const IDLE = arg('idle', `${SRCDIR}/soldier idle.glb`);
const TALKING = arg('talking', `${SRCDIR}/soldier talking.glb`);
const TEXTURE = arg(
  'texture',
  `${SRCDIR}/sailor textures/Meshy_AI_Sailor_in_a_T_Pose_0727232855_texture_obj/Meshy_AI_Sailor_in_a_T_Pose_0727232855_texture.png`,
);
const OUT_GLB = 'public/models/ch3-sailor.glb';

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
    .createTexture('ch3-basecolor')
    .setImage(image)
    .setMimeType('image/png');
  for (const mat of root.listMaterials()) {
    mat.setBaseColorTexture(tex);
    mat.setBaseColorFactor([1, 1, 1, 1]);
    mat.setMetallicFactor(0).setRoughnessFactor(ROUGHNESS);
    mat.setAlphaMode('OPAQUE').setDoubleSided(false);
  }

  /* -- 4b. flip V ------------------------------------------------------ */
  // Same OBJ/OpenGL-convention UVs as ch5 (v = 0 at the BOTTOM of the image);
  // glTF puts v = 0 at the top and three.js follows the spec. Left alone,
  // every island samples the mirrored row of the atlas and the face lands on
  // uniform navy cloth. Measured on this export the same way ch5 was: the
  // head-region vertices sample 0.4% skin the file's way and 60% the spec's
  // way. One flip here beats fixing it per-consumer forever.
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
  // weld() matters here: this mesh arrives as an unindexed 310k-vertex soup.
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
