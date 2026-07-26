/**
 * Swaps the still image behind a chapter's conversation.
 *
 * The character stands in a 3D stage with this photo behind her, so it only
 * ever needs to be wide — it is resized to 1920px and saved as a jpg the
 * browser can pull in one go.
 *
 * Run:  node scripts/set-backdrop.mjs "<image file>" [chapter]
 *   e.g. node scripts/set-backdrop.mjs ~/Downloads/warsaw-room.png ch1
 *
 * Chapter defaults to ch1, and the output lands at public/img/<chapter>-studio.jpg.
 * For a chapter other than ch1, also uncomment that chapter's
 * `conversationBackdrop` line in src/chapters/registry.ts — the app expects
 * either a real file or no entry at all.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [src, chapter = 'ch1'] = process.argv.slice(2);

if (!src) {
  console.error('usage: node scripts/set-backdrop.mjs "<image file>" [chapter]');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`no such image: ${src}`);
  process.exit(1);
}

const out = `public/img/${chapter}-studio.jpg`;
fs.mkdirSync(path.dirname(out), { recursive: true });

const before = await sharp(src).metadata();
await sharp(src).resize(1920, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(out);
const after = await sharp(out).metadata();

console.log(`${path.basename(src)}  ${before.width}x${before.height}`);
console.log(`-> ${out}  ${after.width}x${after.height}  ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
