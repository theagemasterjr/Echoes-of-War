'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useAppStore, type View } from '@/state/appStore';
import { chapterMeta } from '@/chapters/registry';
import { WarRoomScene } from '@/warroom/WarRoomScene';
import { TimelineTableScene } from '@/chapters/ch1/TimelineTableScene';
import { ASSETS, Asset, assetIsAnimated } from '@/assets/registry';
import { useCharacterSpeaking } from '@/conversation/useCharacterSpeaking';
import type { Beat, ChapterId } from '@/chapters/types';

/** Chapters whose minigame plays in 3D on the war-room table (instead of the
 *  shared DOM-over-floating-marker staging). */
const tableMinigame = (view: View) =>
  view.kind === 'chapter' && view.beat === 'minigame' && view.chapterId === 'ch1';

/** Everything inside the single persistent <Canvas>. */
export function SceneRouter() {
  const view = useAppStore((s) => s.view);
  return (
    <>
      {view.kind === 'chapter' ? (
        tableMinigame(view) ? (
          <TimelineTableScene />
        ) : (
          <ChapterStage chapterId={view.chapterId} beat={view.beat} />
        )
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
  const photo = beat === 'conversation' ? meta.conversationBackdrop : undefined;
  // warm the conversation assets while the player reads the overview / watches
  // the intro, so the character doesn't pop in late
  useEffect(() => {
    const src = ASSETS[meta.characterAssetId]?.source;
    if (src?.kind === 'glb') useGLTF.preload(src.url);
    if (meta.conversationBackdrop) useTexture.preload(meta.conversationBackdrop);
  }, [meta]);
  return (
    <group>
      <fog attach="fog" args={['#0a0c10', 8, 22]} />
      <color attach="background" args={['#0a0c10']} />
      <ambientLight intensity={0.55} color="#c9d4e6" />
      <spotLight position={[2.2, 3.5, 2.8]} angle={0.55} penumbra={0.7} intensity={48} color="#ffe3b8" castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#7d8aa3" />

      {photo ? (
        /* chapter-provided photo fills the whole frame behind the character */
        <Suspense fallback={null}>
          <PhotoBackdrop url={photo} />
        </Suspense>
      ) : (
        <>
          {/* 2D painted backdrop plane — founders swap the material/texture per chapter later */}
          <mesh position={[0, 2.2, -4.5]}>
            <planeGeometry args={[16, 8]} />
            <meshStandardMaterial color="#141821" roughness={1} />
          </mesh>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[20, 14]} />
            <meshStandardMaterial color="#191713" roughness={0.95} />
          </mesh>
        </>
      )}

      {beat === 'conversation' ? (
        <ConversationCharacter assetId={meta.characterAssetId} />
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

/** Full-frame photo behind the conversation stage. Sized to cover the chapter
 *  camera's view at its depth (frame there is ~14.3 x 8.05 on a 16:9 window);
 *  unlit so the photo's own baked light reads as-is. */
function PhotoBackdrop({ url }: { url: string }) {
  const tex = useTexture(url);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);
  return (
    <mesh position={[0, 0.95, -4.5]}>
      <planeGeometry args={[16.5, 8.8]} />
      <meshBasicMaterial map={tex} fog={false} />
    </mesh>
  );
}

/** The character during the live conversation. Animated models are grounded
 *  (their idle clip carries the life); placeholder busts keep the gentle Float. */
function ConversationCharacter({ assetId }: { assetId: string }) {
  const talking = useCharacterSpeaking();
  if (assetIsAnimated(assetId)) {
    return <Asset assetId={assetId} position={[0, 0, 0]} talking={talking} />;
  }
  return (
    <Float speed={1.4} rotationIntensity={0.04} floatIntensity={0.12} floatingRange={[0, 0.06]}>
      <Asset assetId={assetId} position={[0, 0, 0]} />
    </Float>
  );
}

/** Marker Y sits just above the paper map surface — keep in sync with ChapterMarker.tsx. */
const MAP_SURFACE_Y = 0.085;
/** Seconds for the map→chapter dive — keep in sync with TransitionLayer's `enteringChapter` timeout and the .zoom-dive CSS duration. */
const DIVE_S = 2.2;

const PRESETS = {
  title: { pos: [0, 9, 21], target: [0, 7, 0] },
  map: { pos: [0, 7.6, 6.6], target: [0, 0, -0.4] },
  chapter: { pos: [0, 1.45, 5.2], target: [0, 0.95, 0] },
  /** Across the war-room table for the ch1 tabletop minigame — nearly level
   *  (~9° down), zoomed close on the single figure row. */
  tableGame: { pos: [0, 1.7, 6.6], target: [0, 0.55, -0.3] },
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
  if (tableMinigame(view)) return PRESETS.tableGame;
  if (view.kind === 'chapter') return PRESETS.chapter;
  // the prologue video covers the screen; the camera waits at the title shot
  // so the glide down to the map can play when the film ends
  if (view.kind === 'prologue') return PRESETS.title;
  return PRESETS[view.kind];
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
  /** current + previous view kind, so 'in' can tell a title arrival (glide
   *  already landed) from a chapter return (needs the settle) */
  const viewTrail = useRef<{ prev: View['kind']; curr: View['kind'] }>({ prev: 'title', curr: 'title' });
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
    // start from what's actually on screen: the offset is already applied to
    // the camera — zeroing the layer keeps it there (adding it again would
    // double it and cause a visible jump the moment a transition starts)
    applied.current.set(0, 0, 0);
    amp.current = 0;

    if (view.kind !== viewTrail.current.curr) {
      viewTrail.current = { prev: viewTrail.current.curr, curr: view.kind };
    }

    if (phase === 'out' && pending) {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(target.current);
      if (view.kind === 'map' && pending.kind === 'chapter') {
        // slow, smooth dolly straight into the selected marker — no spin, no
        // sharp acceleration. The CSS zoom (.zoom-dive) covers the moment
        // the scene swaps underneath it, right as this settles on the icon.
        const [mx, my, mz] = chapterMeta(pending.chapterId).markerPosition;
        const markerY = my + MAP_SURFACE_Y;
        gsap.to(camera.position, {
          x: mx, y: markerY + 0.9, z: mz + 1.15, // eye-tuned: gentler arrival, not blurry-close
          duration: DIVE_S, ease: 'power2.inOut',
        });
        gsap.to(target.current, {
          x: mx, y: markerY + 0.15, z: mz,
          duration: DIVE_S, ease: 'power2.inOut',
        });
      } else if (
        (view.kind === 'title' || view.kind === 'prologue') &&
        pending.kind === 'map'
      ) {
        // opening glide down onto the map — no black overlay for this one.
        // Runs after the title text (or the prologue film) fades out; the
        // delay lets that fade finish before anything moves. Keep delay +
        // duration in sync with TransitionLayer's glideToMap ms.
        gsap.to(camera.position, { x: PRESETS.map.pos[0], y: PRESETS.map.pos[1], z: PRESETS.map.pos[2], duration: 1.7, delay: 1.0, ease: 'power2.inOut' });
        gsap.to(target.current, { x: PRESETS.map.target[0], y: PRESETS.map.target[1], z: PRESETS.map.target[2], duration: 1.7, delay: 1.0, ease: 'power2.inOut' });
      } else if (view.kind !== 'title' && view.kind !== 'prologue') {
        // leaving a chapter: gentle pull back
        gsap.to(camera.position, { z: camera.position.z + 1.2, duration: 1.0, ease: 'power2.in' });
      }
    }

    if (phase === 'titleCard') {
      // hidden under the black overlay — safe to jump straight to the preset
      const p = presetFor(view);
      gsap.killTweensOf(camera.position);
      camera.position.set(...p.pos);
      target.current.set(...p.target);
    }

    if (phase === 'in') {
      const p = presetFor(view);
      if (view.kind === 'map') {
        if (viewTrail.current.prev === 'chapter') {
          // returning to map: settle from slightly higher for a soft landing
          gsap.killTweensOf(camera.position);
          camera.position.set(p.pos[0], p.pos[1] + 0.7, p.pos[2] + 0.5);
          gsap.to(camera.position, { x: p.pos[0], y: p.pos[1], z: p.pos[2], duration: 1.2, ease: 'power2.out' });
          target.current.set(...p.target);
        }
        // arriving from the title: the opening glide already landed exactly
        // here (and may still be finishing) — don't touch the camera
      } else {
        gsap.killTweensOf(camera.position);
        camera.position.set(...p.pos);
        target.current.set(...p.target);
      }
    }

    if (phase === 'idle') {
      // catch instant jumps (debug menu) without cutting a still-running
      // glide/settle tween short — only snap when actually out of place
      const p = presetFor(view);
      if (
        !gsap.isTweening(camera.position) &&
        camera.position.distanceTo(new THREE.Vector3(...p.pos)) > 0.6
      ) {
        camera.position.set(...p.pos);
        target.current.set(...p.target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, view, pending]);

  useFrame(({ clock, pointer }) => {
    // tabletop minigame: absolute placement every frame (immune to preset
    // races) + a slight lean with the mouse
    if (tableMinigame(view) && phase === 'idle') {
      const g = PRESETS.tableGame;
      const p = parallax.current;
      const still = reducedMotion.current;
      p.x = THREE.MathUtils.lerp(p.x, still ? 0 : pointer.x * 0.65, 0.05);
      p.y = THREE.MathUtils.lerp(p.y, still ? 0 : -pointer.y * 0.35, 0.05);
      camera.position.set(g.pos[0] + p.x, g.pos[1] + p.y, g.pos[2]);
      camera.lookAt(g.target[0], g.target[1], g.target[2]);
      applied.current.set(0, 0, 0);
      amp.current = 0;
      return;
    }

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
