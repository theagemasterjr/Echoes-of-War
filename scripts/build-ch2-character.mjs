/**
 * Bakes the founder-exported Ch2 RAF pilot model into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking / --textures):
 *   - Two FBX->GLB conversions of the same rig, one animation each
 *     (the real clip in both files is named "mixamo.com"; the empty
 *     "Take 001" clips are dropped). No textures embedded.
 *   - A folder of texture files. Material names in the GLB are generic
 *     ("lambert2" etc.) so the mapping below is explicit — it was recovered
 *     from the texture references inside the source FBX.
 *
 * Output:
 *   - public/models/ch2-pilot.glb  (both clips merged: "Idle_Loop" +
 *     "Talking_Loop", textures baked, welded, meshopt-compressed)
 *
 * Run:  node scripts/build-ch2-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { Node, NodeIO, TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { copyToDocument, dedup, weld, resample, prune, meshopt, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';
import { yawClip, closeLoop } from './lib/clip-fixes.mjs';
import { Quaternion, Vector3 } from 'three';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/chapter 2 eow models';
const IDLE = arg('idle', `${SRCDIR}/Sitting Idle.fbx.glb`);
const TALKING = arg('talking', 'C:/Users/sagar/Music/new talking anims ch1-3/new chapter 2 talking.glb');
const TEXDIR = arg('textures', `${SRCDIR}/textures (chapter 2 claude)`);
const OUT_GLB = 'public/models/ch2-pilot.glb';

/* "new chapter 2 talking.glb" talks ~15.5° further to the player's left than
 * the idle looks. Numbers from `node scripts/inspect-pose.mjs`: idle gaze
 * sits at −1.5°, this clip sat at −17.0° (idle − talking ≈ 15.5). */
const TALK_YAW_FIX = 15.5;
// names as they appear in the idle doc (post-merge target), i.e. colon-stripped
const YAW_BONES = ['ww2_ger_test_archetypeNeck', 'ww2_ger_test_archetypeHead'];
/* Seconds of the talking clip's tail spent easing back onto its first frame —
 * without it the loop restarts with a visible snap. */
const TALK_LOOP_BLEND = 0.6;

/* ------------------------------------------------------------------ *
 * Material -> texture mapping (from the source FBX's texture wiring).
 * size = max diffuse edge; normal = max normal-map edge (omit = none).
 * lambert1 (mouth interior + chin strap) ships untextured on purpose —
 * the FBX gives it no texture either; its baked diffuse color stays.
 * ------------------------------------------------------------------ */
const RECIPES = {
  layeredShader1: { diffuse: 't_ww2_ger_gloves_09_e2_cs.jpg', size: 512, rough: 0.8 },
  lambert4: { diffuse: 'ger_torso01_diffuse_eichenlaubmuster.jpg', size: 2048, normal: 'ger_torso01_normal.jpg', nsize: 1024, rough: 0.85 },
  lambert2: { diffuse: 'ger_torso01_diffuse_eichenlaubmuster.jpg', size: 2048, normal: 'ger_torso01_normal.jpg', nsize: 1024, rough: 0.85 },
  // the head UVs are V-flipped vs the texture (same exporter quirk as ch1) —
  // mirror the maps; a flipped normal map also needs its green channel inverted
  lambert5: { diffuse: 'head_markf_c_b535bf51cb98334c.jpg', size: 2048, normal: 'head_markf_ns_e53c4a285330b1cc.jpg', nsize: 1024, rough: 0.55, flipV: true },
  lambert8: { diffuse: 'eye_blue_color.jpg', size: 512, rough: 0.15 },
  lambert1: { rough: 0.6 },
  lambert3: { diffuse: 'ger_torso01_equipment_diffuse.jpg', size: 2048, normal: 'ger_torso01_equipment_normal.jpg', nsize: 1024, rough: 0.8 },
  lambert11: { diffuse: 't_ger_base_legs_cs_final.jpg', size: 1024, normal: 't_ger_base_legs_nmo%20884182638d535a5d%200.jpg', nsize: 1024, rough: 0.85 },
};

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
  // The idle export's FBX->GLB conversion stripped the rig's Maya namespace
  // colon ("ww2_ger_test_archetypeHips"); "new chapter 2 talking.glb" kept it
  // ("ww2_ger_test_archetype:Hips") — same 65-bone rig, same names, just a
  // different converter's namespace serialization (three.js's GLTFLoader
  // strips this same colon on load, see inspect-pose.mjs). Match by name with
  // colons stripped on both sides so this isn't mistaken for a rig mismatch.
  //
  // The idle doc also has several DUPLICATE nodes per central-body bone name
  // (Hips/Spine*/Neck/Head/Shoulders each have 2-5 same-named node objects —
  // one per mesh's separate skin cluster from the FBX export), and only ONE
  // instance per name is the one idle's own clip actually drives; the rest
  // are other skins' frozen joints. Retargeting to "whichever node has this
  // name" can land on a duplicate idle never animates, leaving the true live
  // joint frozen while an unrelated duplicate jerks around. So the byName map
  // is built from idle's OWN animated targets first (guaranteed the live
  // instance) and only falls back to an arbitrary same-named node for bones
  // idle doesn't animate at all (fingers/toes — no live instance to prefer).
  const stripColon = (n) => n?.replace(/:/g, '');
  const idleClip = realClip(doc);
  const byName = new Map(root.listNodes().map((n) => [stripColon(n.getName()), n])); // fallback pass
  for (const ch of idleClip.listChannels()) // then overwrite with the live instances
    byName.set(stripColon(ch.getTargetNode()?.getName()), ch.getTargetNode());
  idleClip.setName('Idle_Loop');

  const talkDoc = await io.read(TALKING);
  const copied = copyToDocument(doc, talkDoc, [realClip(talkDoc)]);
  const talkClip = copied.get(realClip(talkDoc));
  talkClip.setName('Talking_Loop');
  // retarget the copied channels onto the original skeleton (the copy
  // brought a duplicate node graph along; prune() clears it afterwards)
  let unmatched = 0;
  for (const ch of talkClip.listChannels()) {
    const orig = byName.get(stripColon(ch.getTargetNode()?.getName()));
    if (orig) ch.setTargetNode(orig);
    else unmatched++;
  }
  if (unmatched) throw new Error(`${unmatched} talking channels missing a matching idle node`);
  // the copy dragged a duplicate node graph (plus meshes/skins) along —
  // drop it now that the channels point at the original skeleton
  for (const copy of copied.values()) if (copy instanceof Node) copy.dispose();
  for (const a of root.listAnimations())
    if (a !== idleClip && a !== talkClip) a.dispose(); // empty "Take 001"s

  /* -- 2a2. this talking export's whole rig sits under an explicit "Armature"
   *      root node (+90° about X — a baked Z-up->Y-up correction — and a
   *      0.01 unit scale) that idle's rig doesn't have: idle's exporter baked
   *      that same correction into every bone instead of leaving it as a root
   *      transform, so its Hips sits directly under an identity ancestor.
   *      "ww2_ger_test_archetypeHips" is the only bone parented directly to
   *      that root, so once retargeted onto idle's un-rotated hierarchy only
   *      ITS translation+rotation channels are in the wrong frame — every
   *      other bone's channel is relative to its own parent BONE, unaffected
   *      by the root discrepancy. Confirmed with the raw numbers: rotating
   *      talk's Hips frame-0 translation (-0.27, 2.41, -55.01) by +90° about
   *      X gives (-0.27, 55.01, 2.41), matching idle's Hips (0.05, 54.52,
   *      1.88) — so the fix is that one rotation, no rescale (idle's
   *      hierarchy is already unscaled, so the root's 0.01 is dropped, not
   *      applied). */
  const ARMATURE_ROT = new Quaternion(0.7071068, 0, 0, 0.7071068); // talkDoc's "Armature" node rotation
  const hipsNode = byName.get('ww2_ger_test_archetypeHips');
  let hipsFixed = 0;
  for (const ch of talkClip.listChannels()) {
    if (ch.getTargetNode() !== hipsNode) continue;
    const targetPath = ch.getTargetPath();
    if (targetPath !== 'translation' && targetPath !== 'rotation') continue;
    const out = ch.getSampler().getOutput();
    const el = targetPath === 'rotation' ? [0, 0, 0, 1] : [0, 0, 0];
    for (let i = 0; i < out.getCount(); i++) {
      out.getElement(i, el);
      if (targetPath === 'translation') {
        const v = new Vector3(...el).applyQuaternion(ARMATURE_ROT);
        out.setElement(i, [v.x, v.y, v.z]);
      } else {
        const q = ARMATURE_ROT.clone().multiply(new Quaternion(...el));
        out.setElement(i, [q.x, q.y, q.z, q.w]);
      }
    }
    hipsFixed++;
  }
  console.log(`Hips: rotated ${hipsFixed} channel(s) into idle's un-rotated root frame`);

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

  /* -- 4. bake textures per material ---------------------------------- */
  const texCache = new Map();
  const buildTexture = async (key, build) => {
    if (!texCache.has(key)) {
      const data = await build();
      texCache.set(key, doc.createTexture(key).setImage(data).setMimeType('image/webp'));
    }
    return texCache.get(key);
  };

  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    const r = RECIPES[name];
    if (!r) {
      console.warn(`!! no recipe for material "${name}"`);
      continue;
    }
    mat.setMetallicFactor(0).setRoughnessFactor(r.rough);
    if (!r.diffuse) {
      console.log(`${name}: untextured, color ${mat.getBaseColorFactor().map((v) => v.toFixed(2))}`);
      continue;
    }
    mat.setBaseColorFactor([1, 1, 1, 1]);
    const tex = await buildTexture(`${r.diffuse}|${r.size}|${r.flipV ? 'f' : ''}`, async () => {
      let img = sharp(path.join(TEXDIR, r.diffuse))
        .resize(r.size, r.size, { fit: 'inside', withoutEnlargement: true });
      if (r.flipV) img = img.flip();
      return img.webp({ quality: 82 }).toBuffer();
    });
    mat.setBaseColorTexture(tex).setAlphaMode('OPAQUE');
    mat.getBaseColorTextureInfo()?.setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR);
    if (r.normal) {
      const ntex = await buildTexture(`${r.normal}|${r.nsize}|${r.flipV ? 'f' : ''}`, async () => {
        let img = sharp(path.join(TEXDIR, r.normal))
          .resize(r.nsize, r.nsize, { fit: 'inside', withoutEnlargement: true });
        if (r.flipV) {
          // mirror, then invert green so the normals still point the right way
          const flipped = await img.flip().raw().toBuffer({ resolveWithObject: true });
          for (let i = 1; i < flipped.data.length; i += flipped.info.channels)
            flipped.data[i] = 255 - flipped.data[i];
          img = sharp(flipped.data, { raw: flipped.info });
        }
        return img.webp({ quality: 90 }).toBuffer();
      });
      mat.setNormalTexture(ntex);
    }
    console.log(`${name}: ${r.diffuse} @${r.size}${r.normal ? ' +normal' : ''}`);
  }

  /* -- 5. shrink and write -------------------------------------------- */
  await doc.transform(dedup(), weld(), resample(), prune(), unpartition());
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
