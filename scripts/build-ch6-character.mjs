/**
 * Bakes the founder-exported Ch6 Hiroshima doctor model into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking):
 *   - Two GLB exports of the same Mixamo-rigged doctor, one animation each
 *     (the real clip in both files is named "Armature|mixamo.com|Base Layer").
 *     Textures are embedded (Doctor_Packed0/1/2 diffuse/normal/gloss/specular),
 *     but like ch4 this export uses a specular/glossiness setup
 *     (KHR_materials_specular + a glossiness map wired into the
 *     metallicRoughness slot), which three.js would shade glossy-inverted —
 *     so the spec/gloss maps are stripped and flat roughness set per material,
 *     matching the look of the other chapters' characters.
 *
 * Output:
 *   - public/models/ch6-doctor.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", textures compressed, welded, meshopt-compressed)
 *
 * Run:  node --max-old-space-size=8192 scripts/build-ch6-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { Node, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { copyToDocument, dedup, weld, resample, prune, meshopt, unpartition, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';
import { yawClip, closeLoop } from './lib/clip-fixes.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/chapter 6 eow models';
const IDLE = arg('idle', `${SRCDIR}/Sitting Idle (4).glb`);
const TALKING = arg('talking', `${SRCDIR}/Sitting Talking (2).glb`);
const OUT_GLB = 'public/models/ch6-doctor.glb';

/* Tried dropping 'Masks' to show his face (the source asset is a generic
 * hospital-surgeon model, mask + scrub cap, which reads as a modern hospital
 * worker rather than a 1945 Army doctor) — but the face texture below the
 * mask line was never painted, so removing it exposes a broken patch instead
 * of a face. Leaving the mask on: it also reads fine in-story for a doctor
 * examining patients with an illness nobody yet understands. */
const HIDE_NODES = [];

/* flat roughness for every material — no clear skin/cloth split in the
 * material names (PackedMaterial0/1/2mat, some duplicated per mesh), so one
 * cloth-leaning value for the whole figure, same as ch5. */
const ROUGHNESS = 0.82;

/* First build measured idle gaze yaw +1.7°, talking gaze yaw −39.2° — he
 * talks to someone off to the side. Corrected the same way ch4's take was
 * (see docs/character-animation-guide.md step 4/5). */
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

  /* -- 0. drop the surgical mask (and any other listed parts) -------- */
  for (const name of HIDE_NODES) {
    const node = root.listNodes().find((n) => n.getName() === name);
    if (!node) { console.log(`HIDE_NODES: no node named "${name}"`); continue; }
    const mesh = node.getMesh();
    node.dispose();
    mesh?.dispose();
    console.log(`dropped node "${name}"`);
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

  /* -- 4. material cleanup -------------------------------------------- */
  // Strip the spec/gloss setup (see file header), and swap BLEND for MASK so
  // limbs stop z-sort-flickering through the torso, the same fix ch2/ch3/ch4
  // needed.
  for (const mat of root.listMaterials()) {
    mat.setExtension('KHR_materials_specular', null);
    mat.setMetallicRoughnessTexture(null);
    mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(false);
    mat.setMetallicFactor(0).setRoughnessFactor(ROUGHNESS);
  }

  /* -- 5. shrink and write -------------------------------------------- */
  await doc.transform(
    dedup(), weld(), resample(), prune(), unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [2048, 2048] }),
  );
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '));
  console.log('materials:', root.listMaterials().map((m) => `${m.getName()} ${m.getAlphaMode()}`).join(', '));

  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);
  console.log(`${OUT_GLB}: ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
