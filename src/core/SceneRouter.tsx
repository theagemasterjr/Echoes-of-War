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
      <ambientLight intensity={0.4} color="#c9d4e6" />
      <spotLight position={[2.2, 3.5, 2.8]} angle={0.5} penumbra={0.7} intensity={38} color="#ffe3b8" castShadow />
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

const PRESETS = {
  title: { pos: [0, 2.4, 11], target: [0, 1.2, 0] },
  map: { pos: [0, 7.6, 6.6], target: [0, 0, -0.4] },
  chapter: { pos: [0, 1.45, 5.2], target: [0, 0.95, 0] },
} as const;

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

  useEffect(() => {
    camera.position.set(...presetFor(useAppStore.getState().view).pos);
    target.current.set(...presetFor(useAppStore.getState().view).target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(target.current);

    if (phase === 'out' && pending) {
      if (view.kind === 'map' && pending.kind === 'chapter') {
        // dive toward the selected marker
        const [mx, , mz] = chapterMeta(pending.chapterId).markerPosition;
        gsap.to(camera.position, { x: mx, y: 1.7, z: mz + 1.4, duration: 1.15, ease: 'power2.in' });
        gsap.to(target.current, { x: mx, y: 0, z: mz, duration: 1.15, ease: 'power2.in' });
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

  useFrame(() => camera.lookAt(target.current));
  return null;
}
