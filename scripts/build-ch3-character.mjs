/**
 * Bakes the founder-exported Ch3 US sailor model into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking):
 *   - Two FBX->GLB conversions of the same Navy1 rig, one animation each
 *     (the real clip in both files is named "mixamo.com"). Unlike ch2, these
 *     exports already embed the diffuse + normal textures, so no external
 *     texture folder is wired in — the maps just get webp-compressed.
 *
 * Output:
 *   - public/models/ch3-sailor.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", textures compressed, welded, meshopt-compressed)
 *
 * Run:  node scripts/build-ch3-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { Node, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { copyToDocument, dedup, weld, resample, prune, meshopt, unpartition, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/chatp 3 eow models';
const IDLE = arg('idle', `${SRCDIR}/Sitting Idle (1).fbx.glb`);
const TALKING = arg('talking', `${SRCDIR}/Talking (1).fbx.glb`);
const OUT_GLB = 'public/models/ch3-sailor.glb';

/* roughness per material — skin shinier than cloth */
const ROUGHNESS = { Bodymat: 0.6, Topmat: 0.85, Bottommat: 0.85, Hatmat: 0.85, Shoesmat: 0.7 };

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
    if (a !== idleClip && a !== talkClip) a.dispose(); // empty "Take 001"s

  /* -- 2b. idle frame 0 becomes the rest pose (no more T-pose fallback) */
  bakeRestPoseFromClip(idleClip);

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
  // The export marks every material BLEND, which z-sorts each primitive as a
  // whole and makes limbs flicker through the torso. The opacity maps are
  // solid white inside the UV islands, so alpha-test (MASK) keeps any real
  // cutouts (lashes) while restoring normal depth writes.
  for (const mat of root.listMaterials()) {
    mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(false);
    mat.setMetallicFactor(0).setRoughnessFactor(ROUGHNESS[mat.getName()] ?? 0.8);
  }

  /* -- 5. shrink and write -------------------------------------------- */
  await doc.transform(
    dedup(), weld(), resample(), prune(), unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [2048, 2048] }),
  );
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '));

  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);
  console.log(`${OUT_GLB}: ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
