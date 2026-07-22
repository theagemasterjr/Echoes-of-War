'use client';
/**
 * Central asset registry — THE swap point for externally generated models.
 * To replace a placeholder with a real model: drop the .glb into public/models/
 * and change that asset's entry to { kind: 'glb', url: '/models/<file>.glb' }.
 * No other code changes, ever. Generation prompts: docs/model-prompts.md.
 */
import { Suspense, type FC } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as P from './placeholders';

type GroupProps = ThreeElements['group'];

export type AssetId = string;

type AssetSource =
  | { kind: 'placeholder'; component: FC<GroupProps> }
  | { kind: 'glb'; url: string; scale?: number; rotation?: [number, number, number] };

export const ASSETS: Record<AssetId, { label: string; source: AssetSource }> = {
  'warroom.table': { label: 'War-room table', source: { kind: 'placeholder', component: P.Table } },
  'warroom.map': { label: 'Paper world map', source: { kind: 'placeholder', component: P.MapSheet } },
  'warroom.lamp': { label: 'Desk lamp', source: { kind: 'placeholder', component: P.Lamp } },
  'ch1.marker': { label: 'Miniature 1940s radio', source: { kind: 'placeholder', component: P.RadioProp } },
  'ch2.marker': { label: 'Miniature Spitfire', source: { kind: 'placeholder', component: P.SpitfireProp } },
  'ch3.marker': { label: 'Miniature warship', source: { kind: 'placeholder', component: P.ShipProp } },
  'ch4.marker': { label: 'Miniature medic satchel', source: { kind: 'placeholder', component: P.MedicSatchelProp } },
  'ch5.marker': { label: 'Miniature landing craft', source: { kind: 'placeholder', component: P.LandingCraftProp } },
  'ch6.marker': { label: 'Miniature paper crane', source: { kind: 'placeholder', component: P.PaperCraneProp } },
  'ch1.character': { label: 'Polish journalist figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch2.character': { label: 'RAF pilot figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch3.character': { label: 'US sailor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch4.character': { label: 'Soviet medic figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch5.character': { label: 'Allied medical worker figure', source: { kind: 'placeholder', component: P.CharacterBust } },
  'ch6.character': { label: 'Hiroshima doctor figure', source: { kind: 'placeholder', component: P.CharacterBust } },
};

const Glb: FC<
  { url: string; scale?: number; rotation?: [number, number, number] } & Omit<
    GroupProps,
    'scale' | 'rotation'
  >
> = ({ url, scale = 1, rotation = [0, 0, 0], ...props }) => {
  const { scene } = useGLTF(url);
  return (
    <group {...props} rotation={rotation}>
      <primitive object={scene} scale={scale} />
    </group>
  );
};

export const Asset: FC<{ assetId: AssetId } & Omit<GroupProps, 'id'>> = ({ assetId, ...props }) => {
  const entry = ASSETS[assetId];
  if (!entry) return null;
  if (entry.source.kind === 'glb') {
    const { url, scale, rotation } = entry.source;
    const { scale: _s, rotation: _r, ...rest } = props;
    return (
      <Suspense fallback={null}>
        <Glb url={url} scale={scale} rotation={rotation} {...rest} />
      </Suspense>
    );
  }
  const C = entry.source.component;
  return <C {...props} />;
};
