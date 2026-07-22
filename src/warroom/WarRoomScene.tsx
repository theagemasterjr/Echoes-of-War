'use client';
import { CHAPTERS } from '@/chapters/registry';
import { useAppStore } from '@/state/appStore';
import { useProgressStore } from '@/state/progressStore';
import { Asset } from '@/assets/registry';
import { ChapterMarker } from './ChapterMarker';

/**
 * The tabletop war room. The map surface sits at y=0 (table top), markers are
 * map-local positions from the chapter registry. Background is deliberately a
 * dark void + fog — the real backdrop is a 2D dressing pass later.
 */
export function WarRoomScene() {
  const gotoChapter = useAppStore((s) => s.gotoChapter);
  const phase = useAppStore((s) => s.phase);
  const view = useAppStore((s) => s.view);
  const completed = useProgressStore((s) => s.completed);
  const interactive = phase === 'idle' && view.kind === 'map';

  return (
    <group>
      <fog attach="fog" args={['#0c0a08', 16, 34]} />
      <color attach="background" args={['#0c0a08']} />

      <ambientLight intensity={0.35} color="#ffe0b3" />
      {/* the lamp is the key light — a spotlight aimed at the map center (single
          shadow map: no cube-seam artifacts, cheaper than a point light) */}
      <spotLight
        position={[3.6, 4.6, 2.8]} angle={1.15} penumbra={0.55} intensity={110}
        color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#b8c4d6" />

      <Asset assetId="warroom.table" position={[0, -0.01, 0]} />
      <Asset assetId="warroom.map" position={[0, 0.005, 0]} />
      <Asset assetId="warroom.lamp" position={[7.0, 0, 3.7]} />

      {CHAPTERS.map((meta) => (
        <ChapterMarker
          key={meta.id}
          meta={meta}
          completed={completed.includes(meta.id)}
          disabled={!interactive}
          onSelect={() => gotoChapter(meta.id)}
        />
      ))}
    </group>
  );
}
