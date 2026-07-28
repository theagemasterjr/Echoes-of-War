/**
 * Bakes the founder-supplied Chapter 6 minigame assets into web-ready files.
 *
 * Input (defaults to ~/Downloads; override with --from):
 *   - six .glb props, named as the founders downloaded them (see FILES below):
 *     the four "voices" pieces, the paper crane, and the paper slip.
 *
 * Output:
 *   - public/models/ch6-piece-*.glb  (textures shrunk to webp, welded, meshopt)
 *
 * Each model is measured after compression and its bounds printed — those
 * numbers are what the `scale` values in src/assets/registry.tsx are set from,
 * so every piece reads at a similar size on the table. (Same pipeline as
 * scripts/build-ch5-pieces.mjs, minus the map image — this board is the bare
 * war table.)
 *
 * Run:  npm run build:ch6-pieces
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, resample, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const HOME = process.env.HOME;
const FROM = arg('from', `${HOME}/Downloads`);
const OUT_MODELS = 'public/models';

/** downloaded name → the name the asset registry asks for. */
const FILES = [
  ['helmet-field-pack.glb', 'ch6-piece-helmet-pack.glb'],
  ['paper-lantern.glb', 'ch6-piece-lantern.glb'],
  ['slide-rule-papers.glb', 'ch6-piece-slide-rule.glb'],
  ['fountain-pen-document.glb', 'ch6-piece-pen-document.glb'],
  ['origami-crane.glb', 'ch6-piece-crane.glb'],
  ['statement-slip.glb', 'ch6-piece-slip.glb'],
];

/** Largest texture edge to keep. These are thumb-sized props on a table. */
const TEX = 1024;
/** How tall the four voice pieces should stand, in table units. */
const TARGET_H = 0.78;

/** m (4×4, column-major) × point. */
function apply(m, [x, y, z]) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

/**
 * The box the model actually occupies once its node transforms are applied —
 * exporters routinely park the geometry under a scaled or rotated node, so the
 * raw accessor bounds can be nothing like what ends up on the table.
 */
function boundsOf(doc) {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];

  const visit = (node, parent) => {
    const world = mulMat(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const acc = prim.getAttribute('POSITION');
        if (!acc) continue;
        const lo = acc.getMin([]);
        const hi = acc.getMax([]);
        // all eight corners, so a rotated node is measured honestly
        for (let c = 0; c < 8; c++) {
          const p = apply(world, [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]]);
          for (let k = 0; k < 3; k++) {
            mn[k] = Math.min(mn[k], p[k]);
            mx[k] = Math.max(mx[k], p[k]);
          }
        }
      }
    }
    for (const child of node.listChildren()) visit(child, world);
  };

  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) visit(n, I);
  return { mn, mx, size: mx.map((v, k) => v - mn[k]) };
}

/** a × b, both column-major 4×4. */
function mulMat(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  fs.mkdirSync(OUT_MODELS, { recursive: true });
  const missing = [];
  const rows = [];

  for (const [src, out] of FILES) {
    const from = path.join(FROM, src);
    if (!fs.existsSync(from)) {
      missing.push(src);
      continue;
    }
    const doc = await io.read(from);
    await doc.transform(
      dedup(),
      weld(),
      resample(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] }),
    );
    // measured BEFORE meshopt: that step quantises positions into integer range,
    // after which the accessor bounds no longer describe the model
    const b = boundsOf(doc);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const to = path.join(OUT_MODELS, out);
    await io.write(to, doc);
    const scale = TARGET_H / (b.size[1] || Math.max(...b.size));
    rows.push({
      out,
      mb: (fs.statSync(to).size / 1e6).toFixed(2),
      size: b.size.map((v) => v.toFixed(3)).join(' × '),
      scale: scale.toFixed(2),
      // lifts the model so its lowest point rests exactly on the table
      liftY: (-b.mn[1] * scale).toFixed(3),
    });
  }

  console.log(`\nRegistry values for a piece standing ${TARGET_H} units tall:\n`);
  console.log('model                                 MB   bounds (x × y × z)       scale   offset Y');
  for (const r of rows) {
    console.log(
      `${r.out.padEnd(36)}${r.mb.padStart(6)}   ${r.size.padEnd(23)}${r.scale.padStart(7)}${r.liftY.padStart(10)}`,
    );
  }

  if (missing.length) {
    console.warn(`\n!! not found in ${FROM}:\n   ${missing.join('\n   ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
