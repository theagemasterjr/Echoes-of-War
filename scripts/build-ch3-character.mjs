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
import { Quaternion, Vector3 } from 'three';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';
import { yawClip, closeLoop } from './lib/clip-fixes.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/chatp 3 eow models';
const IDLE = arg('idle', `${SRCDIR}/Sitting Idle (1).fbx.glb`);
const TALKING = arg('talking', 'C:/Users/sagar/Music/new talking anims ch1-3/new chapter 3 talking.glb');
const OUT_GLB = 'public/models/ch3-sailor.glb';

/* roughness per material — skin shinier than cloth */
const ROUGHNESS = { Bodymat: 0.6, Topmat: 0.85, Bottommat: 0.85, Hatmat: 0.85, Shoesmat: 0.7 };

/* "new chapter 3 talking" is animated with his head turned away: he delivers
 * the whole loop looking well to his right of where the idle looks, which on
 * the dead-on chapter camera reads as talking to someone off screen. yawClip()
 * turns it back (see scripts/lib/clip-fixes.mjs for why it can't be fixed with
 * the registry's rotation). Numbers from `node scripts/inspect-pose.mjs`
 * (measured after the Hips root-axis fix above, which is what made these
 * numbers meaningful): idle gaze sits at +1.7°, this clip sat at −42.4°.
 * Set to 0 for a talking take that already faces the same way as the idle. */
const TALK_YAW_FIX = 44;
// Named without the ':' — this idle's FBX->GLB conversion stripped it from
// every bone (see the Hips retarget note above), so that's what the merged
// document's nodes are actually called, and what yawClip()'s own by-name
// lookup needs to find them by.
const YAW_BONES = ['mixamorigNeck', 'mixamorigHead'];
/* Seconds of the talking clip's tail spent easing back onto its first frame —
 * without it the loop restarts with a visible snap (this take's was 175.9cm
 * at the head before the fix). */
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

  /* -- 1. safety: attach any orphaned skeleton roots to the scene ----- */
  const scene = root.listScenes()[0];
  const inScene = new Set(scene.listChildren());
  for (const n of root.listNodes())
    if (!inScene.has(n) && n.getParentNode() === null && n.listChildren().length > 0) {
      scene.addChild(n);
      console.log(`attached orphan root "${n.getName()}" to scene`);
    }

  /* -- 2. clips: keep idle's real clip, merge talking's in ------------ */
  // Same Navy1 rig, but the idle's FBX->GLB conversion (imagetostl.com)
  // stripped the ":" out of Mixamo bone names ("mixamorig:Hips" ->
  // "mixamorigHips"), while this talking export kept it. Matching names with
  // colons stripped confirmed all 75 bones line up 1:1 with an identical
  // parent/child hierarchy on both sides — this is a naming-convention
  // reconciliation, not a retarget across different skeletons.
  const norm = (s) => (s ?? '').replace(/:/g, '');
  const byName = new Map(root.listNodes().map((n) => [norm(n.getName()), n]));
  const idleClip = realClip(doc);
  idleClip.setName('Idle_Loop');

  const talkDoc = await io.read(TALKING);
  // This export's Armature root itself carries a static +90° rotation about X
  // (a baked Z-up -> Y-up conversion) that the idle file's converter already
  // flattened into every bone's local transform, so idle's root is identity.
  // Hips is the only bone parented directly to that root, so it's the only
  // channel that inherits the missing rotation once we reparent onto idle's
  // (unrotated) skeleton below — everything under Hips is relative to Hips
  // and needs no change. Read the exact rotation from the source rather than
  // assuming a value.
  const talkRootFix = new Quaternion(...talkDoc.getRoot().listScenes()[0].listChildren()[0].getRotation());
  const copied = copyToDocument(doc, talkDoc, [realClip(talkDoc)]);
  const talkClip = copied.get(realClip(talkDoc));
  talkClip.setName('Talking_Loop');
  // retarget the copied channels onto the original skeleton (the copy
  // brought a duplicate node graph along; prune() clears it afterwards)
  let unmatched = 0;
  for (const ch of talkClip.listChannels()) {
    const orig = byName.get(norm(ch.getTargetNode()?.getName()));
    if (orig) ch.setTargetNode(orig);
    else unmatched++;
  }
  if (unmatched) throw new Error(`${unmatched} talking channels missing a matching idle node`);

  /* -- 2a. carry the talking export's root axis convention onto Hips -- */
  if (talkRootFix.w !== 1 || talkRootFix.x || talkRootFix.y || talkRootFix.z) {
    const hips = byName.get(norm('mixamorig:Hips'));
    let fixed = 0;
    for (const ch of talkClip.listChannels()) {
      if (ch.getTargetNode() !== hips) continue;
      const path = ch.getTargetPath();
      if (path !== 'rotation' && path !== 'translation') continue;
      const out = ch.getSampler().getOutput();
      const el = [0, 0, 0, 1];
      for (let i = 0; i < out.getCount(); i++) {
        out.getElement(i, el);
        if (path === 'rotation') {
          const q = new Quaternion(...el).premultiply(talkRootFix);
          out.setElement(i, [q.x, q.y, q.z, q.w]);
        } else {
          const v = new Vector3(...el).applyQuaternion(talkRootFix);
          out.setElement(i, [v.x, v.y, v.z]);
        }
      }
      fixed++;
    }
    console.log(`Hips: applied talking export's root axis rotation across ${fixed} channel(s) (idle's root is identity, this one wasn't)`);
  }

  for (const copy of copied.values()) if (copy instanceof Node) copy.dispose();
  for (const a of root.listAnimations())
    if (a !== idleClip && a !== talkClip) a.dispose(); // empty "Take 001"s

  /* -- 2b. bring the talking clip's gaze round to the camera, and make it
           loop cleanly (see TALK_YAW_FIX / closeLoop above) -------------- */
  if (TALK_YAW_FIX) yawClip(talkClip, doc, YAW_BONES, TALK_YAW_FIX);
  closeLoop(talkClip, TALK_LOOP_BLEND);

  /* -- 2c. idle frame 0 becomes the rest pose (no more T-pose fallback) */
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
