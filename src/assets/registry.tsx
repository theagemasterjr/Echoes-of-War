'use client';
/**
 * Central asset registry — THE swap point for externally generated models.
 * To replace a placeholder with a real model: drop the .glb into public/models/
 * and change that asset's entry to { kind: 'glb', url: '/models/<file>.glb' }.
 * No other code changes, ever. Generation prompts: docs/model-prompts.md.
 */
import { Suspense, useMemo, type FC } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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
    };

export const ASSETS: Record<AssetId, { label: string; source: AssetSource }> = {
  'warroom.table': { label: 'War-room table', source: { kind: 'glb', url: '/models/war-table.glb', scale: 18, offset: [0, -3.49, 0], castShadow: false } },
  'warroom.map': { label: 'Paper world map', source: { kind: 'glb', url: '/models/world-map.glb', scale: 7, offset: [0, 0, 0], castShadow: false } },
  'ch1.marker': { label: 'Miniature 1940s radio', source: { kind: 'glb', url: '/models/radio.glb', scale: 0.012, offset: [0, 0.131, 0.079] } },
  'ch2.marker': { label: 'Miniature Spitfire', source: { kind: 'placeholder', component: P.SpitfireProp } },
  'ch3.marker': { label: 'Miniature warship', source: { kind: 'placeholder', component: P.ShipProp } },
  'ch4.marker': { label: 'Miniature medic satchel', source: { kind: 'glb', url: '/models/bandages.glb', scale: 2.4, offset: [-0.01, 0, 0] } },
  'ch5.marker': { label: 'Miniature medic helmet', source: { kind: 'placeholder', component: P.HelmetProp } },
  'ch6.marker': { label: 'Miniature paper lantern', source: { kind: 'glb', url: '/models/lantern.glb', scale: 0.05, offset: [-0.05, 0.03, 0] } },
  'ch1.character': { label: 'Polish journalist figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch2.character': { label: 'RAF pilot figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch3.character': { label: 'US sailor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch4.character': { label: 'Soviet medic figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch5.character': { label: 'Allied medical worker figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch6.character': { label: 'Hiroshima doctor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
};

const Glb: FC<
  {
    url: string;
    scale?: number;
    rotation?: [number, number, number];
    offset?: [number, number, number];
    castShadow?: boolean;
  } & Omit<GroupProps, 'scale' | 'rotation'>
> = ({ url, scale = 1, rotation = [0, 0, 0], offset = [0, 0, 0], castShadow = true, ...props }) => {
  const { scene } = useGLTF(url);
  const shadowed = useMemo(() => {
    scene.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = true;
      }
    });
    return scene;
  }, [scene, castShadow]);
  return (
    <group {...props} rotation={rotation}>
      <primitive object={shadowed} scale={scale} position={offset} />
    </group>
  );
};

export const Asset: FC<{ assetId: AssetId } & Omit<GroupProps, 'id'>> = ({ assetId, ...props }) => {
  const entry = ASSETS[assetId];
  if (!entry) return null;
  if (entry.source.kind === 'glb') {
    const { url, scale, rotation, offset, castShadow } = entry.source;
    const { scale: _s, rotation: _r, ...rest } = props;
    return (
      <Suspense fallback={null}>
        <Glb
          url={url} scale={scale} rotation={rotation} offset={offset}
          castShadow={castShadow} {...rest}
        />
      </Suspense>
    );
  }
  const C = entry.source.component;
  return <C {...props} />;
};
