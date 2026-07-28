'use client';
/**
 * Central asset registry — THE swap point for externally generated models.
 * To replace a placeholder with a real model: drop the .glb into public/models/
 * and change that asset's entry to { kind: 'glb', url: '/models/<file>.glb' }.
 * Characters with skeletal animations additionally name their clips via
 * `clips` — the stage passes `talking` and the right clip plays. No other
 * code changes, ever. Generation prompts: docs/model-prompts.md.
 */
import { Suspense, useMemo, useRef, type FC } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { MathUtils, type AnimationClip, type Group, type Object3D } from 'three';
import * as P from './placeholders';

type GroupProps = ThreeElements['group'];

export type AssetId = string;

type AssetSource =
  | { kind: 'placeholder'; component: FC<GroupProps> }
  | {
      kind: 'glb';
      url: string;
      scale?: number;
      rotation?: [number, number, number];
      /** nudges the model inside its slot (recenter / rest on the surface) */
      offset?: [number, number, number];
      /** heavy set-dressing models should receive shadows but not cast them —
       *  casting re-renders their full geometry into the shadow map */
      castShadow?: boolean;
      /** skeletal clip names baked into the file — idle loops always,
       *  talking takes over while the `talking` prop is true. idleTimeScale
       *  slows the idle clip (lets a talking loop double as a calm idle). */
      clips?: { idle: string; talking: string; idleTimeScale?: number };
      /** lifts (or drops) the character's gaze without re-recording the clip:
       *  every frame, after the animation has posed the skeleton, this bone is
       *  pitched by `degrees` (positive = look up) about its own side axis.
       *  For a clip animated too far chin-down to read on camera. */
      headTilt?: { bone: string; degrees: number };
    };

export const ASSETS: Record<AssetId, { label: string; source: AssetSource }> = {
  'warroom.table': { label: 'War-room table', source: { kind: 'glb', url: '/models/war-table.glb', scale: 18, offset: [0, -3.49, 0], castShadow: false } },
  'warroom.map': { label: 'Paper world map', source: { kind: 'glb', url: '/models/world-map.glb', scale: 7, offset: [0, 0, 0], castShadow: false } },
  'ch1.marker': { label: 'Miniature 1940s radio', source: { kind: 'glb', url: '/models/radio.glb', scale: 0.012, offset: [0, 0.131, 0.079] } },
  // Drop-in when the founder's model lands in public/models/ch2-spitfire.glb:
  // 'ch2.marker': { label: 'Miniature Spitfire', source: { kind: 'glb', url: '/models/ch2-spitfire.glb', scale: 1 } },  // eye-tune scale/offset like the other markers
  'ch2.marker': { label: 'Miniature Spitfire', source: { kind: 'placeholder', component: P.SpitfireProp } },
  'ch3.marker': { label: 'Miniature warship', source: { kind: 'glb', url: '/models/warship.glb', scale: 0.2, offset: [0, 0.09, 0] } },
  'ch4.marker': { label: 'Miniature medic satchel', source: { kind: 'glb', url: '/models/bandages.glb', scale: 2.4, offset: [-0.01, 0, 0] } },
  'ch5.marker': { label: 'Miniature medic helmet', source: { kind: 'placeholder', component: P.HelmetProp } },
  'ch6.marker': { label: 'Miniature paper lantern', source: { kind: 'glb', url: '/models/lantern.glb', scale: 0.05, offset: [-0.05, 0.03, 0] } },
  // Chapter 1 timeline minigame — one wooden figure per event. Scales are set
  // from each file's measured bounds so every piece stands ~0.78 units tall.
  'ch1.figure.versailles': { label: 'Timeline figure — Treaty of Versailles', source: { kind: 'glb', url: '/models/ch1-fig-versailles.glb', scale: 6.6 } },
  'ch1.figure.depression': { label: 'Timeline figure — Great Depression', source: { kind: 'glb', url: '/models/ch1-fig-depression.glb', scale: 8.5 } },
  'ch1.figure.hitler': { label: 'Timeline figure — Hitler becomes Chancellor', source: { kind: 'glb', url: '/models/ch1-fig-hitler.glb', scale: 6.4 } },
  'ch1.figure.rhineland': { label: 'Timeline figure — Rhineland', source: { kind: 'glb', url: '/models/ch1-fig-rhineland.glb', scale: 6.4 } },
  'ch1.figure.munich': { label: 'Timeline figure — Munich Agreement', source: { kind: 'glb', url: '/models/ch1-fig-munich.glb', scale: 8.5 } },
  'ch1.figure.pact': { label: 'Timeline figure — German–Soviet pact', source: { kind: 'glb', url: '/models/ch1-fig-pact.glb', scale: 6.9 } },
  'ch1.figure.invasion': { label: 'Timeline figure — Invasion of Poland', source: { kind: 'glb', url: '/models/ch1-fig-invasion.glb', scale: 6.9 } },
  'ch1.figure.declarations': { label: 'Timeline figure — War declared', source: { kind: 'glb', url: '/models/ch1-fig-declarations.glb', scale: 7.4 } },
  'ch1.character': {
    label: 'Polish journalist figure',
    source: {
      kind: 'glb', url: '/models/ch1-journalist.glb',
      // Rebuilt July 2026 on a Mixamo rig (mixamorig:* bones) — a metre-scale
      // rig like ch4/ch5, so the same 4.76 scale applies. headBone measured
      // (node scripts/inspect-pose.mjs) at y 1.078; 1.078 x 4.76 - 3.64 = 1.49,
      // matching ch4's on-screen head line. rotation 0.1 rad (~5.7°) plus this
      // take's own ~1.7° gaze yaw lands her on-screen facing at ~7° toward the
      // player's right, same as ch4.
      scale: 4.76, offset: [0, -3.64, -0.5], rotation: [0, 0.1, 0], castShadow: false,
      // both clips are purpose-made loops, so each plays at its own pace
      clips: { idle: 'Idle_Loop', talking: 'Idle_Talking_Loop' },
      // no headTilt needed this time — both clips already read close to ch4's
      // target gaze pitch as animated (idle -3.55°, talking -9.77° measured),
      // and the talking take's yaw was corrected in the build script
      // (TALK_YAW_FIX) rather than here, since that fix has to live in the
      // clip itself (see docs/character-animation-guide.md).
    },
  },
  'ch2.character': {
    label: 'RAF pilot figure',
    source: {
      kind: 'glb', url: '/models/ch2-pilot.glb',
      // -0.3 dated from the old talking take, which was animated turned toward
      // the player's right — the model was pre-turned left to compensate. The
      // July 2026 talking clip is yaw-aligned with the idle (both ≈ -1.5°), so
      // that pre-turn read as him talking past the player's left shoulder.
      // 0.15 matches ch4's on-screen facing (a touch toward the player's right).
      scale: 0.042, offset: [0, -3.35, -0.6], rotation: [0, 0.15, 0], castShadow: false,
      clips: { idle: 'Idle_Loop', talking: 'Talking_Loop' },
      // his talking take is animated 24° chin-down (ch4's sits at 10°) — he
      // glowered at the desk instead of the player. +14 matches ch4's level.
      headTilt: { bone: 'ww2_ger_test_archetypeHead', degrees: 14 },
    },
  },
  // Reserved for the chapter 2 minigame scene the founder may build later
  // (flying helmet + goggles on a deckchair). Registered so the swap is ready,
  // but NOT currently rendered anywhere — drawing it is a future scene's job.
  'ch2.prop.helmet': { label: 'Flying helmet on a deckchair', source: { kind: 'placeholder', component: P.HelmetProp } },
  // Chapter 2 matching minigame — one bronze piece per objective. Scales are
  // set from each file's measured bounds so every piece reads at a similar
  // size on the table (~0.7 units tall); every piece rests on its own origin.
  'ch2.piece.boat': { label: 'Matching piece — Dunkirk fishing boat', source: { kind: 'glb', url: '/models/ch2-piece-boat.glb', scale: 6.5 } },
  'ch2.piece.carriage': { label: 'Matching piece — armistice railway carriage', source: { kind: 'glb', url: '/models/ch2-piece-carriage.glb', scale: 6.3 } },
  'ch2.piece.bomber': { label: 'Matching piece — German bomber', source: { kind: 'glb', url: '/models/ch2-piece-bomber.glb', scale: 5.6 } },
  'ch2.piece.cathedral': { label: 'Matching piece — St Paul’s Cathedral', source: { kind: 'glb', url: '/models/ch2-piece-cathedral.glb', scale: 4.7 } },
  'ch2.piece.crown': { label: 'Matching piece — the crown', source: { kind: 'glb', url: '/models/ch2-piece-crown.glb', scale: 6.1 } },
  'ch3.character': {
    label: 'US sailor figure',
    source: {
      kind: 'glb', url: '/models/ch3-sailor.glb',
      // Navy1 rig is cm-scale (181 units standing); both clips are seated, so
      // the offset lifts the seated head to ~2.4 like the other chapters.
      // rotation was -0.15 for the old talking take; the July 2026 clip is
      // yaw-aligned with the idle (~1.5°), so 0.1 matches ch4's facing.
      scale: 0.048, offset: [-0.15, -4.0, -0.5], rotation: [0, 0.1, 0], castShadow: false,
      clips: { idle: 'Idle_Loop', talking: 'Talking_Loop' },
      // the July 2026 talking take sits slightly chin-down and the cap brim
      // hides his eyes from this camera; a small lift levels the gaze.
      headTilt: { bone: 'mixamorigHead', degrees: 8 },

    },
  },
  // Reserved for the chapter 3 minigame scene the founder may build later.
  // Registered so the swaps are ready, but NEITHER is currently rendered
  // anywhere — drawing them is a future scene's job.
  'ch3.prop.dixiecup': { label: 'Sailor’s cap and dungarees on a footlocker', source: { kind: 'placeholder', component: P.HelmetProp } },
  'ch3.prop.globe': { label: '1941 desk globe — the “one world” object', source: { kind: 'placeholder', component: P.LanternProp } },
  // Chapter 3 Letters of December minigame — one sealed document per round,
  // rendered four times each (options in a round must look identical). All
  // three are flat closed props resting on their own origin; opening is done
  // in code, never in the model.
  'ch3.doc.decree': { label: 'Sealed Imperial decree (round 1)', source: { kind: 'glb', url: '/models/ch3-doc-decree.glb', scale: 3.2 } },
  'ch3.doc.folder': { label: 'Strapped military mission folder (round 2)', source: { kind: 'glb', url: '/models/ch3-doc-folder.glb', scale: 3.2 } },
  'ch3.doc.envelope': { label: 'Official Washington envelope (round 3)', source: { kind: 'glb', url: '/models/ch3-doc-envelope.glb', scale: 3.2 } },
  'ch4.character': {
    label: 'Soviet medic figure',
    source: {
      kind: 'glb', url: '/models/ch4-medic.glb',
      // Ch49 rig is metre-scale; both clips are seated with the head at y 1.30,
      // so this puts the top of the head at ~2.40 like the other chapters.
      // Turned a touch toward the player's right (it used to be -0.25, turned
      // the other way): his talking loop twists the shoulders away from camera,
      // and this brings his face back round to the player.
      scale: 4.76, offset: [0, -3.79, -0.5], rotation: [0, 0.1, 0], castShadow: false,
      clips: { idle: 'Idle_Loop', talking: 'Talking_Loop' },

    },
  },
  // Chapter 4 "Operation Uranus" minigame — the pieces the player lays out on
  // the red-stained map. Scales are set from each file's measured bounds so the
  // set reads at one size on the table: the two markers ~0.7 units tall, the
  // ruined city a low ~0.5 landmark, the soldier figures ~0.7. Every file rests
  // on its own origin (measured min y = 0), so no offset is needed to keep a
  // piece out of the tabletop — the scene adds the shared base disc under each.
  'ch4.piece.derrick': { label: 'Oil derrick — the Caucasus oil fields', source: { kind: 'glb', url: '/models/ch4-piece-derrick.glb', scale: 0.33 } },
  'ch4.piece.barge': { label: 'Supply barge — the Volga', source: { kind: 'glb', url: '/models/ch4-piece-barge.glb', scale: 0.3 } },
  'ch4.piece.hammer': { label: 'Soviet hammer — one arm of the attack', source: { kind: 'glb', url: '/models/ch4-piece-hammer.glb', scale: 0.42, offset: [-0.03, 0, 0] } },
  'ch4.piece.city': { label: 'Ruined city — Stalingrad', source: { kind: 'glb', url: '/models/ch4-piece-city.glb', scale: 0.42 } },
  // ONE soldier file stands for both armies on the board: three of them are the
  // German 6th Army in the city, two are the Axis allies holding the flanks.
  // The scene tells them apart by tint and size (the ally pieces are paler and
  // a little smaller — "less well equipped, more thinly spread") and, above
  // all, by their labels. Drop a separate ally model in later by pointing
  // 'ch4.piece.ally' at its own file; nothing else changes.
  'ch4.piece.german': { label: 'Soldier figure — German 6th Army', source: { kind: 'glb', url: '/models/ch4-piece-soldier.glb', scale: 0.29 } },
  'ch4.piece.ally': { label: 'Soldier figure — Axis ally army (Romanian / Hungarian)', source: { kind: 'glb', url: '/models/ch4-piece-soldier.glb', scale: 0.255 } },
  'ch5.character': {
    label: 'British nursing sister figure',
    source: {
      kind: 'glb', url: '/models/ch5-nurse.glb',
      // Meshy body on a Mixamo rig, metre-scale like ch1/ch4 — so it takes the
      // same 4.76. Both clips are seated with the head bone at y 1.138 (a shade
      // taller in the seat than ch4's 1.109), and the offset is set from that:
      // 4.76 × 1.138 − 3.93 puts the head on ~1.49, the line ch2/ch3/ch4 all
      // sit on. Same −0.25 turn and −0.5 depth as the other chapters.
      scale: 4.76, offset: [0, -3.93, -0.5], rotation: [0, -0.25, 0], castShadow: false,
      clips: { idle: 'Idle_Loop', talking: 'Talking_Loop' },
    },
  },
  // Chapter 5 "Show it or hide it" minigame — eight props the player sorts into
  // the two English zones, plus the grey pin that stands for German command.
  // Scales come from the measured bounds printed by scripts/build-ch5-pieces.mjs
  // and are set on FOOTPRINT, not height: every piece takes up about 0.6 units
  // of table so four of them sit inside a zone without touching, while a
  // signpost stays tall and a camouflage net stays flat. Every file rests on its
  // own origin (measured min y = 0), so no offset keeps it out of the tabletop.
  'ch5.piece.inflatable-tank': { label: 'Inflatable rubber tank', source: { kind: 'glb', url: '/models/ch5-piece-inflatable-tank.glb', scale: 3.77 } },
  'ch5.piece.dummy-landing-craft': { label: 'Dummy plywood landing craft', source: { kind: 'glb', url: '/models/ch5-piece-dummy-landing-craft.glb', scale: 3.53 } },
  'ch5.piece.fake-hq-sign': { label: 'Fake headquarters signpost', source: { kind: 'glb', url: '/models/ch5-piece-fake-hq-sign.glb', scale: 5.77 } },
  'ch5.piece.radio-truck': { label: 'Radio truck with tall aerial', source: { kind: 'glb', url: '/models/ch5-piece-radio-truck.glb', scale: 4.08 } },
  'ch5.piece.camouflage-netting': { label: 'Camouflage netting over supplies', source: { kind: 'glb', url: '/models/ch5-piece-camouflage-netting.glb', scale: 3.57 } },
  'ch5.piece.sealed-camp-gate': { label: 'Barbed-wire camp gate', source: { kind: 'glb', url: '/models/ch5-piece-sealed-camp-gate.glb', scale: 3.9 } },
  'ch5.piece.mail-sack': { label: 'Censor’s mail sack', source: { kind: 'glb', url: '/models/ch5-piece-mail-sack.glb', scale: 4.84 } },
  'ch5.piece.blackout-screen': { label: 'Blacked-out dock lamp', source: { kind: 'glb', url: '/models/ch5-piece-blackout-screen.glb', scale: 5.26 } },
  // Drawn small and grey: it marks where German command is looking, and the
  // same file stands in for the division markers that gather at Calais.
  'ch5.pin.german-command': { label: 'Grey German command pin', source: { kind: 'glb', url: '/models/ch5-pin-german-command.glb', scale: 3.47 } },
  'ch6.character': { label: 'Hiroshima doctor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  // Chapter 6 "The Voices" minigame — four pieces stand for four people, plus
  // the paper crane (hidden until the end) and the paper slip the quotes ride
  // on. Scales are set from each file's measured bounds (build-ch6-pieces.mjs
  // prints them) so the four voice pieces share a similar footprint (~0.6);
  // the flat pieces (slide rule, document, slip) are scaled by footprint, not
  // height. Every file rests on its own origin.
  'ch6.piece.helmet-pack': { label: 'Steel helmet on a folded pack — the soldier', source: { kind: 'glb', url: '/models/ch6-piece-helmet-pack.glb', scale: 1.4 } },
  'ch6.piece.lantern': { label: 'Paper lantern — the civilian', source: { kind: 'glb', url: '/models/ch6-piece-lantern.glb', scale: 0.7 } },
  'ch6.piece.slide-rule': { label: 'Slide rule on papers — the scientist', source: { kind: 'glb', url: '/models/ch6-piece-slide-rule.glb', scale: 1.5 } },
  'ch6.piece.pen-document': { label: 'Fountain pen on a document — the leader', source: { kind: 'glb', url: '/models/ch6-piece-pen-document.glb', scale: 1.6 } },
  'ch6.piece.crane': { label: 'Folded paper crane — hidden until the end', source: { kind: 'glb', url: '/models/ch6-piece-crane.glb', scale: 1.9 } },
  'ch6.piece.slip': { label: 'Aged paper slip — carries each spoken line', source: { kind: 'glb', url: '/models/ch6-piece-slip.glb', scale: 1.8 } },
};

/** Does this asset carry its own skeletal animation? (Stages skip the Float bob for these.) */
export function assetIsAnimated(assetId: AssetId): boolean {
  const src = ASSETS[assetId]?.source;
  return src?.kind === 'glb' && !!src.clips;
}

const Glb: FC<
  {
    url: string;
    scale?: number;
    rotation?: [number, number, number];
    offset?: [number, number, number];
    castShadow?: boolean;
    clips?: { idle: string; talking: string; idleTimeScale?: number };
    headTilt?: { bone: string; degrees: number };
    talking?: boolean;
  } & Omit<GroupProps, 'scale' | 'rotation'>
> = ({ url, scale = 1, rotation = [0, 0, 0], offset = [0, 0, 0], castShadow = true, clips, headTilt, talking = false, ...props }) => {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);
  const shadowed = useMemo(() => {
    scene.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = true;
      }
      // animation moves skinned geometry outside its rest-pose bounds — the
      // stock culling test uses those stale bounds and blanks the mesh
      if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) o.frustumCulled = false;
    });
    return scene;
  }, [scene, castShadow]);

  // idle always loops; talking cross-fades in over it while `talking` is true.
  // When both states share one clip, only the playback speed changes.
  // Checked every frame, not once on mount: a start command issued at an
  // unlucky moment (mid-transition, remount, hot reload) used to fail silently
  // and leave the character T-posed forever — now a miss just retries next frame.
  // the bones whose pose gets nudged after the animation has written it.
  // Some rigs (ch2/ch3 FBX exports) carry several identically-named nodes for
  // one bone — one per mesh skin cluster — which GLTFLoader renames to
  // "name", "name_1", "name_2"… on load. Only the instance(s) the playing
  // clip drives are rewritten by the mixer each frame; tilting any other
  // copy would ACCUMULATE frame after frame and spin whatever hangs off it
  // (ch3's eyeballs orbited his head). So: collect every same-named copy,
  // but each frame tilt only the ones the active clip animates.
  const tiltBones = useMemo<{ node: Object3D; drivenBy: Set<string> }[]>(() => {
    if (!headTilt) return [];
    const trackRoots = (c: AnimationClip) => c.tracks.map((t) => t.name.split('.')[0]);
    const suffixed = new RegExp(`^${headTilt.bone}(_\\d+)?$`);
    const found: { node: Object3D; drivenBy: Set<string> }[] = [];
    shadowed.traverse((o) => {
      if (!suffixed.test(o.name)) return;
      const drivenBy = new Set(
        animations.filter((c) => trackRoots(c).includes(o.name)).map((c) => c.name),
      );
      found.push({ node: o, drivenBy });
    });
    return found;
  }, [shadowed, animations, headTilt]);
  const tiltRad = headTilt ? MathUtils.degToRad(headTilt.degrees) : 0;

  const lastClip = useRef<string | null>(null);
  useFrame(() => {
    // Gaze correction. The clip rewrites the bone's rotation every frame, so
    // this has to be re-applied every frame AND after the mixer has run —
    // which it is: useAnimations subscribes its update above, and r3f calls
    // same-priority frame callbacks in subscription order.
    // Negative because pitching a bone about its own +X tips its face axis
    // down; `degrees` is written the way a person reads it (positive = up).
    // (skip bones the active clip doesn't drive — nothing resets them, so a
    // per-frame rotate would accumulate into a spin instead of a fixed tilt)
    for (const b of tiltBones)
      if (lastClip.current && b.drivenBy.has(lastClip.current)) b.node.rotateX(-tiltRad);

    if (!clips) return;
    const name = talking ? clips.talking : clips.idle;
    const next = actions[name];
    if (!next) return; // bindings not ready yet — try again next frame
    next.timeScale = talking ? 1 : (clips.idleTimeScale ?? 1);
    if (lastClip.current !== name) {
      const prev = lastClip.current ? actions[lastClip.current] : null;
      next.reset().setEffectiveWeight(1).play();
      if (prev && prev !== next) next.crossFadeFrom(prev, 0.35, false);
      lastClip.current = name;
    } else if (!next.isRunning()) {
      next.reset().setEffectiveWeight(1).play(); // something stopped it — heal
    }
  });

  return (
    <group {...props} ref={group} rotation={rotation}>
      <primitive object={shadowed} scale={scale} position={offset} />
    </group>
  );
};

export const Asset: FC<{ assetId: AssetId; talking?: boolean } & Omit<GroupProps, 'id'>> = ({
  assetId, talking, ...props
}) => {
  const entry = ASSETS[assetId];
  if (!entry) return null;
  if (entry.source.kind === 'glb') {
    const { url, scale, rotation, offset, castShadow, clips, headTilt } = entry.source;
    const { scale: _s, rotation: _r, ...rest } = props;
    return (
      <Suspense fallback={null}>
        {/* key by url so swapping models unmounts the old one instead of
            re-using it. Without this, one <Glb> instance walks from chapter to
            chapter and its animation mixer can end up holding the PREVIOUS
            chapter's clips while pointing at the new chapter's skeleton.
            three.js strips ':' out of track names, so ch4's "mixamorig:Hips"
            sanitizes to "mixamorigHips" — the exact bone names ch3 and ch5
            really use. The clips therefore bind instead of failing safely, and
            drive the new rig from the wrong animation until its mesh collapses
            and the character vanishes. A fresh mount gets a fresh mixer. */}
        <Glb
          key={url}
          url={url} scale={scale} rotation={rotation} offset={offset}
          castShadow={castShadow} clips={clips} headTilt={headTilt} talking={talking} {...rest}
        />
      </Suspense>
    );
  }
  const C = entry.source.component;
  return <C {...props} />;
};
