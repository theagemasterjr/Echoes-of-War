'use client';
/**
 * Chapter 6 "The Voices" — the 3D board. Four pieces around a clear centre,
 * a slip stack at the near edge, and the paper crane that exists only in the
 * finale. All content and layout numbers come from ./voicesStore; every word
 * the player reads is DOM (VoicesMinigame) — no 3D text, ever.
 *
 * The camera is owned by SceneRouter: the chapter's registry row carries
 * `minigameCamera`, which pins the shot every frame and ignores the pointer.
 * This scene never touches the camera — it only reads it, for its own drag
 * raycast and for projecting label positions into screen space.
 *
 * Interaction is chapter-5's drag (pointer-down on the slip, a carry plane at
 * lift height, release anywhere decides) PLUS tap-to-select-then-tap-to-place:
 * a tap on the slip picks it up, a tap on a piece (or the centre) places it —
 * so the whole game works without a drag gesture.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS } from '@/assets/registry';
import {
  BOARD, FINALE, FINALE_REDUCED, VOICES, slipById, useVoicesStore, voiceById,
  type DropTarget, type ScreenLabel, type SlipId, type VoiceId,
} from './voicesStore';

/** Reduced motion, read once — the convention the war-room scenes use. When
 *  set: no bob, no shake, no rise; the crane and the lights simply appear. */
const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const TIMELINE = REDUCED ? FINALE_REDUCED : FINALE;

/* ── shared model plumbing (the ch5 pattern) ───────────────────────── */

function glbSource(assetId: string) {
  const src = ASSETS[assetId]?.source;
  return src?.kind === 'glb' ? src : null;
}

/** Minimal error boundary: a missing model costs the game a picture, never a
 *  turn. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Model({ assetId }: { assetId: string }) {
  const src = glbSource(assetId)!;
  const { scene } = useGLTF(src.url);
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).castShadow = true;
        (o as THREE.Mesh).receiveShadow = true;
      }
    });
    return root;
  }, [scene]);
  return (
    <primitive
      object={model}
      scale={src.scale ?? 1}
      position={src.offset ?? [0, 0.01, 0]}
      rotation={src.rotation ?? [0, 0, 0]}
    />
  );
}

function PieceModel({ assetId, fallbackSize = [0.4, 0.42, 0.4] as const }: {
  assetId: string;
  fallbackSize?: readonly [number, number, number];
}) {
  const fallback = (
    <mesh position={[0, fallbackSize[1] / 2, 0]} castShadow>
      <boxGeometry args={[...fallbackSize]} />
      <meshStandardMaterial color="#7a5c32" roughness={0.85} />
    </mesh>
  );
  if (!glbSource(assetId)) return fallback;
  return <ModelBoundary fallback={fallback}>{<Model assetId={assetId} />}</ModelBoundary>;
}

/* ── the scene ─────────────────────────────────────────────────────── */

export function VoicesScene() {
  const reset = useVoicesStore((s) => s.reset);
  const stage = useVoicesStore((s) => s.stage);
  const placedCount = useVoicesStore((s) => s.placedCount);
  const order = useVoicesStore((s) => s.order);
  const selected = useVoicesStore((s) => s.selected);
  const refused = useVoicesStore((s) => s.refused);
  const finaleAt = useVoicesStore((s) => s.finaleAt);
  const ninthRefusedAt = useVoicesStore((s) => s.ninthRefusedAt);

  // a fresh board every time the player arrives
  useEffect(() => reset(), [reset]);

  // warm every model the board needs, so nothing pops in late
  useEffect(() => {
    const ids = [...VOICES.map((v) => v.assetId), 'ch6.piece.crane', 'ch6.piece.slip'];
    for (const id of ids) {
      const src = glbSource(id);
      if (src) useGLTF.preload(src.url);
    }
  }, []);

  /* ── dragging (ch5's plumbing) ── */
  const dragPos = useRef(new THREE.Vector3(0, 0, BOARD.stackZ));
  const dragMoved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ live: boolean; target: DropTarget }>({ live: false, target: null });
  // our own raycaster, so following the pointer never disturbs the one
  // react-three-fiber uses for its own hover / click events
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const carry = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD.lift), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const targetUnder = (p: THREE.Vector3): DropTarget => {
    let best: DropTarget = null;
    let bestD = Infinity;
    for (const v of VOICES) {
      const d = Math.hypot(p.x - v.at[0], p.z - v.at[1]);
      if (d < BOARD.pieceRadius && d < bestD) {
        best = v.id;
        bestD = d;
      }
    }
    const dc = Math.hypot(p.x - BOARD.centre[0], p.z - BOARD.centre[1]);
    if (dc < BOARD.centreRadius && dc < bestD) best = 'centre';
    return best;
  };

  useFrame(({ camera, pointer }) => {
    if (!drag.current.live) return;
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(carry, hit)) {
      const nx = THREE.MathUtils.clamp(hit.x, -BOARD.sideX - 1.2, BOARD.sideX + 1.2);
      const nz = THREE.MathUtils.clamp(hit.z, BOARD.farZ - 1.0, BOARD.stackZ + 0.8);
      if (Math.hypot(nx - dragPos.current.x, nz - dragPos.current.z) > 0.12) dragMoved.current = true;
      dragPos.current.set(nx, 0, nz);
    }
    drag.current.target = targetUnder(dragPos.current);
  });

  // Releasing anywhere ends the drag. The store decides whether the slip
  // seats, bounces home, or simply goes back with nothing said.
  useEffect(() => {
    if (!dragging) return;
    const onUp = () => {
      const wasReal = dragMoved.current;
      const target = drag.current.target;
      drag.current = { live: false, target: null };
      setDragging(false);
      if (wasReal) useVoicesStore.getState().tryDrop(target);
      // a tap (no real movement) is handled by the slip's own click → select
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    if (finaleAt) return;
    e.stopPropagation();
    drag.current = { live: true, target: null };
    dragMoved.current = false;
    dragPos.current.set(e.point.x, 0, e.point.z);
    setDragging(true);
  };

  /* ── tap-to-select / tap-to-place ── */
  const slipTapped = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragMoved.current || finaleAt) return;
    useVoicesStore.getState().setSelected(!useVoicesStore.getState().selected);
  };
  const placeTapped = (target: DropTarget) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (dragMoved.current) return;
    if (useVoicesStore.getState().selected) useVoicesStore.getState().tryDrop(target);
  };

  /* ── which slip is live, and which are seated where ── */
  // once the finale begins the stack is empty: the ninth lives under the crane
  const liveSlipId: SlipId | undefined =
    finaleAt !== null ? undefined : stage === 'ninth' || placedCount < 8 ? order[placedCount] : undefined;
  const seated = order.slice(0, placedCount).map((id, i) => ({ id, i }));

  return (
    <group>
      <fog attach="fog" args={['#0c0a08', 9, 26]} />
      <color attach="background" args={['#0c0a08']} />
      <ambientLight intensity={0.5} color="#ffe0b3" />
      <spotLight position={[2.5, 6.5, 3.5]} angle={0.6} penumbra={0.8} intensity={140} color="#ffd9a0" castShadow />
      <directionalLight position={[-4, 5, -3]} intensity={0.5} color="#8d99b5" />

      {/* the bare war table */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0.2]}
        onClick={(e) => {
          e.stopPropagation();
          if (!dragMoved.current) useVoicesStore.getState().setSelected(false);
        }}
      >
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial color="#2a1d12" roughness={0.92} />
      </mesh>

      {/* the four voices */}
      {VOICES.map((v) => (
        <VoicePiece
          key={v.id}
          voiceId={v.id}
          refusedShake={refused && liveSlipId && refused.id === liveSlipId ? null : null}
          onTap={placeTapped(v.id)}
          finaleAt={finaleAt}
        />
      ))}

      {/* seated slips rest by the piece that owns them */}
      {seated.map(({ id, i }) => (
        <SeatedSlip key={id} slipId={id} dealIndex={i} />
      ))}

      {/* the live slip on the stack (or in the hand) */}
      {liveSlipId && (
        <LiveSlip
          slipId={liveSlipId}
          dragging={dragging}
          dragPos={dragPos}
          selected={selected}
          refused={refused?.id === liveSlipId ? refused : null}
          onPointerDown={startDrag}
          onClick={slipTapped}
          isNinth={liveSlipId === 'ninth'}
        />
      )}

      {/* the centre: refuses everything until the ninth slip, then takes it */}
      <Centre
        active={stage === 'ninth'}
        glowFrom={ninthRefusedAt}
        finaleAt={finaleAt}
        onTap={placeTapped('centre')}
      />

      {/* the crane exists only in the finale */}
      {finaleAt !== null && <Crane finaleAt={finaleAt} />}
      {finaleAt !== null && <FinaleLights finaleAt={finaleAt} />}

      <LabelProjector />
    </group>
  );
}

/* ── pieces ────────────────────────────────────────────────────────── */

function VoicePiece({ voiceId, onTap, finaleAt }: {
  voiceId: VoiceId;
  refusedShake: null;
  onTap: (e: ThreeEvent<MouseEvent>) => void;
  finaleAt: number | null;
}) {
  const v = voiceById(voiceId);
  const group = useRef<THREE.Group>(null);
  const refused = useVoicesStore((s) => s.refused);
  const stage = useVoicesStore((s) => s.stage);

  // the same gentle shake as a bounced slip, felt on the piece that refused it
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (REDUCED) {
      g.rotation.z = 0;
      return;
    }
    const age = refused && stage === 'ninth' ? performance.now() - refused.at : Infinity;
    g.rotation.z = age < 420 ? Math.sin(age / 26) * 0.06 * (1 - age / 420) : 0;
    void finaleAt;
  });

  return (
    <group ref={group} position={[v.at[0], 0, v.at[1]]}>
      {/* a low plinth so every piece reads as deliberately placed */}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.66, 0.025, 36]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
      </mesh>
      <PieceModel assetId={v.assetId} />
      {/* fat invisible grip: the tap-to-place target */}
      <mesh position={[0, 0.45, 0]} onClick={onTap}>
        <cylinderGeometry args={[0.9, 0.9, 1.1, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── slips ─────────────────────────────────────────────────────────── */

function SlipModel() {
  return <PieceModel assetId="ch6.piece.slip" fallbackSize={[0.32, 0.02, 0.42]} />;
}

function LiveSlip({ slipId, dragging, dragPos, selected, refused, onPointerDown, onClick, isNinth }: {
  slipId: SlipId;
  dragging: boolean;
  dragPos: React.RefObject<THREE.Vector3>;
  selected: boolean;
  refused: { id: SlipId; at: number } | null;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  isNinth: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  const born = useRef(performance.now());

  useEffect(() => {
    born.current = performance.now();
    snapped.current = false;
  }, [slipId]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const held = dragging || selected;
    const tx = dragging ? dragPos.current!.x : 0;
    const tz = dragging ? dragPos.current!.z : BOARD.stackZ;
    let ty = dragging ? BOARD.lift : held ? BOARD.lift * 0.75 : 0.05;
    if (!REDUCED && !dragging) ty += Math.sin(clock.elapsedTime * 1.6) * 0.015;

    if (!snapped.current || REDUCED) {
      g.position.set(tx, ty, tz);
      snapped.current = true;
    } else {
      // a small hop while travelling home, so a return reads as lift-and-place
      if (!dragging) ty += Math.min(0.26, Math.hypot(tx - g.position.x, tz - g.position.z) * 0.24);
      const k = 1 - Math.exp(-(dragging ? 24 : 9) * delta);
      g.position.x += (tx - g.position.x) * k;
      g.position.y += (ty - g.position.y) * k;
      g.position.z += (tz - g.position.z) * k;
    }

    // one small shake on the way home, so a wrong drop is felt as well as read
    const age = refused ? performance.now() - refused.at : Infinity;
    g.rotation.z = !REDUCED && age < 420 ? Math.sin(age / 26) * 0.13 * (1 - age / 420) : 0;

    // the ninth is dealt gently: it fades up out of the stack
    if (!REDUCED && isNinth) {
      const a = Math.min(1, (performance.now() - born.current) / 700);
      g.scale.setScalar(0.9 + 0.1 * a);
    } else {
      g.scale.setScalar(1);
    }
  });

  return (
    <group ref={group} position={[0, 0.05, BOARD.stackZ]}>
      {/* the rest of the stack, purely decorative */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[0.42, 0.035, 0.52]} />
        <meshStandardMaterial color="#b49b6d" roughness={0.95} />
      </mesh>
      <SlipModel />
      {/* fat invisible grip so small fingers can pick the slip up */}
      <mesh position={[0, 0.2, 0]} onPointerDown={onPointerDown} onClick={onClick}>
        <cylinderGeometry args={[0.55, 0.55, 0.6, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SeatedSlip({ slipId, dealIndex }: { slipId: SlipId; dealIndex: number }) {
  const slip = slipById(slipId);
  const v = slip.voice ? voiceById(slip.voice) : null;
  const seat = useMemo(() => {
    if (!v) return { x: BOARD.centre[0], z: BOARD.centre[1], rot: 0 };
    // slips rest in front of their piece, toward the centre, fanned slightly
    const toCentreX = v.at[0] > 0 ? -0.92 : 0.92;
    const second = dealIndex % 2 === 1 ? 0.34 : 0;
    return {
      x: v.at[0] + toCentreX,
      z: v.at[1] + 0.34 + second * 0.6,
      rot: (v.at[0] > 0 ? 1 : -1) * (0.12 + second * 0.3),
    };
  }, [v, dealIndex]);
  const group = useRef<THREE.Group>(null);
  const landAt = useRef(performance.now());

  useFrame(() => {
    const g = group.current;
    if (!g || REDUCED) return;
    // a 380 ms settle so a placed slip reads as laid down, not teleported
    const t = Math.min(1, (performance.now() - landAt.current) / 380);
    g.position.y = 0.02 + Math.sin(t * Math.PI) * 0.12;
  });

  return (
    <group ref={group} position={[seat.x, 0.02, seat.z]} rotation={[0, seat.rot, 0]}>
      <SlipModel />
    </group>
  );
}

/* ── the centre ────────────────────────────────────────────────────── */

function Centre({ active, glowFrom, finaleAt, onTap }: {
  active: boolean;
  glowFrom: number | null;
  finaleAt: number | null;
  onTap: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const glow = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = glow.current;
    if (!m) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    if (finaleAt !== null) {
      mat.opacity = Math.min(0.5, mat.opacity + 0.01);
      return;
    }
    if (!active || glowFrom === null) {
      mat.opacity = 0;
      return;
    }
    // a hint, not an instruction: a faint breathing warmth, only after the
    // first refusal has been felt
    const t = (performance.now() - glowFrom) / 1000;
    const ramp = Math.min(1, t / 2.5);
    mat.opacity = REDUCED ? 0.22 * ramp : (0.16 + Math.sin(t * 1.4) * 0.06) * ramp;
  });

  return (
    <group position={[BOARD.centre[0], 0, BOARD.centre[1]]}>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.62, 40]} />
        <meshBasicMaterial
          color="#ffd9a0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* the tap / drop landing area */}
      <mesh position={[0, 0.3, 0]} onClick={onTap}>
        <cylinderGeometry args={[0.8, 0.8, 0.7, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ── the finale ────────────────────────────────────────────────────── */

function Crane({ finaleAt }: { finaleAt: number }) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const age = (performance.now() - finaleAt) / 1000;
    const t = THREE.MathUtils.clamp(
      (age - TIMELINE.craneFrom) / Math.max(0.01, TIMELINE.craneTo - TIMELINE.craneFrom),
      0, 1,
    );
    const e = 1 - Math.pow(1 - t, 3); // ease-out — it rises, slows, and rests
    g.position.y = REDUCED ? 0.14 : -0.35 + e * 0.49;
    g.visible = REDUCED ? age >= 0 : true;
  });

  return (
    <group position={[BOARD.centre[0], -0.35, BOARD.centre[1]]}>
      <group ref={group}>
        <PieceModel assetId="ch6.piece.crane" fallbackSize={[0.36, 0.26, 0.44]} />
      </group>
      {/* the ninth slip settles beneath it */}
      <mesh position={[0, 0.03, 0.12]} rotation={[0, 0.06, 0]}>
        <boxGeometry args={[0.34, 0.015, 0.44]} />
        <meshStandardMaterial color="#cbb181" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** All four pieces light AT ONCE, and the crane with them. Warm, quiet, and
 *  held — no sting, no particles, no chime. The light is the entire payoff. */
function FinaleLights({ finaleAt }: { finaleAt: number }) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(() => {
    const age = (performance.now() - finaleAt) / 1000;
    const on = age >= TIMELINE.lightsAt;
    const ramp = REDUCED ? (on ? 1 : 0) : THREE.MathUtils.clamp((age - TIMELINE.lightsAt) / 0.5, 0, 1);
    for (const l of lights.current) {
      if (l) l.intensity = 3.2 * ramp;
    }
  });

  const spots: [number, number][] = [...VOICES.map((v) => [...v.at] as [number, number]), [...BOARD.centre] as [number, number]];
  return (
    <group>
      {spots.map(([x, z], i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
          position={[x, 1.1, z]}
          color="#ffcf9b"
          intensity={0}
          distance={3.2}
          decay={2}
        />
      ))}
    </group>
  );
}

/* ── label projection (the ch5 pattern: measured, change-gated) ────── */

function LabelProjector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setLabels = useVoicesStore((s) => s.setLabels);
  const last = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    last.current = '';
  }, [size.width, size.height]);

  useFrame(() => {
    const out: ScreenLabel[] = [];
    const project = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      return { left: ((v.x + 1) / 2) * 100, top: ((1 - v.y) / 2) * 100 };
    };
    // fade-in order is left to right: soldier, scientist, civilian, leader
    const orderOf: Record<VoiceId, number> = { soldier: 0, scientist: 1, civilian: 2, leader: 3 };
    for (const voice of VOICES) {
      const p = project(voice.at[0], 0.06, voice.at[1] + 0.92);
      out.push({
        id: voice.id,
        text: voice.label,
        note: voice.sub,
        left: p.left,
        top: p.top,
        order: orderOf[voice.id],
      });
    }
    // The strip lives in the top band, under the instruction and above the far
    // pieces — the ONE region that is clear at every window size. The bottom
    // band (ch5's choice) vanishes at short windows: the near-row labels, the
    // stack and the slip card leave no room there at 760×560 (measured).
    const stripTop = 17.5;

    // one update per real change, never one per frame
    const key =
      out.map((l) => `${l.id}:${l.left.toFixed(1)}:${l.top.toFixed(1)}`).join('|') +
      `#${stripTop.toFixed(1)}`;
    if (key !== last.current) {
      last.current = key;
      setLabels(out, stripTop);
    }
  });

  return null;
}
