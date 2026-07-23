'use client';
import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ChapterMeta } from '@/chapters/types';
import { Asset } from '@/assets/registry';

/** Screen-height tier per chapter, so labels for markers placed close
 *  together on the map (currently 1, 2, 4, 5) don't overlap. Chapters 3
 *  and 6 sit far enough away that tier 0 is safe for them too. */
const LABEL_TIER: Record<number, number> = { 1: 0, 2: 1, 3: 0, 4: 2, 5: 3, 6: 0 };

export function ChapterMarker({
  meta, completed, onSelect, disabled, showLabel,
}: {
  meta: ChapterMeta;
  completed: boolean;
  onSelect: () => void;
  disabled: boolean;
  showLabel: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [x, y, z] = meta.markerPosition;
  // the GLB scroll map's paper surface sits ~0.08 above the table top
  const MAP_SURFACE_Y = 0.08;
  const BASE_SCALE = 1.25;

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
        <Asset assetId={meta.markerAssetId} />
        {/* invisible fattened hit area so small props are easy to click */}
        <mesh visible={false} position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.35, 8, 8]} />
          <meshBasicMaterial />
        </mesh>
      </group>
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
