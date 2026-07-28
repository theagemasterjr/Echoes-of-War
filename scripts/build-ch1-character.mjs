/**
 * Bakes the founder-exported Ch1 journalist model into a web-ready GLB.
 *
 * Rebuilt July 2026 onto a Mixamo rig (`mixamorig:*` bones). The founder's
 * previous take was on a Character Creator rig (`CC_Base_*` bones, named
 * materials like `Std_Skin_Head`); re-animating through Mixamo re-rigged the
 * character AND destroyed every mesh/material name (generic `objN` /
 * `matNmat`). So this build does two things the other chapters' scripts
 * don't have to:
 *   1. reconcile the idle/talking root-frame convention (same shape of fix
 *      as ch2/ch3 — see step 2a below);
 *   2. re-attach Character-Creator textures to anonymous Mixamo primitives by
 *      matching each primitive's triangle count / UV bbox / position bbox
 *      against the OLD ch1-journalist.glb (which still has correct material
 *      names) and inheriting its name. See MESH_MATERIAL_MAP below — the
 *      match was exact (triangle counts agree to within a handful of tris,
 *      almost certainly from a different weld pass) for all 39 primitives,
 *      so the map is hardcoded rather than computed at build time; the
 *      per-primitive comparison that produced it is recorded next to each
 *      entry.
 *
 * Input (defaults; override with --idle / --talking / --textures):
 *   - IDLE: an FBX2glTF conversion of the Mixamo "Sitting Idle" take —
 *     mixamorig:* bones (colons kept), meshes obj1..obj18, materials
 *     mat0mat..mat38mat with no textures. Its scene root ("RootNode") is
 *     identity — no baked rotation/scale.
 *   - TALKING: an imagetostl.com conversion of the Mixamo "Sitting Talking"
 *     take on the SAME rig, but its whole skeleton is authored in
 *     centimetres and its scene root ("Armature") carries a +90 degrees-
 *     about-X rotation and a 0.01 uniform scale (a baked Z-up -> Y-up + cm->m
 *     conversion that the idle's converter instead flattened into identity
 *     and metre units). Every bone's translation channel needs the 0.01
 *     unscaled once copied onto idle's metre-scale hierarchy, and
 *     mixamorig:Hips — the only bone parented directly to Armature — also
 *     needs the root rotation applied on top (see step 2a).
 *   - TEXTURES: Character Creator ".fbm" folder (…_Diffuse/_Normal/_Opacity).
 *     Material names assigned below match the file stems.
 *
 * Output:
 *   - public/models/ch1-journalist.glb   (one model, both clips, textures
 *     baked, morphs stripped, welded, meshopt)
 *
 * Before writing the output this script copies the CURRENT
 * public/models/ch1-journalist.glb (the CC-rig build, and the only
 * reference for the old material names) to
 * C:/Users/sagar/Music/new talking anims ch1-3/ch1-journalist.CCrig-backup.glb
 *
 * Run:  node --max-old-space-size=8192 scripts/build-ch1-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, weld, resample, prune, meshopt } from '@gltf-transform/functions';
import { bakeRestPoseFromClip } from './lib/rest-pose.mjs';
import { yawClip, closeLoop } from './lib/clip-fixes.mjs';
import { MeshoptEncoder } from 'meshoptimizer';
import { Quaternion, Vector3 } from 'three';
import sharp from 'sharp';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRCDIR = 'C:/Users/sagar/Music/new talking anims ch1-3/ch1 take 2';
const SRC_IDLE = arg('idle', `${SRCDIR}/Sitting Idle (3).glb`);
const SRC_TALK = arg('talking', `${SRCDIR}/Sitting Talking (1).glb`);
const TEXDIR = arg('textures', 'C:/Users/sagar/Downloads/Realisticgirl_Fbx/Business girl.fbm');
const OUT_GLB = 'public/models/ch1-journalist.glb';
const CCRIG_BACKUP = 'C:/Users/sagar/Music/new talking anims ch1-3/ch1-journalist.CCrig-backup.glb';
/** clip names the asset registry looks for (ASSETS['ch1.character'].clips) */
const IDLE_CLIP = 'Idle_Loop';
const TALK_CLIP = 'Idle_Talking_Loop';

/* This talking take was animated with the head turned well off to her own
 * right: `node scripts/inspect-pose.mjs` (after the root-frame fix below —
 * that's what makes these numbers meaningful) measured idle gaze yaw at
 * +1.7° and this clip at -39.3° (idle - talking ~= 41). Set to 0 for a
 * talking take that already faces the same way as the idle. */
const TALK_YAW_FIX = 41;
const YAW_BONES = ['mixamorig:Neck', 'mixamorig:Head'];
/* Seconds of the talking clip's tail spent easing back onto its first frame,
 * so the loop restarts without a visible snap (see scripts/lib/clip-fixes.mjs). */
const TALK_LOOP_BLEND = 0.6;

/** the one real clip in each source file; everything else is a 1-frame stub */
const isPoseClip = (a) => a.listChannels().length > 1 && clipDuration(a) > 0.5;
const clipDuration = (a) =>
  Math.max(0, ...a.listSamplers().map((s) => s.getInput()?.getMax([])[0] ?? 0));

/* ------------------------------------------------------------------ *
 * Per-material recipe. Key = material name prefix (longest match wins).
 * size = max diffuse edge; normal = max normal-map edge (omit = drop);
 * alpha: 'mask' | 'blend' uses the _Opacity map (or the diffuse PNG's own
 * alpha); 'invisible' renders nothing (tearline/occlusion shells would
 * otherwise draw as black film over the eyes). Unchanged from the CC-rig
 * build — only the mesh/primitive -> material NAME assignment below is new.
 * ------------------------------------------------------------------ */
const RECIPES = [
  { m: 'Std_Skin_Head', size: 2048, normal: 1024, rough: 0.55 },
  { m: 'Std_Skin_Body', size: 1024, rough: 0.55 },
  { m: 'Std_Skin_Arm', size: 1024, rough: 0.55 },
  { m: 'Std_Skin_Leg', size: 512, rough: 0.55 },
  { m: 'Std_Nails', size: 256, rough: 0.4 },
  { m: 'Std_Eye_Occlusion', alpha: 'invisible' },
  { m: 'Std_Tearline', alpha: 'invisible' },
  { m: 'Std_Tongue', size: 256, rough: 0.4 },
  { m: 'Std_Cornea', size: 512, rough: 0.12 },
  { m: 'Std_Eye', size: 512, rough: 0.12 },
  { m: 'Std_Upper_Teeth', size: 256, rough: 0.3 },
  { m: 'Std_Lower_Teeth', size: 256, rough: 0.3 },
  { m: 'Std_Eyelash', size: 512, alpha: 'mask', cutoff: 0.4, rough: 0.7 },
  { m: 'Hair_T_Transparency', size: 512, alpha: 'mask', cutoff: 0.35, rough: 0.62 },
  { m: 'Hair_B_Transparency', size: 512, alpha: 'mask', cutoff: 0.35, rough: 0.62 },
  { m: 'Hair_Transparency', size: 1024, alpha: 'mask', cutoff: 0.35, rough: 0.62 },
  { m: 'Scalp_Transparency', size: 512, alpha: 'mask', cutoff: 0.35, rough: 0.62 },
  { m: 'Flower', size: 256, alpha: 'mask', cutoff: 0.5, rough: 0.6 },
  { m: 'Pearl', size: 256, rough: 0.25 },
  { m: 'Butterfly', size: 256, alpha: 'mask', cutoff: 0.5, rough: 0.6 },
  // "Female_Angled" is the two-layer brow set (base mass + strand clumps)
  { m: 'Female_Angled', size: 512, alpha: 'blend', rough: 0.6 },
  { m: 'Business_Suit', size: 1024, normal: 1024, rough: 0.85 },
  { m: 'Close_collar_short_sleeves_shirt', size: 512, rough: 0.85 },
  { m: 'Pencil_skirt', size: 512, rough: 0.85 },
  { m: 'High_Heels', size: 256, rough: 0.5 },
];
const recipeFor = (name) =>
  RECIPES.filter((r) => name.startsWith(r.m)).sort((a, b) => b.m.length - a.m.length)[0];

/**
 * New-mesh (obj1..obj18) primitive index -> old-model material stem, in
 * primitive order. Derived by comparing every primitive's triangle count, UV
 * bbox and normalized position bbox against the CCrig-backup.glb reference
 * (the old build's primitives, which still hold correct material names) —
 * dump each file's per-primitive {mesh, tris, posBBox, uvBBox} with
 * gltf-transform's NodeIO/Accessor APIs (getElement, not getArray — these
 * files' accessors are int-quantized) to reproduce the comparison. Confidence
 * notes inline; every entry matched on an exact or near-exact (±a few tris,
 * from a different weld pass) triangle count AND a consistent position bbox.
 */
const MESH_MATERIAL_MAP = {
  // 3 barrette clusters (obj1, obj7, obj16) are geometrically identical in
  // triangle count (816 / 10320 / 1968 = Flower / Pearl / Butterfly) to
  // THREE separate old meshes (Jewelry_Barrette_02.004, _02_0.001, _02_1.001)
  // that differ only in position. Which specific old mesh each corresponds
  // to doesn't matter for texturing — same three materials either way.
  obj1: ['Flower', 'Pearl', 'Butterfly'], // exact tri match (816/10320/1968)
  obj2: ['Hair_Transparency'], // exact tri match (32096) -> Straight_long_low
  obj3: ['Pearl', 'Flower'], // exact tri match (640/204) -> Jewelry_Barrette_01
  obj4: ['Business_Suit'], // exact tri match (4431)
  obj5: ['Std_Tongue'], // exact tri match (592)
  // CC_Base_Eye: 4 prims, all 320 tris, two near-duplicate shells per side
  // (sclera+cornea style double geometry) — the OLD reference model names
  // BOTH shells per side the same ("Std_Eye_R.002" x2, "Std_Eye_L.002" x2,
  // confirmed dedup'd from an originally separate Std_Cornea in the RECIPES
  // table, which is now otherwise unused for ch1). Side picked by position:
  // lower x (0.47-0.49 normalized) = R, higher x (0.51-0.53) = L, matching
  // the old model's own low-x=R/high-x=L convention.
  obj6: ['Std_Eye_R', 'Std_Eye_R', 'Std_Eye_L', 'Std_Eye_L'], // exact tri match (320 x4)
  obj7: ['Flower', 'Pearl', 'Butterfly'], // exact tri match (816/10320/1968)
  obj8: ['Close_collar_short_sleeves_shirt'], // exact tri match (4513)
  obj9: ['Female_Angled_Transparency', 'Female_Angled_Base_Transparency'], // exact tri match (912/168)
  obj10: ['Std_Upper_Teeth', 'Std_Lower_Teeth'], // exact tri match (2362/2480)
  // CC_Base_EyeOcclusion: 144 tris/prim in both old and new -> invisible shell
  obj11: ['Std_Eye_Occlusion_R', 'Std_Eye_Occlusion_L'],
  obj12: ['Hair_Transparency', 'Scalp_Transparency'], // exact/near tri match (17187~17188 / 1284) -> Twist_Half_Up
  obj13: ['High_Heels'], // exact tri match (1752)
  // CC_Base_TearLine: 136 tris/prim in both old and new -> invisible shell
  // (distinct from EyeOcclusion's 144 tris — no ambiguity between the two)
  obj14: ['Std_Tearline_R', 'Std_Tearline_L'],
  obj15: ['Hair_T_Transparency', 'Hair_B_Transparency'], // exact tri match (2204/1202) -> Chunky_Highlights_Bangs
  obj16: ['Flower', 'Pearl', 'Butterfly'], // exact tri match (816/10320/1968)
  obj17: ['Pencil_skirt'], // exact tri match (4146)
  // CC_Base_Body: 6 prims, same order in both old and new (near-exact tri
  // matches: 8316/3892/8366~8368/4518~4528/1784~1788/1200)
  obj18: ['Std_Skin_Head', 'Std_Skin_Body', 'Std_Skin_Arm', 'Std_Skin_Leg', 'Std_Nails', 'Std_Eyelash'],
};

/** "Hair_Transparency.001" -> { stem: "Hair_Transparency", suffix: "_0001" } */
function parseName(matName) {
  const noB = matName.replace(/_B\d+$/, '');
  const v = noB.match(/^(.*)\.(\d{3})$/);
  return v ? { stem: v[1], suffix: `_0${v[2]}` } : { stem: noB, suffix: '' };
}
function findTex(stem, suffix, kind) {
  for (const suf of suffix ? [suffix, ''] : ['']) {
    for (const ext of ['jpg', 'png', 'jpeg']) {
      const p = path.join(TEXDIR, `${stem}_${kind}${suf}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** True when an opacity map is uniformly white (fully opaque -> ignore it). */
async function isUniformWhite(file) {
  const { channels } = await sharp(file).stats();
  return channels.every((c) => c.min >= 250);
}

const texCache = new Map();
async function buildTexture(doc, key, build) {
  if (texCache.has(key)) return texCache.get(key);
  const { data, mime } = await build();
  const tex = doc.createTexture(key).setImage(data).setMimeType(mime);
  texCache.set(key, tex);
  return tex;
}

/**
 * Rebuilds `srcAnim` (living in a possibly different document) inside `doc`,
 * re-pointing every channel at the same-named node there. Idle and talking
 * share one rig with identical node names (mixamorig:* bones AND obj1..obj18
 * mesh nodes match by name on both sides, colons and all) — no normalization
 * needed, but coverage is still asserted rather than trusted.
 */
function copyAnimationInto(doc, srcAnim, name) {
  const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0];
  const anim = doc.createAnimation(name);
  const samplers = new Map();
  let copied = 0;
  const missing = new Set();

  for (const ch of srcAnim.listChannels()) {
    if (ch.getTargetPath() === 'weights') continue;
    const target = byName.get(ch.getTargetNode()?.getName());
    if (!target) {
      missing.add(ch.getTargetNode()?.getName());
      continue;
    }
    const srcSampler = ch.getSampler();
    let sampler = samplers.get(srcSampler);
    if (!sampler) {
      const cloneAccessor = (acc) =>
        doc
          .createAccessor()
          .setArray(acc.getArray().slice())
          .setType(acc.getType())
          .setNormalized(acc.getNormalized())
          .setBuffer(buffer);
      sampler = doc
        .createAnimationSampler()
        .setInput(cloneAccessor(srcSampler.getInput()))
        .setOutput(cloneAccessor(srcSampler.getOutput()))
        .setInterpolation(srcSampler.getInterpolation());
      anim.addSampler(sampler);
      samplers.set(srcSampler, sampler);
    }
    anim.addChannel(
      doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler),
    );
    copied++;
  }
  if (missing.size) throw new Error(`rig mismatch — no node named: ${[...missing].join(', ')}`);
  console.log(`clip "${name}": ${copied} channels, ${clipDuration(anim).toFixed(2)}s`);
  return anim;
}

async function main() {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  /* -- 0. back up the CC-rig build: the only material-name reference and
   *      rollback, before this script ever touches the output path. Only
   *      ever done ONCE — this script's own output must never overwrite the
   *      backup on a second run. ------------------------------------------ */
  if (!fs.existsSync(CCRIG_BACKUP) && fs.existsSync(OUT_GLB)) {
    fs.mkdirSync(path.dirname(CCRIG_BACKUP), { recursive: true });
    fs.copyFileSync(OUT_GLB, CCRIG_BACKUP);
    console.log(`backed up current ${OUT_GLB} -> ${CCRIG_BACKUP}`);
  }

  const doc = await io.read(SRC_IDLE);
  const root = doc.getRoot();
  doc.createExtension(EXTTextureWebP).setRequired(true);

  /* -- 1. one model, both clips --------------------------------------- */
  const talkDoc = await io.read(SRC_TALK);
  const srcIdle = root.listAnimations().find(isPoseClip);
  const srcTalk = talkDoc.getRoot().listAnimations().find(isPoseClip);
  if (!srcIdle) throw new Error(`no animated clip in ${SRC_IDLE}`);
  if (!srcTalk) throw new Error(`no animated clip in ${SRC_TALK}`);
  for (const a of root.listAnimations()) if (a !== srcIdle) a.dispose(); // 1-frame stubs
  srcIdle.setName(IDLE_CLIP);
  for (const ch of srcIdle.listChannels()) if (ch.getTargetPath() === 'weights') ch.dispose();
  console.log(`clip "${IDLE_CLIP}": ${srcIdle.listChannels().length} channels, ${clipDuration(srcIdle).toFixed(2)}s`);
  const talkAnim = copyAnimationInto(doc, srcTalk, TALK_CLIP);

  /* -- 2a. this talking export's whole rig sits under an explicit
   *      "Armature" root node that idle's export doesn't have: idle's
   *      converter baked that same correction into every bone instead of
   *      leaving it as a root transform, so its scene root is identity.
   *      Two distinct corrections fall out of that, confirmed against
   *      idle's own rest-pose values (not assumed):
   *
   *      (a) UNITS — this whole rig is authored in centimetres (Armature's
   *      0.01 scale converts it to metres only inside its own document).
   *      Mixamo bakes a translation key on every bone every frame, and
   *      idle's are meter-scale (e.g. rest mixamorig:Spine translation.y =
   *      0.0860); talking's raw Spine translation.y = 8.6041 — exactly
   *      100x. Left uncorrected, copying these onto idle's meter-scale
   *      hierarchy compounds a 100x-too-long bone at every level of the
   *      chain (measured: the talking clip's head landed 46m in the air).
   *      So every translation channel's VALUES are scaled by Armature's
   *      0.01, not just Hips's.
   *
   *      (b) ROOT ORIENTATION — mixamorig:Hips is the only bone parented
   *      directly to Armature, so it alone also inherits Armature's
   *      rotation once retargeted onto idle's un-rotated hierarchy; every
   *      other bone's channel is relative to its own parent BONE, so (a) is
   *      the only fix it needs. Confirmed: idle's rest Hips translation is
   *      (0.0000165, 1.09346, -0.02837); talking's raw Hips local
   *      (0.00165, -2.837, -109.346), scaled by 0.01 and rotated by
   *      Armature's rotation, lands on (0.0000165, 1.09346, -0.02837) — an
   *      exact match. ------------------------------------------------- */
  const armatureNode = talkDoc.getRoot().listScenes()[0].listChildren()[0];
  const armRot = new Quaternion(...armatureNode.getRotation());
  const armScale = armatureNode.getScale()[0];
  if (armScale !== 1) {
    let scaled = 0;
    for (const ch of talkAnim.listChannels()) {
      if (ch.getTargetPath() !== 'translation') continue;
      const out = ch.getSampler().getOutput();
      const el = [0, 0, 0];
      for (let i = 0; i < out.getCount(); i++) {
        out.getElement(i, el);
        out.setElement(i, el.map((v) => v * armScale));
      }
      scaled++;
    }
    console.log(`talking clip: scaled ${scaled} translation channel(s) by ${armScale} (rig authored in cm)`);
  }
  if (armRot.w !== 1 || armRot.x || armRot.y || armRot.z) {
    const hips = root.listNodes().find((n) => n.getName() === 'mixamorig:Hips');
    let fixed = 0;
    for (const ch of talkAnim.listChannels()) {
      if (ch.getTargetNode() !== hips) continue;
      const p = ch.getTargetPath();
      if (p !== 'rotation' && p !== 'translation') continue;
      const out = ch.getSampler().getOutput();
      const el = p === 'rotation' ? [0, 0, 0, 1] : [0, 0, 0];
      for (let i = 0; i < out.getCount(); i++) {
        out.getElement(i, el);
        if (p === 'translation') {
          const v = new Vector3(...el).applyQuaternion(armRot); // already scaled above
          out.setElement(i, [v.x, v.y, v.z]);
        } else {
          const q = armRot.clone().multiply(new Quaternion(...el));
          out.setElement(i, [q.x, q.y, q.z, q.w]);
        }
      }
      fixed++;
    }
    console.log(
      `Hips: applied talking export's root axis rotation (${armRot.x.toFixed(3)},${armRot.y.toFixed(3)},${armRot.z.toFixed(3)},${armRot.w.toFixed(3)}) across ${fixed} channel(s) (idle's root is identity, this one wasn't)`,
    );
  }

  if (TALK_YAW_FIX) yawClip(talkAnim, doc, YAW_BONES, TALK_YAW_FIX);
  if (TALK_LOOP_BLEND) closeLoop(talkAnim, TALK_LOOP_BLEND);

  /* -- 2b. idle frame 0 becomes the rest pose (no more T-pose fallback) */
  bakeRestPoseFromClip(srcIdle);

  /* -- 2c. report the seated head position, for the registry's scale/offset */
  const headNode = root.listNodes().find((n) => n.getName() === 'mixamorig:Head');
  if (headNode) {
    const m = headNode.getWorldMatrix();
    console.log(`seated head bone (rig units): x ${m[12].toFixed(3)}, y ${m[13].toFixed(3)}, z ${m[14].toFixed(3)}`);
  }

  /* -- 3. drop morph targets and unused vertex attributes -------------- */
  let morphs = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const t of prim.listTargets()) {
        prim.removeTarget(t);
        t.dispose();
        morphs++;
      }
    }
    mesh.setWeights([]);
  }
  for (const node of root.listNodes()) node.setWeights([]);
  if (morphs) console.log(`dropped ${morphs} morph targets`);

  const dropped = new Set();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics())
        if (sem === 'TANGENT' || sem.startsWith('COLOR_') || sem === 'TEXCOORD_1') {
          const acc = prim.getAttribute(sem);
          prim.setAttribute(sem, null);
          acc?.dispose();
          dropped.add(sem);
        }
  if (dropped.size) console.log('dropped attributes:', [...dropped].join(', '));

  /* -- 4. rename anonymous materials to their matched old-model names -- */
  console.log('\n-- material mapping (new mesh/prim -> old name) --');
  const unmapped = [];
  for (const mesh of root.listMeshes()) {
    const names = MESH_MATERIAL_MAP[mesh.getName()];
    mesh.listPrimitives().forEach((prim, i) => {
      const mat = prim.getMaterial();
      const newName = names?.[i];
      if (!newName) {
        unmapped.push(`${mesh.getName()}[${i}] (mat "${mat?.getName()}")`);
        return;
      }
      console.log(`  ${mesh.getName()}[${i}] "${mat.getName()}" -> "${newName}"`);
      mat.setName(newName);
    });
  }
  if (unmapped.length) throw new Error(`unmapped primitives: ${unmapped.join(', ')}`);

  /* -- 5. bake textures per material ---------------------------------- */
  for (const ext of root.listExtensionsUsed())
    if (ext.extensionName === 'KHR_materials_specular') ext.dispose();
  for (const mat of root.listMaterials()) {
    const name = mat.getName();
    const r = recipeFor(name) ?? { size: 512, rough: 0.7 };
    mat.setMetallicFactor(0).setRoughnessFactor(r.rough ?? 0.7);

    if (r.alpha === 'invisible') {
      mat.setAlphaMode('BLEND').setBaseColorFactor([0, 0, 0, 0]);
      console.log(`${name}: invisible`);
      continue;
    }
    mat.setBaseColorFactor([1, 1, 1, 1]);

    const { stem, suffix } = parseName(name);
    const diffuse = findTex(stem, suffix, 'Diffuse');
    if (!diffuse) {
      console.warn(`!! no diffuse for material "${name}" (stem "${stem}")`);
      continue;
    }
    const opacity = findTex(stem, suffix, 'Opacity');
    const useOpacity = r.alpha && opacity && !(await isUniformWhite(opacity));
    const diffuseHasAlpha = (await sharp(diffuse).metadata()).hasAlpha === true;

    const hasAlpha = !!r.alpha && (useOpacity || diffuseHasAlpha);

    const key = `${path.basename(diffuse)}|${useOpacity ? path.basename(opacity) : 'noop'}|${r.size}`;
    const tex = await buildTexture(doc, key, async () => {
      let stage1 = sharp(diffuse)
        .resize(r.size, r.size, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha();
      if (r.flipV) stage1 = stage1.flip();
      const rgb = await stage1.png().toBuffer();
      const { width, height } = await sharp(rgb).metadata();
      let img = sharp(rgb);
      if (hasAlpha) {
        let a = diffuseHasAlpha
          ? await sharp(await sharp(diffuse).resize(width, height, { fit: 'fill' }).png().toBuffer())
              .extractChannel(3).png().toBuffer()
          : null;
        if (useOpacity) {
          const op = await sharp(opacity)
            .resize(width, height, { fit: 'fill' })
            .grayscale().extractChannel(0).png().toBuffer();
          a = a
            ? await sharp(a).composite([{ input: op, blend: 'multiply' }]).png().toBuffer()
            : op;
        }
        const a1 = await sharp(a).extractChannel(0).png().toBuffer();
        img = sharp(rgb).joinChannel(a1);
      }
      const data = await img.webp({ quality: 82, alphaQuality: 90 }).toBuffer();
      return { data, mime: 'image/webp' };
    });
    mat.setBaseColorTexture(tex);
    mat.getBaseColorTextureInfo()?.setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR).setTexCoord(0);

    if (hasAlpha && r.alpha === 'mask') {
      mat.setAlphaMode('MASK').setAlphaCutoff(r.cutoff ?? 0.4).setDoubleSided(true);
    } else if (hasAlpha && r.alpha === 'blend') {
      mat.setAlphaMode('BLEND').setDoubleSided(true);
    } else {
      mat.setAlphaMode('OPAQUE');
    }

    if (r.normal) {
      const normal = findTex(stem, suffix, 'Normal');
      if (normal) {
        const ntex = await buildTexture(doc, `${path.basename(normal)}|n${r.normal}`, async () => {
          const data = await sharp(normal)
            .resize(r.normal, r.normal, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer();
          return { data, mime: 'image/webp' };
        });
        mat.setNormalTexture(ntex);
        mat.getNormalTextureInfo()?.setTexCoord(0);
      }
    }
    console.log(
      `${name}: ${path.basename(diffuse)}${useOpacity ? ' +opacity' : ''}${r.normal ? ' +normal' : ''} -> ${mat.getAlphaMode()}`,
    );
  }

  /* -- 6. shrink: weld duplicated verts, resample anims, compress ----- */
  const vertsBefore = root
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((s, p) => s + (p.getAttribute('POSITION')?.getCount() ?? 0), 0);
  await doc.transform(dedup(), weld(), resample(), prune());
  const vertsAfter = root
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((s, p) => s + (p.getAttribute('POSITION')?.getCount() ?? 0), 0);
  console.log(`verts ${vertsBefore} -> ${vertsAfter}`);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  fs.mkdirSync(path.dirname(OUT_GLB), { recursive: true });
  await io.write(OUT_GLB, doc);
  console.log(`${OUT_GLB}: ${(fs.statSync(OUT_GLB).size / 1e6).toFixed(1)} MB`);
  console.log('clips shipped:', root.listAnimations().map((a) => `${a.getName()} (${clipDuration(a).toFixed(2)}s)`).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
