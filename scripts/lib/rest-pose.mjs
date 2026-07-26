/**
 * Makes a clip's first frame the model's rest pose.
 *
 * Character exports rest in a T-pose; if the animation system ever fails to
 * start a clip, that T-pose is what players see. Writing the idle clip's
 * first keyframe into every animated node's rest transform means "no clip
 * playing" looks like a natural still of the idle instead.
 *
 * Call AFTER clips are merged/renamed but BEFORE resample()/meshopt (it only
 * touches node TRS, so order barely matters — just keep it before write).
 */
export function bakeRestPoseFromClip(anim) {
  let baked = 0;
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const out = ch.getSampler()?.getOutput();
    if (!node || !out) continue;
    const el = [];
    out.getElement(0, el);
    if (ch.getTargetPath() === 'translation') node.setTranslation(el);
    else if (ch.getTargetPath() === 'rotation') node.setRotation(el);
    else if (ch.getTargetPath() === 'scale') node.setScale(el);
    else continue;
    baked++;
  }
  console.log(`rest pose <- "${anim.getName()}" frame 0 (${baked} node transforms)`);
}
