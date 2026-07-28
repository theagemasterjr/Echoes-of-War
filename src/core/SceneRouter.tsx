'use client';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Float, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useAppStore, type View } from '@/state/appStore';
import { chapterMeta, loadChapter } from '@/chapters/registry';
import { WarRoomScene } from '@/warroom/WarRoomScene';
import { ASSETS, Asset, assetIsAnimated } from '@/assets/registry';
import { useCharacterSpeaking } from '@/conversation/useCharacterSpeaking';
import { useModelPreload } from './useModelPreload';
import type { Beat, ChapterId } from '@/chapters/types';

/** Camera for chapters whose minigame plays in its own 3D scene (module
 *  exports MinigameScene + registry row sets minigameCamera); undefined for
 *  the shared DOM-over-floating-marker staging. */
const minigameCamera = (view: View) =>
  view.kind === 'chapter' && view.beat === 'minigame'
    ? chapterMeta(view.chapterId).minigameCamera
    : undefined;

/** Every shot in the game is composed for a 16:9 frame. */
const REF_ASPECT = 16 / 9;
const BASE_FOV = 45;
/** Ceiling for the widened angle: a very tall window (half-screen portrait)
 *  stops widening here and crops instead — past this the perspective goes
 *  fisheye. */
const MAX_FOV = 68;

/** Everything inside the single persistent <Canvas>. */
export function SceneRouter() {
  const view = useAppStore((s) => s.view);
  // predictive: warms the next screen's models so its transition never stalls
  useModelPreload();
  // Hold the horizontal composition on any window narrower than 16:9: keep the
  // 16:9 horizontal field of view by widening the vertical one, so nothing at
  // the sides is ever cropped away on laptops / non-maximized windows. Wider
  // windows keep the base vertical angle (they just see more at the sides).
  // Mutated during render, before the scenes below — their layout hooks read
  // camera.fov while rendering, so it must already be correct here.
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const aspect = width / Math.max(1, height);
  const fov =
    aspect >= REF_ASPECT
      ? BASE_FOV
      : Math.min(
          MAX_FOV,
          THREE.MathUtils.radToDeg(
            2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * (REF_ASPECT / aspect)),
          ),
        );
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  return (
    <>
      {view.kind === 'chapter' ? (
        minigameCamera(view) ? (
          <ChapterMinigameScene chapterId={view.chapterId} />
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

/** The chapter's own 3D minigame staging, lazy-loaded from its module (the
 *  module is already in flight for the DOM HUD, so this resolves instantly). */
function ChapterMinigameScene({ chapterId }: { chapterId: ChapterId }) {
  const Scene = useMemo(
    () => lazy(() => loadChapter(chapterId).then((m) => ({ default: m.default.MinigameScene! }))),
    [chapterId],
  );
  return (
    <Suspense fallback={null}>
      <Scene />
    </Suspense>
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
          {/* 2D painted backdrop plane — founders swap the material/texture per
              chapter later. Oversized so an ultrawide window never sees past
              its edges. */}
          <mesh position={[0, 2.2, -4.5]}>
            <planeGeometry args={[34, 10]} />
            <meshStandardMaterial color="#141821" roughness={1} />
          </mesh>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[34, 14]} />
            <meshStandardMaterial color="#191713" roughness={0.95} />
          </mesh>
        </>
      )}

      {beat === 'conversation' ? (
        <ConversationCharacter assetId={meta.characterAssetId} />
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

/** How far behind the camera's eye the backdrop hangs. Matches where the old
 *  fixed plane sat (z = -4.5 from the chapter camera), which is comfortably
 *  behind the character without the scene lights reaching it. */
const BACKDROP_DISTANCE = 9.75;

/** Full-frame photo behind the conversation stage; unlit, so the photo's own
 *  baked light reads as-is.
 *
 *  It hangs square to the camera and is resized every frame to exactly fill
 *  the frame at its depth. It used to be a fixed 16.5 x 8.8 rectangle sized
 *  for a 16:9 window — on a window of another shape (a wide one especially)
 *  the frame reached past its edges and the empty scene showed through as
 *  black bands. Fitting it to the camera makes that impossible at any size.
 *  The photo is cropped to fill, never stretched. */
function PhotoBackdrop({ url }: { url: string }) {
  const tex = useTexture(url);
  const mesh = useRef<THREE.Mesh>(null);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const at = useMemo(() => new THREE.Vector3(), []);

  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  useFrame(({ camera, viewport }) => {
    const m = mesh.current;
    if (!m) return;
    camera.getWorldDirection(eye);
    at.copy(camera.position).addScaledVector(eye, BACKDROP_DISTANCE);
    m.position.copy(at);
    m.quaternion.copy(camera.quaternion);

    const frame = viewport.getCurrentViewport(camera, at);
    m.scale.set(frame.width, frame.height, 1);

    // cover-crop: show the largest slice of the photo that fills the frame,
    // centred, so a wide window trims the top and bottom rather than
    // squashing the room
    const img = tex.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height && frame.height > 0) {
      const photo = img.width / img.height;
      const screen = frame.width / frame.height;
      if (screen > photo) tex.repeat.set(1, photo / screen);
      else tex.repeat.set(screen / photo, 1);
      tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
    }
  });

  return (
    <mesh ref={mesh}>
      <planeGeometry args={[1, 1]} />
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
/** Seconds for the map→chapter push-in — keep in sync with TransitionLayer's `enteringChapter` timeout and the .zoom-dive CSS duration. */
const DIVE_S = 2.2;
/** How far the push-in travels toward the marker (0 = no move, 1 = right onto
 *  it). Small on purpose: past ~0.35 the paper map visibly loses detail. */
const DIVE_AMOUNT = 0.26;

const PRESETS = {
  title: { pos: [0, 9, 21], target: [0, 7, 0] },
  map: { pos: [0, 7.6, 6.6], target: [0, 0, -0.4] },
  chapter: { pos: [0, 1.45, 5.2], target: [0, 0.95, 0] },
} as const;

type Preset = { pos: readonly [number, number, number]; target: readonly [number, number, number] };

function presetFor(view: View): Preset {
  const game = minigameCamera(view);
  if (game) return game;
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
        // A restrained push-in toward the chosen marker: the camera leans in
        // and commits to that spot, then the film takes over. Deliberately
        // stops well short of the map — pushing closer only reveals the
        // paper texture's resolution and the map goes soft.
        const [mx, my, mz] = chapterMeta(pending.chapterId).markerPosition;
        const markerY = my + MAP_SURFACE_Y;
        const near = (from: number, to: number) => from + (to - from) * DIVE_AMOUNT;
        gsap.to(camera.position, {
          x: near(camera.position.x, mx),
          y: near(camera.position.y, markerY + 1.1),
          z: near(camera.position.z, mz + 1.4),
          duration: DIVE_S, ease: 'power2.inOut',
        });
        gsap.to(target.current, {
          // the look-at travels further than the camera does, so the move
          // reads as "this place", not just "closer"
          x: near(target.current.x, mx) + (mx - target.current.x) * 0.35,
          y: near(target.current.y, markerY + 0.15),
          z: near(target.current.z, mz) + (mz - target.current.z) * 0.35,
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
    // 3D minigame scene: absolute placement every frame (immune to preset
    // races). Perfectly static — the view must never respond to the mouse,
    // only the pieces the player is dragging do.
    const game = minigameCamera(view);
    if (game && phase === 'idle') {
      const g = game;
      parallax.current.x = 0;
      parallax.current.y = 0;
      camera.position.set(g.pos[0], g.pos[1], g.pos[2]);
      camera.lookAt(g.target[0], g.target[1], g.target[2]);
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

    // barely-there sway around the table (map only): the camera leans a
    // touch to one side, then the other — idle life, never a tour
    let orbitX = 0;
    let orbitZ = 0;
    if (view.kind === 'map') {
      const theta = 0.045 * Math.sin((t * Math.PI * 2) / 26) * amp.current; // ±2.6°, 26s cycle
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
