'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useProgress } from '@react-three/drei';
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
      <LoadingVeil />

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

const LOAD_VEIL_FADE_MS = 650;
/** Hard ceiling in case loading never actually settles (a stalled fetch,
 *  say) — the map must never stay hidden behind the veil forever. */
const LOAD_VEIL_MAX_WAIT_MS = 4000;

/** Loading veil for the map's first paint: the table/map GLBs (and whichever
 *  chapter marker is active) load asynchronously and used to pop straight in
 *  the instant each one was ready. This tracks three.js's shared loading
 *  manager (what useGLTF reports through via drei's useProgress) and fades a
 *  DOM veil out once everything queued at mount has resolved. Only the first
 *  settle counts — once faded it's gone for good, so an unrelated background
 *  load later (e.g. hovering a marker prefetches its intro video) never
 *  brings the veil back over an already-visible map. */
function LoadingVeil() {
  const { active } = useProgress();
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const settled = useRef(false);

  const settle = () => {
    if (settled.current) return;
    settled.current = true;
    setFading(true);
    setTimeout(() => setGone(true), LOAD_VEIL_FADE_MS);
  };

  // hard ceiling, set once — never postponed by later loading activity
  useEffect(() => {
    const hardStop = setTimeout(settle, LOAD_VEIL_MAX_WAIT_MS);
    return () => clearTimeout(hardStop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active) return;
    // let anything that started loading in this same tick register as
    // `active` before deciding the scene is actually already ready
    const check = setTimeout(() => {
      if (!useProgress.getState().active) settle();
    }, 80);
    return () => clearTimeout(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (gone) return null;
  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 30 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0c0a08',
          opacity: fading ? 0 : 1,
          transition: `opacity ${LOAD_VEIL_FADE_MS}ms ease-out`,
        }}
      />
    </Html>
  );
}

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
/** Faint dust hanging in the lamp beam over the map — each mote hovers in
 *  place around its own anchor point on small independent sine waves, rather
 *  than drifting/falling and jumping back to the top once it settles. Being
 *  a function of elapsed time (not an accumulated velocity), the motion is
 *  self-bounded: nothing can wander off or scatter outward, and there's
 *  never a "recycle" pop. */
function DustMotes() {
  const points = useRef<THREE.Points>(null);
  const still = useMemo(prefersReducedMotion, []);
  const { positions, anchors, seeds } = useMemo(() => {
    const positions = new Float32Array(MOTE_COUNT * 3);
    const anchors = new Float32Array(MOTE_COUNT * 3);
    const seeds = new Float32Array(MOTE_COUNT * 2);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const x = THREE.MathUtils.randFloat(-3.5, 4.5);
      const y = THREE.MathUtils.randFloat(0.15, 3.6);
      const z = THREE.MathUtils.randFloat(-2.6, 3);
      anchors[i * 3] = x;
      anchors[i * 3 + 1] = y;
      anchors[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      seeds[i * 2] = Math.random() * Math.PI * 2; // bob phase
      seeds[i * 2 + 1] = THREE.MathUtils.randFloat(0.06, 0.16); // bob speed
    }
    return { positions, anchors, seeds };
  }, []);

  useFrame(({ clock }) => {
    if (!points.current || still) return;
    const t = clock.elapsedTime;
    const pos = points.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const phase = seeds[i * 2];
      const speed = seeds[i * 2 + 1];
      arr[i * 3] = anchors[i * 3] + Math.sin(t * speed + phase) * 0.09;
      arr[i * 3 + 1] = anchors[i * 3 + 1] + Math.sin(t * speed * 0.8 + phase * 1.7) * 0.05;
      arr[i * 3 + 2] = anchors[i * 3 + 2] + Math.cos(t * speed + phase) * 0.09;
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
