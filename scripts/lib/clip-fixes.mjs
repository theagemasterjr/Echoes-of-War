/**
 * Two repairs that founder-exported character clips keep needing, shared by
 * every build-chN-character script. Both edit the clip's keyframes in place,
 * so call them after the clip is merged and renamed and before the document is
 * written. See docs/character-animation-guide.md for the workflow around them.
 */
import { Quaternion, Vector3, MathUtils } from 'three';

/**
 * Turns a clip's gaze by `degrees` about the world up axis (positive = toward
 * the player's right), spreading the turn evenly over `boneNames`.
 *
 * Why: a talking take is often animated with the head turned away from where
 * the idle looks, so on the dead-on chapter camera the character delivers the
 * whole conversation to someone off screen. Rotating the whole model in the
 * registry can't fix it — the two clips share one rotation, so straightening
 * the talking clip would send the idle off in the other direction. The turn
 * has to come out of the clip itself.
 *
 * How: a bone's keyframes live in its parent's space, so a world-space turn is
 *   local' = inv(P) · Ryaw · P · local
 * where P is the parent's world rotation on that frame, rebuilt from the
 * ancestors' own keyframes (Mixamo bakes every bone on one time grid, so
 * ancestor frame i lines up with bone frame i). Every bone is corrected
 * against the ORIGINAL ancestor rotations and the shares simply add up — a
 * turn applied at the neck carries the head along with it. Spreading the turn
 * over neck + head keeps the pose anatomically believable; the animation's own
 * head movement is untouched, only what it moves around shifts.
 */
export function yawClip(anim, doc, boneNames, degrees) {
  const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const rotOf = new Map(); // node -> its rotation keyframes in this clip
  for (const ch of anim.listChannels())
    if (ch.getTargetPath() === 'rotation') rotOf.set(ch.getTargetNode(), ch);

  const chainOf = (node) => {
    const chain = [];
    for (let n = node.getParentNode(); n; n = n.getParentNode()) chain.push(n);
    return chain;
  };
  /** world rotation of every ancestor of `node`, composed, on frame `i` */
  const parentWorld = (node, i) => {
    const q = new Quaternion();
    for (const anc of chainOf(node).reverse()) {
      const ch = rotOf.get(anc);
      const el = [0, 0, 0, 1];
      if (ch) ch.getSampler().getOutput().getElement(i, el);
      else el.splice(0, 4, ...anc.getRotation());
      q.multiply(new Quaternion(...el));
    }
    return q;
  };

  const share = MathUtils.degToRad(degrees) / boneNames.length;
  for (const name of boneNames) {
    const node = byName.get(name);
    const ch = node && rotOf.get(node);
    if (!ch) throw new Error(`yawClip: no rotation track for "${name}"`);
    const out = ch.getSampler().getOutput();
    const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), share);
    const el = [0, 0, 0, 1];
    for (let i = 0; i < out.getCount(); i++) {
      out.getElement(i, el);
      const p = parentWorld(node, i);
      const q = new Quaternion(...el)
        .premultiply(p) // -> world
        .premultiply(yaw) // turn about world up
        .premultiply(p.clone().invert()); // -> back into the parent's space
      out.setElement(i, [q.x, q.y, q.z, q.w]);
    }
  }
  console.log(`"${anim.getName()}": turned ${degrees}° about world up across ${boneNames.join(' + ')}`);
}

/**
 * Makes a clip loop without a visible jump.
 *
 * A hand-animated take ends wherever the animator left it, so replaying it
 * snaps from the last pose back to the first. This eases every channel toward
 * its own frame-0 value over the last `seconds` of the clip — a smoothstep
 * ramp, so the blend starts and ends without a kink — landing the final
 * keyframe exactly on the first one. Only the tail is touched; the body of the
 * performance is left alone.
 */
export function closeLoop(anim, seconds) {
  let touched = 0;
  let worst = 0;
  for (const ch of anim.listChannels()) {
    const sampler = ch.getSampler();
    const times = sampler.getInput();
    const out = sampler.getOutput();
    const n = times.getCount();
    if (n < 2) continue;
    const start = times.getScalar(n - 1) - seconds;
    const first = [];
    const cur = [];
    out.getElement(0, first);
    const isRot = ch.getTargetPath() === 'rotation';
    const target = isRot ? new Quaternion(...first) : null;
    for (let i = 0; i < n; i++) {
      const t = times.getScalar(i);
      if (t <= start) continue;
      const x = Math.min(1, (t - start) / seconds);
      const w = x * x * (3 - 2 * x); // smoothstep
      out.getElement(i, cur);
      if (isRot) {
        if (i === n - 1)
          worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(new Quaternion(...cur).dot(target)))));
        const q = new Quaternion(...cur).slerp(target, w);
        out.setElement(i, [q.x, q.y, q.z, q.w]);
      } else {
        out.setElement(i, cur.map((v, k) => v + (first[k] - v) * w));
      }
    }
    touched++;
  }
  console.log(
    `"${anim.getName()}": last ${seconds}s eased back onto frame 0 across ${touched} channels ` +
      `(biggest seam closed: ${MathUtils.radToDeg(worst).toFixed(1)}°)`,
  );
}
