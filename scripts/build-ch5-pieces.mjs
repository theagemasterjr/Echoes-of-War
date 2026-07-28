/**
 * Bakes the founder-supplied Chapter 5 minigame assets into web-ready files.
 *
 * Input (defaults to ~/Downloads; override with --from):
 *   - nine .glb props, named as the founders downloaded them (see FILES below)
 *   - one map image (--map), the southern-England / Channel / northern-France
 *     board
 *
 * Output:
 *   - public/models/ch5-*.glb   (textures shrunk to webp, welded, meshopt)
 *   - public/img/ch5-map.png    (re-encoded, SAME pixel dimensions)
 *
 * The map keeps its exact dimensions on purpose: the minigame's drop zones and
 * markers are positioned against fixed points on this image, so a resize would
 * move every one of them. Only the encoding changes.
 *
 * Each model is measured after compression and its standing height printed —
 * those numbers are what the `scale` values in src/assets/registry.tsx are set
 * from, so every piece reads at a similar size on the table.
 *
 * Run:  npm run build:ch5-pieces
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
const MAP_SRC = arg('map', `${HOME}/Downloads/ChatGPT Image Jul 27, 2026, 04_58_18 PM.png`);
const OUT_MODELS = 'public/models';
const OUT_MAP = 'public/img/ch5-map.png';

/** downloaded name → the name the asset registry asks for. */
const FILES = [
  ['inflatable_tank.glb', 'ch5-piece-inflatable-tank.glb'],
  ['decoy_landing_craft.glb', 'ch5-piece-dummy-landing-craft.glb'],
  ['hq_signpost.glb', 'ch5-piece-fake-hq-sign.glb'],
  ['radio_truck.glb', 'ch5-piece-radio-truck.glb'],
  ['camo_net_canopy.glb', 'ch5-piece-camouflage-netting.glb'],
  ['camp_gate.glb', 'ch5-piece-sealed-camp-gate.glb'],
  ['postal_sack.glb', 'ch5-piece-mail-sack.glb'],
  ['blackout_dock_lamp.glb', 'ch5-piece-blackout-screen.glb'],
  ['command_marker_pin.glb', 'ch5-pin-german-command.glb'],
];

/** Largest texture edge to keep. These are thumb-sized props on a table. */
const TEX = 1024;
/** How tall every piece should stand on the table, in table units. */
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
    // the height the piece will stand once scaled to ~0.78 units, the size the
    // chapter 2 and chapter 4 pieces read at on the same table
    const tall = Math.max(b.size[0], b.size[1], b.size[2]);
    const scale = TARGET_H / (b.size[1] || tall);
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

  if (fs.existsSync(MAP_SRC)) {
    fs.mkdirSync(path.dirname(OUT_MAP), { recursive: true });
    const meta = await sharp(MAP_SRC).metadata();
    // no resize, no crop — the board's coordinates are read off these pixels
    await sharp(MAP_SRC).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(OUT_MAP);
    console.log(
      `\n${OUT_MAP}: ${meta.width} × ${meta.height} (unchanged), ${(fs.statSync(OUT_MAP).size / 1e6).toFixed(2)} MB`,
    );
  } else {
    missing.push(path.basename(MAP_SRC));
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
