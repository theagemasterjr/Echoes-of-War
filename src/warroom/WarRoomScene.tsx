'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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
  const prologueDone = useProgressStore((s) => s.prologueDone);
  const interactive = phase === 'idle' && view.kind === 'map';
  // the story reveals itself one chapter at a time: the first unfinished
  // chapter is "active" (bigger, hovering, battle effects); finished ones
  // stay on the map as quiet set pieces; the rest aren't out yet. Until the
  // prologue film is watched, the dagger is the only thing on the table.
  const activeId = prologueDone
    ? CHAPTERS.find((c) => !completed.includes(c.id))?.id
    : undefined;

  return (
    <group>
      <fog attach="fog" args={['#0c0a08', 16, 34]} />
      <color attach="background" args={['#0c0a08']} />

      <ambientLight intensity={0.35} color="#ffe0b3" />
      {/* the lamp is the key light — a spotlight aimed at the map center (single
          shadow map: no cube-seam artifacts, cheaper than a point light) */}
      <FlickeringLamp />
      <DustMotes />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#b8c4d6" />

      <Asset assetId="warroom.table" position={[0, -0.01, 0]} />
      <Asset assetId="warroom.map" position={[0, 0.005, 0]} />

      {CHAPTERS.filter((meta) => completed.includes(meta.id) || meta.id === activeId).map(
        (meta) => (
          <ChapterMarker
            key={meta.id}
            meta={meta}
            completed={completed.includes(meta.id)}
            active={meta.id === activeId}
            disabled={!interactive}
            showLabel={view.kind === 'map'}
            onSelect={() => gotoChapter(meta.id)}
          />
        ),
      )}
    </group>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The lamp bulb wavers like a real 1940s incandescent — layered slow sines
 *  with an occasional deeper dip. Intensity only: moving the light would make
 *  the shadows swim. */
function FlickeringLamp() {
  const light = useRef<THREE.SpotLight>(null);
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    if (!light.current || still) return;
    const t = clock.elapsedTime;
    const dip = Math.max(0, Math.sin(t * 0.31) - 0.97) * 1.6; // rare soft dips
    light.current.intensity =
      110 * (1 + 0.025 * Math.sin(t * 9.4) + 0.018 * Math.sin(t * 23.7 + 1.4) - dip);
  });
  return (
    <spotLight
      ref={light}
      position={[3.6, 4.6, 2.8]} angle={1.15} penumbra={0.55} intensity={110}
      color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
    />
  );
}

const MOTE_COUNT = 90;
/** Faint dust drifting through the lamp beam over the map. */
function DustMotes() {
  const points = useRef<THREE.Points>(null);
  const still = useMemo(prefersReducedMotion, []);
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(MOTE_COUNT * 3);
    const seeds = new Float32Array(MOTE_COUNT * 2);
    for (let i = 0; i < MOTE_COUNT; i++) {
      positions[i * 3] = THREE.MathUtils.randFloat(-3.5, 4.5);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0.15, 3.6);
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-2.6, 3);
      seeds[i * 2] = Math.random() * Math.PI * 2; // sway phase
      seeds[i * 2 + 1] = THREE.MathUtils.randFloat(0.015, 0.05); // fall speed
    }
    return { positions, seeds };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!points.current || still) return;
    const t = clock.elapsedTime;
    const pos = points.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const phase = seeds[i * 2];
      arr[i * 3] += Math.sin(t * 0.3 + phase) * 0.012 * delta * 60;
      arr[i * 3 + 1] -= seeds[i * 2 + 1] * delta;
      arr[i * 3 + 2] += Math.cos(t * 0.23 + phase) * 0.009 * delta * 60;
      if (arr[i * 3 + 1] < 0.1) arr[i * 3 + 1] = 3.6; // recycle settled dust
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffe4b8" size={0.028} sizeAttenuation transparent opacity={0.55}
        blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </points>
  );
}
