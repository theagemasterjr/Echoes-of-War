'use client';
/**
 * Chapter 4 minigame, 3D staging — the war-room table with the red-stained map
 * on it, the pieces the player lays out, and the scripted close of the ring.
 *
 * No text lives in here. Every word the player reads is plain 2D DOM in
 * UranusMinigame.tsx, including the labels beside the pieces: this scene
 * measures where each labelled piece lands on screen and publishes it
 * (uranusStore.labels), so a label holds one readable size whatever the camera
 * does and follows the easy-read font setting like every other word in the game.
 * That is the founder's rule from chapter 1 — never in-scene 3D text.
 *
 * The map is ONE mesh sampling BOTH supplied images (identical framing, pixel
 * for pixel). Phase 3's wipe mixes between them inside the material, so there is
 * nothing to misalign and no second plane to ghost against: the red simply
 * drains away behind the blue wave. If a future three.js renames the shader
 * chunks this patches, the map still draws — red and whole — and the ring still
 * closes, so the chapter always finishes.
 *
 * The camera is owned by SceneRouter and is perfectly still during a minigame;
 * nothing here touches it. Rules and content live in uranusStore.ts.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS, Asset } from '@/assets/registry';
import {
  FRONT_LINE, MAP, PIECES, RING_NORTH, RING_SOUTH, SCENERY, SLOTS, SWEEPS, TRAY_Z,
  liveSlots, mapToWorld, pieceById, trayPieces, useUranusStore,
  type MapPoint, type Piece, type PieceId, type Scenery, type Slot,
} from './uranusStore';

/** How high a held piece rides. Small on purpose: the pointer is followed on a
 *  plane at this height, so a held piece sits exactly under the cursor. */
const LIFT = 0.34;
/** Table height of the drawn lines — just clear of the paper. */
const LINE_Y = MAP.y + 0.022;
/** The base every playing piece stands on (the models have none of their own). */
const BASE_R = 0.22;
/** Spacing of the pieces waiting at the near edge. */
const TRAY_GAP = 1.5;

/* ── the scripted close, in seconds after the last hammer lands ── */
const SEAL = {
  sweepFrom: 0.0, sweepTo: 1.4,
  ringFrom: 0.9, ringTo: 2.6,
  waveFrom: 1.5, waveTo: 4.5,
  settleTo: 5.2,
  done: 5.4,
} as const;

/* ── phase 2's entrance, in seconds after the phase begins ── */
const ENTER = {
  line: 1.1,
  city: 1.2,
  german: [1.7, 1.95, 2.2],
  allyLeft: 2.7,
  allyRight: 3.0,
  tray: 3.3,
} as const;
const LAND_S = 0.55;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 0→1 across [from, to]. */
const span = (t: number, from: number, to: number) => smooth((t - from) / (to - from));

/** A .glb's registry row (url + scale + offset), or null if that id is not a file. */
function glbSource(assetId: string) {
  const src = ASSETS[assetId]?.source;
  return src?.kind === 'glb' ? src : null;
}

/** When each static piece lands: the city first, then the three German pieces
 *  clustering in around it, then one ally on each flank. */
function sceneryDelay(piece: Scenery, index: number): number {
  if (piece.id === 'city') return ENTER.city;
  if (piece.id === 'ally-left') return ENTER.allyLeft;
  if (piece.id === 'ally-right') return ENTER.allyRight;
  return ENTER.german[Math.min(Math.max(index - 1, 0), ENTER.german.length - 1)];
}

export function UranusTableScene() {
  const reset = useUranusStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // a fresh board every time the player arrives

  const phase = useUranusStore((s) => s.phase);
  const placed = useUranusStore((s) => s.placed);
  const seal = useUranusStore((s) => s.seal);
  const setSeal = useUranusStore((s) => s.setSeal);
  const tray = trayPieces(phase, placed);
  const glowing = liveSlots(phase, placed);
  const board = phase !== 'why';

  // warm every model the board needs, so nothing pops in late
  useEffect(() => {
    const ids = new Set([...PIECES.map((p) => p.assetId), ...SCENERY.map((s) => s.assetId)]);
    for (const id of ids) {
      const src = glbSource(id);
      if (src) useGLTF.preload(src.url);
    }
  }, []);

  /* ── clocks: how long this phase has run, and how far the close has got ── */
  const phaseAge = useRef(0);
  const sealAge = useRef(0);
  useEffect(() => {
    phaseAge.current = 0;
  }, [phase]);

  /** The hammers of phase 2 wait until the board has finished assembling. */
  const [trayIn, setTrayIn] = useState(true);
  useEffect(() => {
    if (phase !== 'strike') {
      setTrayIn(true);
      return;
    }
    setTrayIn(false);
    const t = setTimeout(() => setTrayIn(true), ENTER.tray * 1000);
    return () => clearTimeout(t);
  }, [phase]);

  /* ── dragging ── */
  const dragPos = useRef(new THREE.Vector3(0, 0, TRAY_Z));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ id: string; at: number } | null>(null);
  const drag = useRef<{ id: PieceId | null; hover: string | null }>({ id: null, hover: null });
  // our own raycaster, so following the pointer never disturbs the one
  // react-three-fiber uses for its own hover / click events
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const carry = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  /** The glowing slot a held piece is over, or null for open table. Generous on
   *  purpose: a release anywhere near a slot counts as a release into it. */
  const slotUnder = (p: THREE.Vector3): string | null => {
    const { phase: ph, placed: pl } = useUranusStore.getState();
    let best: { id: string; d: number } | null = null;
    for (const slot of liveSlots(ph, pl)) {
      const [sx, , sz] = mapToWorld(slot.at);
      const d = Math.hypot(p.x - sx, p.z - sz);
      if (d <= slot.radius && (!best || d < best.d)) best = { id: slot.id, d };
    }
    return best?.id ?? null;
  };

  useFrame(({ camera, pointer }, delta) => {
    phaseAge.current += delta;
    if (useUranusStore.getState().seal !== 'idle') sealAge.current += delta;

    if (!drag.current.id) return;
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(carry, hit)) {
      dragPos.current.set(
        THREE.MathUtils.clamp(hit.x, -MAP.w / 2 - 0.5, MAP.w / 2 + 0.5),
        0,
        THREE.MathUtils.clamp(hit.z, MAP.z - MAP.d / 2 - 0.4, TRAY_Z + 0.7),
      );
    }
    const over = slotUnder(dragPos.current);
    if (over !== drag.current.hover) {
      drag.current.hover = over;
      setHoverSlot(over);
    }
  });

  // Releasing anywhere ends the drag: a slot that takes the piece seats it,
  // anything else floats the piece home while Nikolai says why.
  useEffect(() => {
    if (!draggingId) return;
    const onUp = () => {
      const { id, hover } = drag.current;
      if (id && !useUranusStore.getState().tryDrop(id, hover)) {
        setRefused({ id, at: performance.now() });
      }
      drag.current = { id: null, hover: null };
      setDraggingId(null);
      setHoverSlot(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId]);

  const startDrag = (id: PieceId, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    drag.current = { id, hover: null };
    dragPos.current.set(e.point.x, 0, e.point.z);
    setRefused(null);
    setHoverSlot(null);
    setDraggingId(id);
  };

  /* ── the close: two milestones, so the scene never writes state per frame.
        Keyed on "has it started", so the milestones it schedules are not
        cancelled by the state changes they themselves cause. ── */
  const sealing = seal !== 'idle';
  useEffect(() => {
    if (!sealing) return;
    const drain = setTimeout(() => setSeal('draining'), SEAL.waveFrom * 1000);
    const done = setTimeout(() => setSeal('sealed'), SEAL.done * 1000);
    return () => {
      clearTimeout(drain);
      clearTimeout(done);
    };
  }, [sealing, setSeal]);

  /* ── labels: gathered here, drawn as DOM ── */
  useLabelProjection(phaseAge);

  return (
    <group>
      {/* same room mood as the war-room home screen: warm amber from the upper
          left, cool fill from behind */}
      <fog attach="fog" args={['#0c0a08', 18, 40]} />
      <color attach="background" args={['#0c0a08']} />
      <ambientLight intensity={0.42} color="#ffe0b3" />
      <spotLight
        position={[-4.2, 6.4, 3.2]} angle={1.15} penumbra={0.55} intensity={150}
        color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight position={[5, 7, -5]} intensity={0.45} color="#b8c4d6" />
      <pointLight position={[0, 3.2, MAP.z]} intensity={16} distance={12} decay={2} color="#ffd9a0" />

      <Asset assetId="warroom.table" position={[0, -0.01, 0]} />
      <MapPaper sealAge={sealAge} />

      {/* the front line, drawing itself as phase 2 opens */}
      {board && (
        <DrawnLine
          points={FRONT_LINE} color="#8d3b2a" radius={0.026}
          from={0} to={ENTER.line} clock={phaseAge} runOnce
        />
      )}

      {/* the ring: two arms growing from the river side to meet behind the city */}
      {sealing && (
        <>
          <DrawnLine points={RING_NORTH} color="#6ea8e6" radius={0.036} from={SEAL.ringFrom} to={SEAL.ringTo} clock={sealAge} glow />
          <DrawnLine points={RING_SOUTH} color="#6ea8e6" radius={0.036} from={SEAL.ringFrom} to={SEAL.ringTo} clock={sealAge} glow />
        </>
      )}

      {glowing.map((slot) => (
        <SlotGlow key={slot.id} slot={slot} lit={hoverSlot === slot.id} />
      ))}

      {board &&
        SCENERY.map((piece, i) => (
          <SceneryPiece key={piece.id} piece={piece} delay={sceneryDelay(piece, i)} clock={phaseAge} sealAge={sealAge} />
        ))}

      {/* the pieces that can be lifted: only ever this phase's own */}
      {trayIn &&
        tray.map((piece, i) => (
          <TrayPiece
            key={piece.id}
            piece={piece}
            x={(i - (tray.length - 1) / 2) * TRAY_GAP}
            bobSeed={i}
            dragging={draggingId === piece.id}
            dragPos={dragPos}
            refused={refused?.id === piece.id ? refused : null}
            onPointerDown={startDrag}
          />
        ))}

      {/* pieces already seated, including the two that sweep round as it closes */}
      {SLOTS.filter((s) => placed[s.id]).map((slot) => (
        <SeatedPiece key={slot.id} slot={slot} pieceId={placed[slot.id]} sealAge={sealAge} />
      ))}
    </group>
  );
}

/* ───────────────────────────── the map itself ───────────────────────────── */

/**
 * The paper on the table.
 *
 * One mesh, two textures. The material is a standard lit material — so the
 * paper takes the room's warm light like every other surface — with its map
 * sampling patched to mix between the red-stained image and the clean one.
 * `uWipe` walks a front from the eastern edge westward, the direction the
 * counter-attack came from, and behind it the red drains away; `uGlow` rides a
 * blue wave on that same front, so the wave and the wipe are one edge and
 * cannot disagree by a pixel.
 */
function MapPaper({ sealAge }: { sealAge: React.RefObject<number> }) {
  const [red, clean] = useTexture(['/img/ch4-map-red.jpg', '/img/ch4-map-clean.jpg']);

  useMemo(() => {
    for (const t of [red, clean]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.needsUpdate = true;
    }
  }, [red, clean]);

  const uniforms = useMemo(
    () => ({ uClean: { value: clean }, uWipe: { value: 0 }, uGlow: { value: 0 } }),
    [clean],
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: red, roughness: 0.94, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uClean = uniforms.uClean;
      shader.uniforms.uWipe = uniforms.uWipe;
      shader.uniforms.uGlow = uniforms.uGlow;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uClean;
uniform float uWipe;
uniform float uGlow;
// The wipe front, bowed east where the ring closes, so it reads as a wave
// coming round the city rather than a ruler sliding across the paper.
float eowFront( float v ) { return ( 1.05 - uWipe * 1.10 ) + 0.05 * sin( v * 3.14159 ); }`,
        )
        .replace(
          '#include <map_fragment>',
          `vec4 eowRed = texture2D( map, vMapUv );
vec4 eowClean = texture2D( uClean, vMapUv );
float eowMix = smoothstep( eowFront( vMapUv.y ) - 0.012, eowFront( vMapUv.y ) + 0.012, vMapUv.x );
diffuseColor *= mix( eowRed, eowClean, eowMix );`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
{
  float eowBand = exp( -pow( ( vMapUv.x - eowFront( vMapUv.y ) ) / 0.030, 2.0 ) );
  totalEmissiveRadiance += vec3( 0.22, 0.46, 0.92 ) * eowBand * uGlow;
}`,
        );
    };
    return m;
  }, [red, uniforms]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const idle = useUranusStore.getState().seal === 'idle';
    const t = idle ? 0 : sealAge.current;
    uniforms.uWipe.value = span(t, SEAL.waveFrom, SEAL.waveTo);
    // the wave lights up as it sets off and fades once it has crossed
    uniforms.uGlow.value = idle
      ? 0
      : span(t, SEAL.waveFrom - 0.2, SEAL.waveFrom + 0.4) * (1 - span(t, SEAL.waveTo - 0.3, SEAL.settleTo));
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, MAP.y, MAP.z]} material={material} receiveShadow>
      <planeGeometry args={[MAP.w, MAP.d]} />
    </mesh>
  );
}

/* ────────────────────────────── drawn lines ────────────────────────────── */

/**
 * A line that draws itself along the map — the front line, and each arm of the
 * ring. A tube's faces run in order from one end of the path to the other, so
 * revealing more of its index range is a line growing along its own course.
 */
function DrawnLine({
  points, color, radius, from, to, clock, glow = false, runOnce = false,
}: {
  points: MapPoint[];
  color: string;
  radius: number;
  from: number;
  to: number;
  clock: React.RefObject<number>;
  glow?: boolean;
  runOnce?: boolean;
}) {
  const done = useRef(false);
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => {
        const [x, , z] = mapToWorld(p);
        return new THREE.Vector3(x, LINE_Y, z);
      }),
    );
    const tube = new THREE.TubeGeometry(curve, 150, radius, 7, false);
    tube.setDrawRange(0, 0);
    return tube;
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (done.current) return;
    const t = span(clock.current, from, to);
    geometry.setDrawRange(0, Math.ceil((geometry.index?.count ?? 0) * t));
    if (t >= 1 && runOnce) done.current = true;
  });

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color} emissive={color} emissiveIntensity={glow ? 0.6 : 0.16}
        roughness={0.55} metalness={0.1}
      />
    </mesh>
  );
}

/* ──────────────────────────── slots and pieces ─────────────────────────── */

/** A place worth putting something: a soft ring of light on the paper that
 *  brightens when a held piece comes near it. */
function SlotGlow({ slot, lit }: { slot: Slot; lit: boolean }) {
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = mapToWorld(slot.at);
  const r = slot.radius;

  useFrame(({ clock }, delta) => {
    const k = 1 - Math.exp(-8 * delta);
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.1);
    const wantRing = lit ? 0.85 : 0.28 + pulse * 0.16;
    const wantFill = lit ? 0.3 : 0.07 + pulse * 0.05;
    if (ring.current) ring.current.opacity += (wantRing - ring.current.opacity) * k;
    if (fill.current) fill.current.opacity += (wantFill - fill.current.opacity) * k;
  });

  return (
    <group position={[x, MAP.y + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[r * 0.94, 40]} />
        <meshBasicMaterial
          ref={fill} color="#ffcf7d" transparent opacity={0.07}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <ringGeometry args={[r * 0.9, r, 48]} />
        <meshBasicMaterial
          ref={ring} color="#ffd89a" transparent opacity={0.28}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** One of the phase's liftable pieces, waiting at the near edge of the table.
 *  It bobs very gently so it reads as something you can pick up, follows the
 *  pointer while held, and floats back here if it is refused. */
function TrayPiece({
  piece, x, bobSeed, dragging, dragPos, refused, onPointerDown,
}: {
  piece: Piece;
  x: number;
  bobSeed: number;
  dragging: boolean;
  dragPos: React.RefObject<THREE.Vector3>;
  refused: { at: number } | null;
  onPointerDown: (id: PieceId, e: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const bob = Math.sin(clock.elapsedTime * 1.5 + bobSeed * 1.7) * 0.045;
    const tx = dragging ? dragPos.current.x : x;
    const tz = dragging ? dragPos.current.z : TRAY_Z;
    let ty = dragging ? LIFT : 0.05 + bob;

    if (!snapped.current) {
      g.position.set(tx, ty, tz);
      snapped.current = true;
      return;
    }
    // a small hop while travelling, so a refused piece reads as lift-and-place
    if (!dragging) ty += Math.min(0.3, Math.hypot(tx - g.position.x, tz - g.position.z) * 0.28);
    const k = 1 - Math.exp(-(dragging ? 24 : 9) * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    // one small shake on the way home, so a refusal is felt as well as heard
    const age = refused ? performance.now() - refused.at : Infinity;
    g.rotation.z = age < 420 ? Math.sin(age / 26) * 0.13 * (1 - age / 420) : 0;
  });

  return (
    <group ref={group}>
      <PieceModel assetId={piece.assetId} />
      <Base />
      {/* fat invisible grip so small fingers can grab the piece */}
      <mesh
        position={[0, 0.42, 0]}
        onPointerDown={(e) => onPointerDown(piece.id, e)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[0.5, 0.5, 1.0, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A piece seated in its slot. The two hammers in the flanks sweep inward along
 *  their curved paths as the ring closes; everything else stays where it was
 *  put. */
function SeatedPiece({
  slot, pieceId, sealAge,
}: {
  slot: Slot;
  pieceId: PieceId;
  sealAge: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const placedAt = useRef(performance.now());
  const piece = pieceById(pieceId);
  const sweep = SWEEPS[slot.id as keyof typeof SWEEPS];

  const path = useMemo(() => {
    if (!sweep) return null;
    const at = (p: MapPoint) => {
      const [x, , z] = mapToWorld(p);
      return new THREE.Vector3(x, 0, z);
    };
    return new THREE.QuadraticBezierCurve3(at(sweep.from), at(sweep.via), at(sweep.to));
  }, [sweep]);

  const home = useMemo(() => {
    const [x, , z] = mapToWorld(slot.seatAt ?? slot.at);
    return new THREE.Vector3(x, 0, z);
  }, [slot.seatAt, slot.at]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    let p = home;
    let lift = 0;
    if (path && useUranusStore.getState().seal !== 'idle') {
      const t = span(sealAge.current, SEAL.sweepFrom, SEAL.sweepTo);
      p = path.getPoint(t);
      lift = Math.sin(t * Math.PI) * 0.22; // it rides over the ground as it swings
    }
    g.position.set(p.x, lift, p.z);
    // the landing: a short squash as it settles into place
    const land = THREE.MathUtils.clamp((performance.now() - placedAt.current) / 420, 0, 1);
    g.scale.setScalar(land < 1 ? 1 + Math.sin(land * Math.PI) * 0.13 : 1);
  });

  return (
    <group ref={group}>
      <PieceModel assetId={piece.assetId} />
      <Base />
    </group>
  );
}

/** One of the five static pieces that carry the puzzle's information. The player
 *  cannot pick these up: they land as phase 2 opens, each with its own label,
 *  and the German ones fall into shadow once the ring seals. */
function SceneryPiece({
  piece, delay, clock, sealAge,
}: {
  piece: Scenery;
  delay: number;
  clock: React.RefObject<number>;
  sealAge: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const seal = useUranusStore((s) => s.seal);
  const [x, , z] = mapToWorld(piece.at);
  /** Ally pieces read paler than the German ones — "less well equipped, more
   *  thinly spread" — and a trapped German piece sinks into shadow. */
  const [tint, setTint] = useState(piece.assetId === 'ch4.piece.ally' ? 1.3 : 1);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = span(clock.current, delay, delay + LAND_S);
    g.visible = t > 0;
    // drops in and settles, rather than blinking into existence
    g.position.set(x, (1 - t) * 0.85, z);
    const squash = t > 0.85 ? 1 + Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.1 : 1;
    g.scale.setScalar(t * squash);

    if (piece.german && seal !== 'idle') {
      const want = 1 - 0.55 * span(sealAge.current, SEAL.waveTo - 0.6, SEAL.settleTo);
      if (Math.abs(want - tint) > 0.01) setTint(want);
    }
  });

  return (
    <group ref={group}>
      <PieceModel assetId={piece.assetId} tint={tint} />
      {/* the ruined city is a place on the map, not a playing piece — it rests
          on the paper itself, where every piece that IS played stands on the
          same plinth */}
      {piece.id !== 'city' && <Base />}
    </group>
  );
}

/** The shared plinth, identical under every playing piece — the models rest on
 *  their own origin, so nothing sinks into the paper or floats above it. */
function Base() {
  return (
    <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[BASE_R, BASE_R * 1.06, 0.024, 24]} />
      <meshStandardMaterial color="#6d5530" roughness={0.5} metalness={0.5} />
    </mesh>
  );
}

/**
 * A private copy of a loaded model, with its own materials.
 *
 * Every piece here is drawn more than once from the same file — three hammers,
 * five soldier figures — and a three.js object can only hang under one parent,
 * so each instance clones the loaded scene. Cloning the materials too is what
 * lets the ally pieces read paler than the German ones and the trapped pieces
 * fall into shadow. The file still comes from the asset registry by id, so
 * swapping a model stays a registry-only edit.
 */
function ClonedModel({
  url, scale, offset, rotation, tint,
}: {
  url: string;
  scale: number;
  offset: [number, number, number];
  rotation: [number, number, number];
  tint: number;
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const root = scene.clone(true);
    const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const many = Array.isArray(mesh.material);
      const originals = many ? (mesh.material as THREE.Material[]) : [mesh.material as THREE.Material];
      const copies = originals.map((m) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (c.color) mats.push({ mat: c, base: c.color.clone() });
        return c;
      });
      mesh.material = many ? copies : copies[0];
    });
    return { root, mats };
  }, [scene]);

  // the clones own their materials, so they have to hand them back
  useEffect(() => () => model.mats.forEach((m) => m.mat.dispose()), [model]);
  useEffect(() => {
    for (const { mat, base } of model.mats) mat.color.copy(base).multiplyScalar(tint);
  }, [model, tint]);

  return <primitive object={model.root} scale={scale} position={offset} rotation={rotation} />;
}

/** A piece's model, from the registry. If its file ever fails to load the piece
 *  becomes a plain bronze block and its label still names it, so a missing model
 *  costs the game a picture but never a turn. */
function PieceModel({ assetId, tint = 1 }: { assetId: string; tint?: number }) {
  const src = glbSource(assetId);
  const fallback = (
    <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.34, 0.6, 0.34]} />
      <meshStandardMaterial color="#7a5c32" roughness={0.5} metalness={0.45} />
    </mesh>
  );
  if (!src) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <ClonedModel
        url={src.url}
        scale={src.scale ?? 1}
        offset={src.offset ?? [0, 0.024, 0]}
        rotation={src.rotation ?? [0, 0, 0]}
        tint={tint}
      />
    </ModelBoundary>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ──────────────────────────── labels, projected ─────────────────────────── */

/**
 * Every piece on the table carries a label, and no piece is ever anonymous.
 * Labels are DOM, so this measures where each labelled piece sits on screen and
 * publishes the list; UranusMinigame.tsx draws them. It only publishes when
 * something has actually moved, so a still camera costs one update and then
 * nothing.
 */
function useLabelProjection(phaseAge: React.RefObject<number>) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setLabels = useUranusStore((s) => s.setLabels);
  const last = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const { phase, placed, seal } = useUranusStore.getState();
    const out: { id: string; text: string; left: number; top: number }[] = [];

    const add = (id: string, text: string, at: MapPoint, nudge?: MapPoint) => {
      const [x, , z] = mapToWorld([at[0] + (nudge?.[0] ?? 0), at[1] + (nudge?.[1] ?? 0)]);
      v.set(x, MAP.y + 0.05, z).project(camera);
      out.push({ id, text, left: ((v.x + 1) / 2) * 100, top: ((1 - v.y) / 2) * 100 });
    };

    // a placed piece's label arrives with the piece
    for (const slot of SLOTS) {
      const pieceId = placed[slot.id];
      if (!pieceId) continue;
      // the two flank hammers travel as the ring closes — their labels go with
      // them rather than sit on empty paper
      if (seal !== 'idle' && SWEEPS[slot.id as keyof typeof SWEEPS]) continue;
      add(`piece-${slot.id}`, pieceById(pieceId).label, slot.seatAt ?? slot.at, [0, 0.058]);
    }

    // the static pieces, each as it lands
    if (phase !== 'why') {
      for (const [i, piece] of SCENERY.entries()) {
        if (!piece.label) continue;
        if (phaseAge.current < sceneryDelay(piece, i) + LAND_S * 0.8) continue;
        add(`scenery-${piece.id}`, piece.label, piece.at, piece.labelNudge);
      }
    }

    // one update per real change, never one per frame
    const key = out.map((l) => `${l.id}:${l.left.toFixed(1)}:${l.top.toFixed(1)}`).join('|');
    if (key !== last.current) {
      last.current = key;
      setLabels(out);
    }
  });

  // a resized window re-measures on the next frame
  useEffect(() => {
    last.current = '';
  }, [size.width, size.height]);
}
