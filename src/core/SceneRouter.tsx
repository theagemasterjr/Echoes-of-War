'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useAppStore, type View } from '@/state/appStore';
import { chapterMeta } from '@/chapters/registry';
import { WarRoomScene } from '@/warroom/WarRoomScene';
import { Asset } from '@/assets/registry';
import type { Beat, ChapterId } from '@/chapters/types';

/** Everything inside the single persistent <Canvas>. */
export function SceneRouter() {
  const view = useAppStore((s) => s.view);
  return (
    <>
      {view.kind === 'chapter' ? (
        <ChapterStage chapterId={view.chapterId} beat={view.beat} />
      ) : (
        <WarRoomScene />
      )}
      <CameraDirector />
    </>
  );
}

/** Shared 3D staging for every chapter beat: 2D backdrop + focal 3D element. */
function ChapterStage({ chapterId, beat }: { chapterId: ChapterId; beat: Beat }) {
  const meta = chapterMeta(chapterId);
  return (
    <group>
      <fog attach="fog" args={['#0a0c10', 8, 22]} />
      <color attach="background" args={['#0a0c10']} />
      <ambientLight intensity={0.55} color="#c9d4e6" />
      <spotLight position={[2.2, 3.5, 2.8]} angle={0.55} penumbra={0.7} intensity={48} color="#ffe3b8" castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#7d8aa3" />

      {/* 2D painted backdrop plane — founders swap the material/texture per chapter later */}
      <mesh position={[0, 2.2, -4.5]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#141821" roughness={1} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color="#191713" roughness={0.95} />
      </mesh>

      {beat === 'conversation' ? (
        <Float speed={1.4} rotationIntensity={0.04} floatIntensity={0.12} floatingRange={[0, 0.06]}>
          <Asset assetId={meta.characterAssetId} position={[0, 0, 0]} />
        </Float>
      ) : beat === 'overview' ? (
        /* showcase pedestal shot — the orbit camera slowly circles this */
        <group position={[0, ORBIT.target[1] - 0.45, 0]} scale={2.6}>
          <Float speed={1.1} rotationIntensity={0.05} floatIntensity={0.12}>
            <Asset assetId={meta.markerAssetId} />
          </Float>
        </group>
      ) : (
        <group position={[0, 0.55, 0]} scale={2.6}>
          <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.3}>
            <Asset assetId={meta.markerAssetId} />
          </Float>
        </group>
      )}
    </group>
  );
}

/** Marker Y sits just above the paper map surface — keep in sync with ChapterMarker.tsx. */
const MAP_SURFACE_Y = 0.085;
/** Seconds for the map→chapter dive — keep in sync with TransitionLayer's `enteringChapter` timeout and the .zoom-dive CSS duration. */
const DIVE_S = 2.2;

const PRESETS = {
  title: { pos: [0, 2.4, 11], target: [0, 1.2, 0] },
  map: { pos: [0, 7.6, 6.6], target: [0, 0, -0.4] },
  chapter: { pos: [0, 1.45, 5.2], target: [0, 0.95, 0] },
} as const;

/** Overview showcase: camera circles the object at a low hero angle. */
const ORBIT = {
  target: [0, 1.15, 0] as const,
  radius: 3.4,
  pitchDrop: 0.91, // radius * tan(15°) → camera sits ~15° below the object
  secondsPerLap: 30,
  screenShift: 0.85, // pushes the object left so the info panel owns the right
};

type Preset = { pos: readonly [number, number, number]; target: readonly [number, number, number] };

function presetFor(view: View): Preset {
  return view.kind === 'chapter' ? PRESETS.chapter : PRESETS[view.kind];
}

/**
 * Owns the camera. Dives toward a marker while the transition fades out, and
 * snaps to the destination preset the moment the view commits (hidden under
 * the black overlay). Title -> map glides in the open (no black).
 */
function CameraDirector() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...PRESETS.title.target));
  const view = useAppStore((s) => s.view);
  const pending = useAppStore((s) => s.pending);
  const phase = useAppStore((s) => s.phase);
  // "living camera": slow idle drift + mouse parallax, layered on top of the
  // gsap-owned base position (applied pre-render, removed next frame)
  const applied = useRef(new THREE.Vector3());
  const parallax = useRef({ x: 0, y: 0 });
  const amp = useRef(0);
  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    camera.position.set(...presetFor(useAppStore.getState().view).pos);
    target.current.set(...presetFor(useAppStore.getState().view).target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // bake the current drift/orbit offset into the base position so tweens
    // start from what's actually on screen (no snap), then reset the layer
    camera.position.add(applied.current);
    applied.current.set(0, 0, 0);
    amp.current = 0;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(target.current);

    if (phase === 'out' && pending) {
      if (view.kind === 'map' && pending.kind === 'chapter') {
        // slow, smooth dolly straight into the selected marker — no spin, no
        // sharp acceleration. The CSS zoom (.zoom-dive) covers the moment
        // the scene swaps underneath it, right as this settles on the icon.
        const meta = chapterMeta(pending.chapterId);
        const [mx, my, mz] = meta.markerPosition;
        const markerY = my + MAP_SURFACE_Y;
        gsap.to(camera.position, {
          x: mx, y: markerY + 0.55, z: mz + 0.6,
          duration: DIVE_S, ease: 'power2.inOut',
        });
        gsap.to(target.current, {
          x: mx, y: markerY + 0.15, z: mz,
          duration: DIVE_S, ease: 'power2.inOut',
        });
      } else if (view.kind === 'title') {
        // opening glide down onto the map — no black overlay for this one
        gsap.to(camera.position, { x: PRESETS.map.pos[0], y: PRESETS.map.pos[1], z: PRESETS.map.pos[2], duration: 1.6, ease: 'power2.inOut' });
        gsap.to(target.current, { x: PRESETS.map.target[0], y: PRESETS.map.target[1], z: PRESETS.map.target[2], duration: 1.6, ease: 'power2.inOut' });
      } else {
        // leaving a chapter: gentle pull back
        gsap.to(camera.position, { z: camera.position.z + 1.2, duration: 1.0, ease: 'power2.in' });
      }
    }

    if (phase === 'idle' || phase === 'titleCard' || phase === 'in') {
      // view has committed — place camera at its preset (hidden under overlay,
      // except title->map where the glide already landed here)
      const p = presetFor(view);
      if (phase !== 'in' || view.kind !== 'map') {
        camera.position.set(...p.pos);
        target.current.set(...p.target);
      }
      if (view.kind === 'map' && phase === 'in') {
        // returning to map: settle from slightly higher for a soft landing
        camera.position.set(p.pos[0], p.pos[1] + 0.7, p.pos[2] + 0.5);
        gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration: 1.2, ease: 'power2.out' });
        target.current.set(...p.target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, view, pending]);

  useFrame(({ clock, pointer }) => {
    // overview showcase: absolute orbit placement wins over presets/drift
    if (view.kind === 'chapter' && view.beat === 'overview' && phase !== 'out') {
      const t = clock.elapsedTime;
      const angle = reducedMotion.current ? 0.4 : (t * Math.PI * 2) / ORBIT.secondsPerLap;
      const [tx, ty, tz] = ORBIT.target;
      camera.position.set(
        tx + ORBIT.radius * Math.sin(angle),
        ty - ORBIT.pitchDrop,
        tz + ORBIT.radius * Math.cos(angle),
      );
      camera.lookAt(tx, ty, tz);
      camera.translateX(ORBIT.screenShift); // object left, panel right
      applied.current.set(0, 0, 0);
      amp.current = 0;
      return;
    }

    // remove last frame's offset (no-op if gsap overwrote the position — the
    // amplitude is eased to 0 during transitions so any residue is negligible)
    camera.position.sub(applied.current);

    const idleDrift = phase === 'idle' && view.kind !== 'chapter' && !reducedMotion.current;
    amp.current = THREE.MathUtils.lerp(amp.current, idleDrift ? 1 : 0, 0.03);

    const t = clock.elapsedTime;
    const p = parallax.current;
    p.x = THREE.MathUtils.lerp(p.x, pointer.x * 0.24, 0.04);
    p.y = THREE.MathUtils.lerp(p.y, -pointer.y * 0.12, 0.04);

    // slow sweep around the table (map only): rotate the camera's base offset
    // about the look target — wide pendulum, so the map never goes upside down
    let orbitX = 0;
    let orbitZ = 0;
    if (view.kind === 'map') {
      const theta = 0.4 * Math.sin((t * Math.PI * 2) / 70) * amp.current; // ±23°, 70s cycle
      const bx = camera.position.x - target.current.x;
      const bz = camera.position.z - target.current.z;
      orbitX = bx * Math.cos(theta) + bz * Math.sin(theta) - bx;
      orbitZ = -bx * Math.sin(theta) + bz * Math.cos(theta) - bz;
    }

    applied.current.set(
      orbitX + (Math.sin(t * 0.11) * 0.14 + Math.sin(t * 0.047 + 1.3) * 0.09 + p.x) * amp.current,
      (Math.sin(t * 0.073 + 2.1) * 0.05 + p.y) * amp.current,
      orbitZ + Math.sin(t * 0.059 + 0.7) * 0.06 * amp.current,
    );

    camera.position.add(applied.current);
    camera.lookAt(target.current);
  });
  return null;
}
