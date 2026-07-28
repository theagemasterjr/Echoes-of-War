/**
 * Measures a built character GLB the way the chapter camera sees it — one
 * report per clip. This is how the registry's scale/offset/rotation and the
 * build scripts' TALK_YAW_FIX are chosen, and how a fix is checked afterwards.
 *
 * Run:  node scripts/inspect-pose.mjs public/models/ch4-medic.glb [more.glb ...]
 *
 * Reading the report (all heights in model units — multiply by the registry's
 * scale to get world units; the chapter camera looks straight down −z):
 *   crown / headBone / lowest  where the character's silhouette sits. `lowest`
 *                              should be ~0: that means he rests on his origin.
 *   hips y/x/z                 the seat. Idle and talking should agree to about
 *                              a centimetre, or he pops when a line starts.
 *   gaze pitch / yaw           where the face points, in degrees. yaw 0 = at
 *                              the player, positive = toward the player's
 *                              right. pitch < 0 = looking down.
 *   body hipYaw / spineYaw     how far the torso is twisted away from camera.
 *   loop worst bone jump       distance any bone travels between the clip's
 *                              last frame and its first. Anything above ~1cm
 *                              shows as a snap every time the loop restarts.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SAMPLES = 24;

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/** three can't decode the embedded webp textures under node, and doesn't need
 *  them to measure a pose — so hand it a texture-free copy of the file. */
async function loadPosable(file) {
  const doc = await io.read(file);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  for (const e of doc.getRoot().listExtensionsUsed()) e.dispose(); // also un-meshopts
  const bytes = await io.writeBinary(doc);
  return new Promise((res, rej) => new GLTFLoader().parse(bytes.buffer, '', res, rej));
}

const stat = (a) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return `${m.toFixed(3)} [${Math.min(...a).toFixed(3)}..${Math.max(...a).toFixed(3)}]`;
};
/** world +z of a bone = the direction it faces (both rigs pose axis-aligned) */
const facing = (o) => {
  const m = o.matrixWorld.elements;
  return new THREE.Vector3(m[8], m[9], m[10]).normalize();
};

for (const file of process.argv.slice(2)) {
  console.log(`\n=========== ${file} ===========`);
  const gltf = await loadPosable(file);
  const inner = gltf.scene;
  const skins = [];
  inner.traverse((o) => {
    if (o.isSkinnedMesh) skins.push(o);
  });
  const bone = (...names) => names.map((n) => inner.getObjectByName(n)).find(Boolean);
  // ch1 is a Character Creator rig, the rest are Mixamo — ':' is stripped on load
  const head = bone('mixamorigHead', 'CC_Base_Head');
  const hips = bone('mixamorigHips', 'CC_Base_Hips');
  const spine = bone('mixamorigSpine2', 'CC_Base_Spine02', 'CC_Base_Spine01');
  const bones = skins[0]?.skeleton.bones ?? [];

  for (const clip of gltf.animations) {
    const mixer = new THREE.AnimationMixer(inner);
    mixer.clipAction(clip).play();
    const pose = (time) => {
      mixer.setTime(time);
      inner.updateMatrixWorld(true);
      for (const m of skins) m.skeleton.update();
    };
    const acc = { crown: [], headY: [], low: [], hipY: [], hipX: [], hipZ: [], pitch: [], yaw: [], hipYaw: [], spineYaw: [] };
    const t = new THREE.Vector3();
    for (let i = 0; i < SAMPLES; i++) {
      pose((i * clip.duration) / SAMPLES);
      let maxY = -Infinity;
      let minY = Infinity;
      for (const m of skins) {
        const count = m.geometry.attributes.position.count;
        for (let v = 0; v < count; v += 7) {
          m.getVertexPosition(v, t);
          m.localToWorld(t);
          if (!Number.isFinite(t.y)) continue;
          if (t.y > maxY) maxY = t.y;
          if (t.y < minY) minY = t.y;
        }
      }
      acc.crown.push(maxY);
      acc.low.push(minY);
      const hp = head.getWorldPosition(new THREE.Vector3());
      const bp = hips.getWorldPosition(new THREE.Vector3());
      acc.headY.push(hp.y);
      acc.hipY.push(bp.y);
      acc.hipX.push(bp.x);
      acc.hipZ.push(bp.z);
      const f = facing(head);
      acc.pitch.push(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(f.y, -1, 1))));
      acc.yaw.push(THREE.MathUtils.radToDeg(Math.atan2(f.x, f.z)));
      for (const [key, b] of [['hipYaw', hips], ['spineYaw', spine]]) {
        if (!b) continue;
        const bf = facing(b);
        acc[key].push(THREE.MathUtils.radToDeg(Math.atan2(bf.x, bf.z)));
      }
    }

    // loop seam: how far every bone moves between the last frame and the first
    const snapshot = (time) => {
      pose(time);
      return bones.map((b) => b.getWorldPosition(new THREE.Vector3()));
    };
    // a hair before the end: at exactly `duration` the mixer has already
    // wrapped round to frame 0, which would make every seam measure zero
    const atEnd = snapshot(clip.duration - 1e-4);
    const atStart = snapshot(0);
    let seam = 0;
    let seamBone = '-';
    atStart.forEach((p, i) => {
      const d = p.distanceTo(atEnd[i]);
      if (d > seam) {
        seam = d;
        seamBone = bones[i].name;
      }
    });

    console.log(`  "${clip.name}"  ${clip.duration.toFixed(2)}s  ${clip.tracks.length} tracks`);
    console.log(`     crown ${stat(acc.crown)}  headBone ${stat(acc.headY)}  lowest ${stat(acc.low)}`);
    console.log(`     hips  y ${stat(acc.hipY)}  x ${stat(acc.hipX)}  z ${stat(acc.hipZ)}`);
    console.log(`     gaze  pitch ${stat(acc.pitch)}  yaw ${stat(acc.yaw)}`);
    if (acc.hipYaw.length) console.log(`     body  hipYaw ${stat(acc.hipYaw)}  spineYaw ${stat(acc.spineYaw)}`);
    console.log(`     loop  worst bone jump end->start ${(seam * 100).toFixed(1)}cm (${seamBone})`);
  }
}
