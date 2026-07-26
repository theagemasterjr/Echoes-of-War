/**
 * Bakes the founder-exported Ch1 journalist model into a web-ready GLB.
 *
 * Input (defaults; override with --idle / --talking / --textures):
 *   - TWO GLBs of the SAME character exported from the animation tool, each
 *     carrying one clip: an idle loop and a talking loop. They share geometry,
 *     skeleton and node names; only the clip differs. Neither has textures,
 *     and both drag along ~1800 unused morph targets (most of the file size).
 *   - Character Creator ".fbm" folder with the texture files (…_Diffuse/
 *     _Normal/_Opacity). Material names in the GLB match the file stems.
 *
 * Output:
 *   - public/models/ch1-journalist.glb   (one model, both clips, textures
 *     baked, morphs stripped, welded, meshopt)
 *
 * The conversation backdrop is NOT this script's job — `scripts/set-backdrop.mjs`
 * owns that file. (It used to be built here too, which quietly overwrote a
 * newer backdrop every time the model was rebuilt.)
 *
 * Run:  node scripts/build-ch1-character.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, weld, resample, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const HOME = process.env.HOME;
const ANIMDIR = `${HOME}/Downloads/ImageToStl.com_e5bc7ded7a13447da844fa55950c34f3`;
const SRC_IDLE = arg('idle', `${ANIMDIR}/Idle.glb`);
const SRC_TALK = arg('talking', `${ANIMDIR}/Talking.glb`);
const TEXDIR = arg('textures', `${HOME}/Downloads/Realisticgirl_Fbx/Business girl.fbm (use this)`);
const OUT_GLB = 'public/models/ch1-journalist.glb';
/** clip names the asset registry looks for (ASSETS['ch1.character'].clips) */
const IDLE_CLIP = 'Idle_Loop';
const TALK_CLIP = 'Idle_Talking_Loop';
/** the one real clip in each source file; everything else is a 1-frame stub */
const isPoseClip = (a) => a.listChannels().length > 1 && clipDuration(a) > 0.5;
const clipDuration = (a) =>
  Math.max(0, ...a.listSamplers().map((s) => s.getInput()?.getMax([])[0] ?? 0));

/* ------------------------------------------------------------------ *
 * Per-material recipe. Key = material name prefix (longest match wins).
 * size = max diffuse edge; normal = max normal-map edge (omit = drop);
 * alpha: 'mask' | 'blend' uses the _Opacity map (or the diffuse PNG's own
 * alpha); 'invisible' renders nothing (tearline/occlusion shells would
 * otherwise draw as black film over the eyes).
 * ------------------------------------------------------------------ */
const RECIPES = [
  // head UVs come out the right way up from this exporter (the earlier one
  // V-flipped them and needed `flipV: true` here — check the mouth if you
  // re-export: a flip mismatch smears the lips down onto the chin)
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
 * Rebuilds `srcAnim` inside `doc`, re-pointing every channel at the same-named
 * node there. The two exports share one rig, so matching on name is exact —
 * we assert full coverage rather than trusting it.
 */
function copyAnimationInto(doc, srcAnim, name) {
  const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0];
  const anim = doc.createAnimation(name);
  const samplers = new Map();
  let copied = 0;
  const missing = new Set();

  for (const ch of srcAnim.listChannels()) {
    // morph-target tracks are dead weight here — the targets get stripped below
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

  const doc = await io.read(SRC_IDLE);
  const root = doc.getRoot();
  doc.createExtension(EXTTextureWebP).setRequired(true);

  /* -- 1. one model, both clips --------------------------------------- */
  // The idle export is the base; the talking export contributes only its clip.
  const talkDoc = await io.read(SRC_TALK);
  const srcIdle = root.listAnimations().find(isPoseClip);
  const srcTalk = talkDoc.getRoot().listAnimations().find(isPoseClip);
  if (!srcIdle) throw new Error(`no animated clip in ${SRC_IDLE}`);
  if (!srcTalk) throw new Error(`no animated clip in ${SRC_TALK}`);
  for (const a of root.listAnimations()) if (a !== srcIdle) a.dispose(); // 1-frame stubs
  srcIdle.setName(IDLE_CLIP); // already in this document — just rename it
  for (const ch of srcIdle.listChannels()) if (ch.getTargetPath() === 'weights') ch.dispose();
  console.log(`clip "${IDLE_CLIP}": ${srcIdle.listChannels().length} channels, ${clipDuration(srcIdle).toFixed(2)}s`);
  copyAnimationInto(doc, srcTalk, TALK_CLIP);

  /* -- 2. drop morph targets and unused vertex attributes -------------- */
  // ~1800 shape keys ride along from Character Creator, driven by nothing but
  // 1-frame stub clips — they are the bulk of the 53 MB source files.
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

  /* -- 3. bake textures per material ---------------------------------- */
  // the exporter writes a KHR_materials_specular block we fully override below
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

    // alpha = the diffuse PNG's own alpha × the _Opacity map (either may be
    // missing). Replacing one with the other exposes the PNG's undefined RGB
    // under transparent pixels (usually black) — e.g. brows became black slabs.
    const hasAlpha = !!r.alpha && (useOpacity || diffuseHasAlpha);

    const key = `${path.basename(diffuse)}|${useOpacity ? path.basename(opacity) : 'noop'}|${r.size}`;
    const tex = await buildTexture(doc, key, async () => {
      // sharp applies ops in libvips' fixed internal order, not call order —
      // removeAlpha would strip a freshly joined channel. So: one pipeline per
      // stage, buffers in between.
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

  /* -- 4. shrink: weld duplicated verts, resample anims, compress ----- */
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
