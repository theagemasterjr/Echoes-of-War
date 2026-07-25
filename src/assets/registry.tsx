'use client';
/**
 * Central asset registry — THE swap point for externally generated models.
 * To replace a placeholder with a real model: drop the .glb into public/models/
 * and change that asset's entry to { kind: 'glb', url: '/models/<file>.glb' }.
 * Characters with skeletal animations additionally name their clips via
 * `clips` — the stage passes `talking` and the right clip plays. No other
 * code changes, ever. Generation prompts: docs/model-prompts.md.
 */
import { Suspense, useEffect, useMemo, useRef, type FC } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
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
    };

export const ASSETS: Record<AssetId, { label: string; source: AssetSource }> = {
  'warroom.table': { label: 'War-room table', source: { kind: 'glb', url: '/models/war-table.glb', scale: 18, offset: [0, -3.49, 0], castShadow: false } },
  'warroom.map': { label: 'Paper world map', source: { kind: 'glb', url: '/models/world-map.glb', scale: 7, offset: [0, 0, 0], castShadow: false } },
  'ch1.marker': { label: 'Miniature 1940s radio', source: { kind: 'glb', url: '/models/radio.glb', scale: 0.012, offset: [0, 0.131, 0.079] } },
  'ch2.marker': { label: 'Miniature Spitfire', source: { kind: 'placeholder', component: P.SpitfireProp } },
  'ch3.marker': { label: 'Miniature warship', source: { kind: 'glb', url: '/models/warship.glb', scale: 0.2, offset: [0, 0.09, 0] } },
  'ch4.marker': { label: 'Miniature medic satchel', source: { kind: 'glb', url: '/models/bandages.glb', scale: 2.4, offset: [-0.01, 0, 0] } },
  'ch5.marker': { label: 'Miniature medic helmet', source: { kind: 'placeholder', component: P.HelmetProp } },
  'ch6.marker': { label: 'Miniature paper lantern', source: { kind: 'glb', url: '/models/lantern.glb', scale: 0.05, offset: [-0.05, 0.03, 0] } },
  // Chapter 1 timeline minigame — one wooden figure per event. Scales are set
  // from each file's measured bounds so every piece stands ~0.55 units tall.
  'ch1.figure.versailles': { label: 'Timeline figure — Treaty of Versailles', source: { kind: 'glb', url: '/models/ch1-fig-versailles.glb', scale: 4.7 } },
  'ch1.figure.depression': { label: 'Timeline figure — Great Depression', source: { kind: 'glb', url: '/models/ch1-fig-depression.glb', scale: 6.1 } },
  'ch1.figure.hitler': { label: 'Timeline figure — Hitler becomes Chancellor', source: { kind: 'glb', url: '/models/ch1-fig-hitler.glb', scale: 4.6 } },
  'ch1.figure.rhineland': { label: 'Timeline figure — Rhineland', source: { kind: 'glb', url: '/models/ch1-fig-rhineland.glb', scale: 4.6 } },
  'ch1.figure.munich': { label: 'Timeline figure — Munich Agreement', source: { kind: 'glb', url: '/models/ch1-fig-munich.glb', scale: 6.1 } },
  'ch1.figure.pact': { label: 'Timeline figure — German–Soviet pact', source: { kind: 'glb', url: '/models/ch1-fig-pact.glb', scale: 4.9 } },
  'ch1.figure.invasion': { label: 'Timeline figure — Invasion of Poland', source: { kind: 'glb', url: '/models/ch1-fig-invasion.glb', scale: 4.9 } },
  'ch1.figure.declarations': { label: 'Timeline figure — War declared', source: { kind: 'glb', url: '/models/ch1-fig-declarations.glb', scale: 5.3 } },
  'ch1.character': {
    label: 'Polish journalist figure',
    source: {
      kind: 'glb', url: '/models/ch1-journalist.glb',
      scale: 4.8, offset: [0, -4.8, 0], castShadow: false,
      clips: { idle: 'Idle_Loop', talking: 'Idle_Talking_Loop' },
    },
  },
  'ch2.character': { label: 'RAF pilot figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch3.character': { label: 'US sailor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch4.character': { label: 'Soviet medic figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch5.character': { label: 'Allied medical worker figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch6.character': { label: 'Hiroshima doctor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
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
    talking?: boolean;
  } & Omit<GroupProps, 'scale' | 'rotation'>
> = ({ url, scale = 1, rotation = [0, 0, 0], offset = [0, 0, 0], castShadow = true, clips, talking = false, ...props }) => {
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
  const lastClip = useRef<string | null>(null);
  useEffect(() => {
    if (!clips) return;
    const name = talking ? clips.talking : clips.idle;
    const next = actions[name];
    if (!next) return;
    next.timeScale = talking ? 1 : (clips.idleTimeScale ?? 1);
    if (lastClip.current !== name) {
      const prev = lastClip.current ? actions[lastClip.current] : null;
      next.reset().play();
      if (prev && prev !== next) next.crossFadeFrom(prev, 0.35, false);
    } else {
      next.play();
    }
    lastClip.current = name;
  }, [talking, actions, clips]);

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
    const { url, scale, rotation, offset, castShadow, clips } = entry.source;
    const { scale: _s, rotation: _r, ...rest } = props;
    return (
      <Suspense fallback={null}>
        <Glb
          url={url} scale={scale} rotation={rotation} offset={offset}
          castShadow={castShadow} clips={clips} talking={talking} {...rest}
        />
      </Suspense>
    );
  }
  const C = entry.source.component;
  return <C {...props} />;
};
