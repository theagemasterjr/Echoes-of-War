'use client';
import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ChapterMeta } from '@/chapters/types';
import { Asset } from '@/assets/registry';

export function ChapterMarker({
  meta, completed, onSelect, disabled,
}: {
  meta: ChapterMeta;
  completed: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [x, y, z] = meta.markerPosition;

  return (
    <group position={[x, y + 0.005, z]}>
      <group
        scale={hovered && !disabled ? 1.25 : 1}
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
      {hovered && !disabled && (
        <Html position={[0, 0.55, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div className="w-52 rounded-md border border-amber-100/20 bg-stone-950/90 px-3 py-2 text-stone-100 shadow-xl backdrop-blur-sm">
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
