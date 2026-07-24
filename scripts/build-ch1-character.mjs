/**
 * Bakes the founder-exported Ch1 journalist model into a web-ready GLB.
 *
 * Input (defaults; override with --src / --textures / --bg):
 *   - GLB exported from the animation tool: geometry + skeleton + two clips
 *     ("Spell_Simple_Idle_Loop" = idle, "Idle_Talking_Loop" = talking),
 *     but NO textures and the skeleton left outside the scene graph.
 *   - Character Creator ".fbm" folder with the texture files (…_Diffuse/
 *     _Normal/_Opacity). Material names in the GLB match the file stems.
 *   - Background still for the conversation stage.
 *
 * Output:
 *   - public/models/ch1-journalist.glb   (textures baked, welded, meshopt)
 *   - public/img/ch1-studio.jpg          (resized conversation backdrop)
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
const SRC = arg('src', `${HOME}/Downloads/exported-model (2).glb (use this).glb`);
const TEXDIR = arg('textures', `${HOME}/Downloads/Realisticgirl_Fbx/Business girl.fbm (use this)`);
const BG = arg('bg', `${HOME}/Downloads/ChatGPT Image Jul 24, 2026, 05_11_16 PM.png`);
const OUT_GLB = 'public/models/ch1-journalist.glb';
const OUT_BG = 'public/img/ch1-studio.jpg';

/* ------------------------------------------------------------------ *
 * Per-material recipe. Key = material name prefix (longest match wins).
 * size = max diffuse edge; normal = max normal-map edge (omit = drop);
 * alpha: 'mask' | 'blend' uses the _Opacity map (or the diffuse PNG's own
 * alpha); 'invisible' renders nothing (tearline/occlusion shells would
 * otherwise draw as black film over the eyes).
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

async function main() {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  const doc = await io.read(SRC);
  const root = doc.getRoot();
  doc.createExtension(EXTTextureWebP).setRequired(true);

  /* -- 1. attach the orphaned skeleton to the scene ------------------- */
  const scene = root.listScenes()[0];
  const inScene = new Set(scene.listChildren());
  const skeletonRoots = root
    .listNodes()
    .filter((n) => !inScene.has(n) && n.getParentNode() === null && n.listChildren().length > 0);
  for (const n of skeletonRoots) {
    scene.addChild(n);
    console.log(`attached skeleton root "${n.getName()}" to scene`);
  }

  /* -- 2. drop unused vertex attributes (tangents/colors bloat) ------- */
  const dropped = new Set();
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics())
        if (sem === 'TANGENT' || sem.startsWith('COLOR_')) {
          const acc = prim.getAttribute(sem);
          prim.setAttribute(sem, null);
          acc?.dispose();
          dropped.add(sem);
        }
  if (dropped.size) console.log('dropped attributes:', [...dropped].join(', '));

  /* -- 3. bake textures per material ---------------------------------- */
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
      const rgb = await sharp(diffuse)
        .resize(r.size, r.size, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha().png().toBuffer();
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
    mat.getBaseColorTextureInfo()?.setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR);

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

  /* -- 5. conversation backdrop --------------------------------------- */
  fs.mkdirSync(path.dirname(OUT_BG), { recursive: true });
  await sharp(BG).resize(1920, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(OUT_BG);
  console.log(`${OUT_BG}: ${(fs.statSync(OUT_BG).size / 1e6).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
