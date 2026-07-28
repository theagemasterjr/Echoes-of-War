/**
 * Prints what is actually inside a GLB — clips, meshes, materials, textures,
 * and the rig's seated head height. This is the first thing to run against a
 * fresh founder export, because every build-chN-character script's decisions
 * (which clip is real, which maps to strip, what scale/offset the registry
 * needs) come from these numbers.
 *
 * Run:  node scripts/inspect-glb.mjs <file.glb> [more.glb ...]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

// the built files are meshopt-compressed, so reading one back needs the decoder
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const file of process.argv.slice(2)) {
  console.log(`\n=========== ${file} ===========`);
  const doc = await io.read(file);
  const root = doc.getRoot();

  console.log('-- animations --');
  for (const a of root.listAnimations())
    console.log(`  "${a.getName()}"  channels=${a.listChannels().length}`);

  console.log('-- meshes --');
  for (const m of root.listMeshes())
    console.log(`  "${m.getName()}" prims=${m.listPrimitives().length} semantics=${m.listPrimitives()[0]?.listSemantics().join(',')}`);

  console.log('-- materials --');
  for (const mat of root.listMaterials()) {
    const ext = mat.listExtensions().map((e) => e.extensionName).join(',');
    console.log(`  "${mat.getName()}" alpha=${mat.getAlphaMode()} metal=${mat.getMetallicFactor()} rough=${mat.getRoughnessFactor()} base=${JSON.stringify(mat.getBaseColorFactor())}`);
    console.log(`     baseTex=${mat.getBaseColorTexture()?.getName() ?? 'none'} mrTex=${mat.getMetallicRoughnessTexture()?.getName() ?? 'none'} normTex=${mat.getNormalTexture()?.getName() ?? 'none'} ext=[${ext}]`);
  }

  console.log('-- textures --');
  for (const t of root.listTextures())
    console.log(`  "${t.getName()}" ${t.getMimeType()} ${t.getSize()?.join('x')} bytes=${t.getImage()?.byteLength}`);

  console.log('-- scene roots --');
  for (const n of root.listScenes()[0].listChildren())
    console.log(`  "${n.getName()}" children=${n.listChildren().length} scale=[${n.getScale()}]`);

  const nodes = root.listNodes();
  console.log(`-- nodes: ${nodes.length}`);
  console.log('   bone sample:', nodes.map((n) => n.getName()).filter((n) => /head|hips|foot|spine/i.test(n)).slice(0, 10).join(', '));
  for (const bone of ['mixamorig:HeadTop_End', 'mixamorig:Head', 'mixamorig:Hips', 'mixamorig:LeftToeBase']) {
    const n = nodes.find((x) => x.getName() === bone);
    if (!n) continue;
    const m = n.getWorldMatrix();
    console.log(`   ${bone}: x ${m[12].toFixed(2)} y ${m[13].toFixed(2)} z ${m[14].toFixed(2)}`);
  }
}
