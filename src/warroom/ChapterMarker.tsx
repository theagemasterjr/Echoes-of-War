'use client';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ChapterMeta } from '@/chapters/types';
import { Asset } from '@/assets/registry';
import { BattleFx } from './BattleFx';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Screen-height tier per chapter, so labels for markers placed close
 *  together on the map (currently 1, 2, 4, 5) don't overlap. Chapters 3
 *  and 6 sit far enough away that tier 0 is safe for them too. */
const LABEL_TIER: Record<number, number> = { 1: 0, 2: 1, 3: 0, 4: 2, 5: 3, 6: 0 };

export function ChapterMarker({
  meta, completed, active, onSelect, disabled, showLabel,
}: {
  meta: ChapterMeta;
  completed: boolean;
  /** the one chapter currently "in play" — bigger, hovering, battle effects */
  active: boolean;
  onSelect: () => void;
  disabled: boolean;
  showLabel: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [x, y, z] = meta.markerPosition;
  // the GLB scroll map's paper surface sits ~0.08 above the table top
  const MAP_SURFACE_Y = 0.08;
  const BASE_SCALE = 1.25;
  const still = useMemo(prefersReducedMotion, []);
  const anim = useRef<THREE.Group>(null);
  /** smoothed hover height, kept separate from the bob wave so the sine can't
   *  feed back through the lerp and blow up the amplitude */
  const baseY = useRef(0);

  useFrame(({ clock }, delta) => {
    const g = anim.current;
    if (!g) return;
    if (active && !still) {
      // the active piece is alive: hovering and slowly turning, scaled down so
      // it reads as a game piece rather than dominating the map
      const t = clock.elapsedTime;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 0.71, 0.04));
      baseY.current = THREE.MathUtils.lerp(baseY.current, 0.04, 0.04);
      g.position.y = baseY.current + Math.sin(t * 1.7) * 0.008;
      g.rotation.y += delta * 0.18;
    } else {
      // completed (or reduced motion): settle back down and stop
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, active ? 0.67 : 1, 0.08));
      baseY.current = THREE.MathUtils.lerp(baseY.current, 0, 0.08);
      g.position.y = baseY.current;
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y % (Math.PI * 2), 0, 0.08);
    }
  });

  return (
    <group position={[x, y + MAP_SURFACE_Y + 0.005, z]}>
      <group
        scale={(hovered && !disabled ? 1.25 : 1) * BASE_SCALE}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = disabled ? 'default' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <group ref={anim}>
          <Asset assetId={meta.markerAssetId} />
        </group>
        {/* invisible fattened hit area so small props are easy to click */}
        <mesh visible={false} position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial />
        </mesh>
      </group>
      {active && !still && <BattleFx />}
      {completed && (
        <mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[0.28, 0.004, 0.18]}>
          <ringGeometry args={[0.06, 0.1, 20]} />
          <meshStandardMaterial color="#7a2b20" roughness={0.8} />
        </mesh>
      )}
      {/* chapters 1, 2, 4, 5 sit close together near map center — each gets
          its own label height so none of the four ever land on the same
          row (tuned to the current markerPosition layout in registry.ts).
          Only shown on the map screen — the title screen sees this same
          scene through its darkened overlay and shouldn't show labels. */}
      {showLabel && (
        <Html
          position={[0, 0.16 + LABEL_TIER[meta.index] * 0.26, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-sm bg-stone-950/80 px-1 py-px text-[8px] uppercase text-amber-100/80">
            Chapter {meta.index}
          </div>
        </Html>
      )}
      {hovered && !disabled && (
        <Html position={[0, 1.15, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div className="w-52 rounded-md border border-amber-100/20 bg-stone-950/95 px-3 py-2 text-stone-100 shadow-xl">
            <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
              Chapter {meta.index} · {meta.dates}
            </div>
            <div className="mt-0.5 text-sm font-semibold">{meta.title}</div>
            <div className="text-xs text-stone-400">{meta.location}</div>
            <div className="mt-1 text-xs text-stone-300">{meta.characterRole}</div>
            {completed && <div className="mt-1 text-[11px] text-emerald-300/80">Explored</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
