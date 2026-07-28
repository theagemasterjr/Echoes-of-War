'use client';
/**
 * Chapter 5 minigame, 3D staging — the war-room table with the Channel map on
 * it, the eight props the player sorts, and the scripted payoff.
 *
 * No text lives in here. Every word the player reads is plain 2D DOM in
 * ShowOrHideMinigame.tsx, including the label under each piece: this scene
 * measures where everything lands on screen and publishes it
 * (showOrHideStore.labels), so a label holds one readable size whatever the
 * window does and follows the easy-read font setting like every other word in
 * the game. That is the founder's rule from chapter 1 — never in-scene 3D text.
 *
 * The map is ONE unlit-lit plane showing the supplied image at the image's own
 * aspect ratio (see MAP in the store). Nothing here scales or crops it, because
 * every zone, marker and path in the store is a point read off those pixels.
 *
 * The camera is owned by SceneRouter and is perfectly still for the whole
 * minigame — `minigameCamera` on the chapter's registry row pins it every frame
 * and ignores the pointer. Nothing in this file touches the camera. Only the
 * piece being dragged responds to the mouse.
 *
 * Rules and content live in showOrHideStore.ts.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS } from '@/assets/registry';
import {
  BEACHHEAD, DIVISIONS, LANDINGS, MAP, PAYOFF, PIECES, PIN_LABEL, PIN_PATH, PIN_PLAY_MAX, TARGETS,
  TARGET_RADIUS, TRAY_Z, ZONES, countIn, mapToWorld, pieceById, pinTravel, seatIndex,
  targetById, trayPieces, traySeat, useShowOrHideStore, zoneById, zoneSeat,
  type MapPoint, type Piece, type PieceId, type Zone, type ZoneId,
} from './showOrHideStore';

/** How high a held piece rides. Small on purpose: the pointer is followed on a
 *  plane at this height, so a held piece sits exactly under the cursor. */
const LIFT = 0.34;
/** Table height of the drawn arrows — just clear of the paper. */
const LINE_Y = MAP.y + 0.02;
/** The base every playing piece stands on (the models have none of their own). */
const BASE_R = 0.2;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 0→1 across [from, to]. */
const span = (t: number, from: number, to: number) => smooth((t - from) / (to - from));

/** A .glb's registry row (url + scale + offset), or null if that id is not a file. */
function glbSource(assetId: string) {
  const src = ASSETS[assetId]?.source;
  return src?.kind === 'glb' ? src : null;
}

export function ShowOrHideScene() {
  const reset = useShowOrHideStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // a fresh, freshly shuffled board every visit

  const order = useShowOrHideStore((s) => s.order);
  const placed = useShowOrHideStore((s) => s.placed);
  const refused = useShowOrHideStore((s) => s.refused);
  const stage = useShowOrHideStore((s) => s.stage);
  const setStage = useShowOrHideStore((s) => s.setStage);
  const tray = trayPieces(order, placed);

  // warm every model the board needs, so nothing pops in late
  useEffect(() => {
    const ids = new Set([...PIECES.map((p) => p.assetId), 'ch5.pin.german-command']);
    for (const id of ids) {
      const src = glbSource(id);
      if (src) useGLTF.preload(src.url);
    }
  }, []);

  /* ── the payoff clock ── */
  const payoffAge = useRef(0);
  const playing = stage === 'play';
  useEffect(() => {
    if (stage !== 'payoff') return;
    payoffAge.current = 0;
    const t = setTimeout(() => setStage('card'), PAYOFF.done * 1000);
    return () => clearTimeout(t);
  }, [stage, setStage]);

  /* ── dragging ── */
  const dragPos = useRef(new THREE.Vector3(0, 0, TRAY_Z));
  const [draggingId, setDraggingId] = useState<PieceId | null>(null);
  const [hoverZone, setHoverZone] = useState<ZoneId | null>(null);
  const drag = useRef<{ id: PieceId | null; zone: ZoneId | null; france: boolean }>({
    id: null, zone: null, france: false,
  });
  // our own raycaster, so following the pointer never disturbs the one
  // react-three-fiber uses for its own hover / click events
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const carry = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  /** The English zone a held piece is over, if any. Generous: a release
   *  anywhere near a ring counts as a release into it. */
  const zoneUnder = (p: THREE.Vector3): ZoneId | null => {
    let best: { id: ZoneId; d: number } | null = null;
    for (const zone of ZONES) {
      const [zx, , zz] = mapToWorld(zone.at);
      const d = Math.hypot(p.x - zx, p.z - zz);
      if (d <= zone.radius && (!best || d < best.d)) best = { id: zone.id, d };
    }
    return best?.id ?? null;
  };

  /** Over one of the French places — which take nothing, silently. */
  const franceUnder = (p: THREE.Vector3): boolean =>
    TARGETS.some(({ at }) => {
      const [tx, , tz] = mapToWorld(at);
      return Math.hypot(p.x - tx, p.z - tz) <= TARGET_RADIUS;
    });

  useFrame(({ camera, pointer }, delta) => {
    if (!playing) payoffAge.current += delta;
    if (!drag.current.id) return;
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(carry, hit)) {
      dragPos.current.set(
        THREE.MathUtils.clamp(hit.x, -MAP.w / 2 - 0.5, MAP.w / 2 + 0.5),
        0,
        THREE.MathUtils.clamp(hit.z, MAP.z - MAP.d / 2 - 0.4, TRAY_Z + 0.8),
      );
    }
    const over = zoneUnder(dragPos.current);
    drag.current.france = over ? false : franceUnder(dragPos.current);
    if (over !== drag.current.zone) {
      drag.current.zone = over;
      setHoverZone(over);
    }
  });

  // Releasing anywhere ends the drag. The store decides whether the piece seats,
  // bounces home, or simply goes back with nothing said.
  useEffect(() => {
    if (!draggingId) return;
    const onUp = () => {
      const { id, zone, france } = drag.current;
      if (id) useShowOrHideStore.getState().tryDrop(id, zone, france);
      drag.current = { id: null, zone: null, france: false };
      setDraggingId(null);
      setHoverZone(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId]);

  const startDrag = (id: PieceId, e: ThreeEvent<PointerEvent>) => {
    if (!playing) return;
    e.stopPropagation();
    drag.current = { id, zone: null, france: false };
    dragPos.current.set(e.point.x, 0, e.point.z);
    setHoverZone(null);
    setDraggingId(id);
  };

  /* ── labels: gathered here, drawn as DOM ── */
  useLabelProjection(payoffAge, draggingId);

  const concealed = countIn(placed, 'conceal');

  return (
    <group>
      {/* same room mood as the war-room home screen: warm amber from the upper
          left, cool fill from behind */}
      <fog attach="fog" args={['#0c0a08', 18, 40]} />
      <color attach="background" args={['#0c0a08']} />
      <ambientLight intensity={0.44} color="#ffe0b3" />
      <spotLight
        position={[-4.2, 6.4, 3.2]} angle={1.15} penumbra={0.55} intensity={150}
        color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight position={[5, 7, -5]} intensity={0.45} color="#b8c4d6" />
      <pointLight position={[0, 3.2, MAP.z]} intensity={16} distance={12} decay={2} color="#ffd9a0" />

      <TableTop />
      <MapPaper />

      {/* The two arrows across the Channel, on screen from the first frame:
          what you do on your own coast decides where they look on theirs. */}
      {ZONES.map((zone) => (
        <ChannelArrow key={zone.id} zone={zone} />
      ))}

      {ZONES.map((zone) => (
        <ZoneRing
          key={zone.id}
          zone={zone}
          lit={hoverZone === zone.id}
          quiet={!playing}
        />
      ))}

      {TARGETS.map((t) => (
        <TargetMarker
          key={t.id}
          at={t.at}
          // every piece hidden in the south-west makes the real landing harder
          // to see; Calais holds its brightness throughout
          dim={t.id === 'normandy' ? 1 - 0.17 * concealed : 1}
          payoffAge={payoffAge}
          revealed={t.id === 'normandy'}
        />
      ))}

      {/* German command, and the divisions that follow it */}
      <GermanPin payoffAge={payoffAge} />
      {DIVISIONS.map((d) => (
        <DivisionMarker key={d.id} from={d.from} to={d.to} payoffAge={payoffAge} />
      ))}

      {/* the payoff's last two beats */}
      {LANDINGS.map((l) => (
        <LandingChip key={l.id} from={l.from} to={l.to} payoffAge={payoffAge} />
      ))}
      <Beachhead payoffAge={payoffAge} />

      {/* The pieces still waiting below the map. A piece keeps the spot it was
          dealt — the row does not close up as pieces are taken, so nothing
          shuffles sideways under the player's hand mid-game. */}
      {tray.map((piece) => {
        const index = order.indexOf(piece.id);
        const seat = traySeat(index);
        return (
          <TrayPiece
            key={piece.id}
            piece={piece}
            x={seat.x}
            z={seat.z}
            bobSeed={index}
            dragging={draggingId === piece.id}
            dragPos={dragPos}
            refused={refused?.id === piece.id ? refused : null}
            onPointerDown={startDrag}
          />
        );
      })}

      {/* pieces already locked into a zone */}
      {PIECES.filter((p) => placed[p.id]).map((piece) => (
        <SeatedPiece
          key={piece.id}
          piece={piece}
          at={zoneSeat(zoneById(placed[piece.id]!), seatIndex(order, placed, piece.id))}
        />
      ))}
    </group>
  );
}

/* ───────────────────────────── the table and map ────────────────────────── */

/** A plain dark tabletop under the paper. The war-room table model is framed
 *  for the map hub's camera; at this angle a simple surface reads better and
 *  costs nothing. */
function TableTop() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, MAP.z + 0.6]} receiveShadow>
      <planeGeometry args={[MAP.w * 1.9, MAP.d * 3.1]} />
      <meshStandardMaterial color="#2a1d12" roughness={0.92} metalness={0.04} />
    </mesh>
  );
}

/**
 * The paper on the table: the supplied image, at the image's own aspect ratio
 * and nothing else. If the file is ever missing the plane still draws in aged
 * parchment, so the board keeps its geometry and the chapter still finishes —
 * the zones and markers are positioned by coordinates, not by the picture.
 */
function MapPaper() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, MAP.y, MAP.z]} receiveShadow>
      <planeGeometry args={[MAP.w, MAP.d]} />
      <TextureBoundary
        fallback={<meshStandardMaterial color="#c9ab77" roughness={0.95} metalness={0} />}
      >
        <MapMaterial />
      </TextureBoundary>
    </mesh>
  );
}

function MapMaterial() {
  const tex = useTexture('/img/ch5-map.png');
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);
  return <meshStandardMaterial map={tex} roughness={0.94} metalness={0} />;
}

/* ─────────────────────────── the cross-Channel arrows ───────────────────── */

/**
 * A thin arrow from an English zone to the French place it decides. Both are on
 * screen from the moment the minigame opens and never change: they are the
 * teaching device, not feedback.
 */
function ChannelArrow({ zone }: { zone: Zone }) {
  const target = targetById(zone.target);

  const { tube, head, headQuat } = useMemo(() => {
    const from = new THREE.Vector3(...mapToWorld(zone.at));
    const to = new THREE.Vector3(...mapToWorld(target.at));
    from.y = LINE_Y;
    to.y = LINE_Y;

    // start and finish clear of the ring and the marker, so the arrow spans the
    // Channel rather than growing out of the middle of either end
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const start = from.clone().addScaledVector(dir, zone.radius * 1.02);
    const end = to.clone().addScaledVector(dir, -TARGET_RADIUS * 0.62);

    // a gentle bow, so the two arrows read as separate crossings
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    mid.addScaledVector(side, start.distanceTo(end) * 0.07);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const shaftEnd = curve.getPoint(0.9);
    const shaft = new THREE.QuadraticBezierCurve3(start, mid, shaftEnd);

    const tip = curve.getPoint(1);
    const tangent = curve.getTangent(1).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

    return {
      tube: new THREE.TubeGeometry(shaft, 48, 0.038, 6, false),
      head: tip,
      headQuat: quat,
    };
  }, [zone, target]);

  useEffect(() => () => tube.dispose(), [tube]);

  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial
          color="#ffd9a0" emissive="#ffc978" emissiveIntensity={0.9}
          roughness={0.6} metalness={0.1} transparent opacity={0.95}
        />
      </mesh>
      <mesh position={head} quaternion={headQuat}>
        <coneGeometry args={[0.13, 0.32, 12]} />
        <meshStandardMaterial
          color="#ffd9a0" emissive="#ffc978" emissiveIntensity={0.9}
          roughness={0.6} metalness={0.1} transparent opacity={1}
        />
      </mesh>
    </group>
  );
}

/* ──────────────────────────── zones and markers ─────────────────────────── */

/** One of the two English regions: a soft ring of light on the paper that
 *  brightens when a held piece comes near it. */
function ZoneRing({ zone, lit, quiet }: { zone: Zone; lit: boolean; quiet: boolean }) {
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = mapToWorld(zone.at);
  const r = zone.radius;

  useFrame(({ clock }, delta) => {
    const k = 1 - Math.exp(-8 * delta);
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.1);
    // once the board is full the rings stop asking for attention
    const wantRing = quiet ? 0.12 : lit ? 0.85 : 0.28 + pulse * 0.16;
    const wantFill = quiet ? 0.03 : lit ? 0.3 : 0.07 + pulse * 0.05;
    if (ring.current) ring.current.opacity += (wantRing - ring.current.opacity) * k;
    if (fill.current) fill.current.opacity += (wantFill - fill.current.opacity) * k;
  });

  return (
    <group position={[x, MAP.y + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[r * 0.94, 44]} />
        <meshBasicMaterial
          ref={fill} color="#ffcf7d" transparent opacity={0.07}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <ringGeometry args={[r * 0.9, r, 52]} />
        <meshBasicMaterial
          ref={ring} color="#ffd89a" transparent opacity={0.28}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * One of the two French places. It is a marker, never a drop target — a piece
 * let go here goes quietly home. Normandy fades as the real preparations are
 * concealed, then lights again once the coast opposite it has emptied.
 */
function TargetMarker({
  at, dim, payoffAge, revealed,
}: {
  at: MapPoint;
  dim: number;
  payoffAge: React.RefObject<number>;
  revealed: boolean;
}) {
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = mapToWorld(at);

  useFrame((_, delta) => {
    if (!ring.current) return;
    const { stage } = useShowOrHideStore.getState();
    let want = 0.5 * Math.max(0.2, dim);
    if (revealed && stage !== 'play') {
      // the coast opposite has emptied — it is plain to see again
      want = Math.max(want, 0.2 + 0.7 * span(payoffAge.current, PAYOFF.emptyFrom, PAYOFF.emptyTo));
    }
    const k = 1 - Math.exp(-5 * delta);
    ring.current.opacity += (want - ring.current.opacity) * k;
  });

  return (
    <group position={[x, MAP.y + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[TARGET_RADIUS * 0.56, TARGET_RADIUS * 0.64, 44]} />
        <meshBasicMaterial
          ref={ring} color="#cfe0f0" transparent opacity={0.5}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ────────────────────────── the German side, moving ─────────────────────── */

/** Where the pin has actually slid to this frame, so its name tag travels with
 *  it instead of re-deriving (and disagreeing with) the eased position. */
const pinAt = { x: 0, z: 0 };

/** Grey, anonymous, and the only thing on the French coast that answers the
 *  player: every piece put in the deception zone nudges it further toward
 *  Calais, and the payoff walks it the rest of the way. */
function GermanPin({ payoffAge }: { payoffAge: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const path = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        PIN_PATH.map((p) => {
          const [x, , z] = mapToWorld(p);
          return new THREE.Vector3(x, 0, z);
        }),
      ),
    [],
  );
  const eased = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const { placed, stage } = useShowOrHideStore.getState();
    const deceived = Object.values(placed).filter((z) => z === 'deceive').length;
    let want = pinTravel(deceived);
    if (stage !== 'play') {
      want = PIN_PLAY_MAX + (1 - PIN_PLAY_MAX) * span(payoffAge.current, PAYOFF.pinFrom, PAYOFF.pinTo);
    }
    // it slides rather than jumps, so each correct piece is felt as a decision
    eased.current += (want - eased.current) * (1 - Math.exp(-4 * delta));
    const p = path.getPoint(THREE.MathUtils.clamp(eased.current, 0, 1));
    g.position.set(p.x, 0, p.z);
    pinAt.x = p.x;
    pinAt.z = p.z;
  });

  return (
    <group ref={group}>
      <PieceModel assetId="ch5.pin.german-command" tint={1.5} grey />
    </group>
  );
}

/** One grey German division. It sits where it began until the payoff, then
 *  slides north-east up the coast to gather at Calais. */
function DivisionMarker({
  from, to, payoffAge,
}: {
  from: MapPoint;
  to: MapPoint;
  payoffAge: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(...mapToWorld(from)), [from]);
  const b = useMemo(() => new THREE.Vector3(...mapToWorld(to)), [to]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { stage } = useShowOrHideStore.getState();
    const t = stage === 'play' ? 0 : span(payoffAge.current, PAYOFF.divisionsFrom, PAYOFF.divisionsTo);
    g.position.set(
      THREE.MathUtils.lerp(a.x, b.x, t),
      Math.sin(t * Math.PI) * 0.1, // rides over the ground as it moves
      THREE.MathUtils.lerp(a.z, b.z, t),
    );
    g.scale.setScalar(0.72);
  });

  return (
    <group ref={group}>
      <PieceModel assetId="ch5.pin.german-command" tint={1.3} grey />
    </group>
  );
}

/** An Allied marker coming ashore into the gap at Normandy. A marker on a map
 *  and nothing more: the payoff never shows fighting. */
function LandingChip({
  from, to, payoffAge,
}: {
  from: MapPoint;
  to: MapPoint;
  payoffAge: React.RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const a = useMemo(() => new THREE.Vector3(...mapToWorld(from)), [from]);
  const b = useMemo(() => new THREE.Vector3(...mapToWorld(to)), [to]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { stage } = useShowOrHideStore.getState();
    const t = stage === 'play' ? 0 : span(payoffAge.current, PAYOFF.ashoreFrom, PAYOFF.ashoreTo);
    g.visible = t > 0;
    g.position.set(
      THREE.MathUtils.lerp(a.x, b.x, t),
      MAP.y + 0.03,
      THREE.MathUtils.lerp(a.z, b.z, t),
    );
    if (mat.current) mat.current.opacity = Math.min(1, t * 4);
  });

  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 24]} />
        <meshStandardMaterial
          ref={mat} color="#7fb2e8" emissive="#7fb2e8" emissiveIntensity={0.5}
          transparent opacity={0} depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** The beachhead, spreading inland from the landing beaches — a soft shape
 *  growing on the paper, holding the last beat of the payoff. */
function Beachhead({ payoffAge }: { payoffAge: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const [x, , z] = mapToWorld(BEACHHEAD.at);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { stage } = useShowOrHideStore.getState();
    const t = stage === 'play' ? 0 : span(payoffAge.current, PAYOFF.beachheadFrom, PAYOFF.beachheadTo);
    g.visible = t > 0;
    g.scale.setScalar(Math.max(0.001, t));
    // it reaches a little further inland than it does along the shore
    g.position.set(x, MAP.y + 0.006, z + t * 0.22);
    if (mat.current) mat.current.opacity = 0.34 * t;
  });

  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BEACHHEAD.radius, 40]} />
        <meshBasicMaterial
          ref={mat} color="#8fc0ee" transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────── the pieces ─────────────────────────────── */

/** One of the props waiting below the map. It bobs very gently so it reads as
 *  something you can pick up, follows the pointer while held, and floats back
 *  here with one small shake if it went to the wrong zone. */
function TrayPiece({
  piece, x, z, bobSeed, dragging, dragPos, refused, onPointerDown,
}: {
  piece: Piece;
  x: number;
  z: number;
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
    const bob = Math.sin(clock.elapsedTime * 1.5 + bobSeed * 1.7) * 0.04;
    const tx = dragging ? dragPos.current.x : x;
    const tz = dragging ? dragPos.current.z : z;
    let ty = dragging ? LIFT : 0.05 + bob;

    if (!snapped.current) {
      g.position.set(tx, ty, tz);
      snapped.current = true;
      return;
    }
    // a small hop while travelling, so a returning piece reads as lift-and-place
    if (!dragging) ty += Math.min(0.3, Math.hypot(tx - g.position.x, tz - g.position.z) * 0.28);
    const k = 1 - Math.exp(-(dragging ? 24 : 9) * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    // one small shake on the way home, so a wrong zone is felt as well as read
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

/** A piece locked into its zone. It cannot be picked up again. */
function SeatedPiece({ piece, at }: { piece: Piece; at: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const placedAt = useRef(performance.now());

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.position.set(at[0], 0, at[2]);
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

/** The shared plinth, identical under every playing piece. */
function Base() {
  return (
    <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[BASE_R, BASE_R * 1.06, 0.024, 24]} />
      <meshStandardMaterial color="#6d5530" roughness={0.5} metalness={0.5} />
    </mesh>
  );
}

/* ───────────────────────────────── models ──────────────────────────────── */

/**
 * A private copy of a loaded model, with its own materials — the command pin is
 * drawn six times over (once for command, five times for the divisions) and a
 * three.js object can only hang under one parent. Cloning the materials too is
 * what lets those copies read grey and anonymous. The file still comes from the
 * asset registry by id, so swapping a model stays a registry-only edit.
 */
function ClonedModel({
  url, scale, offset, rotation, tint, grey,
}: {
  url: string;
  scale: number;
  offset: [number, number, number];
  rotation: [number, number, number];
  tint: number;
  grey: boolean;
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
    for (const { mat, base } of model.mats) {
      mat.color.copy(base).multiplyScalar(tint);
      // German markers are plain grey and anonymous — no insignia, no colour
      if (grey) {
        const g = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
        mat.color.setRGB(g, g, g * 1.04);
      }
    }
  }, [model, tint, grey]);

  return <primitive object={model.root} scale={scale} position={offset} rotation={rotation} />;
}

/** A piece's model, from the registry. If its file ever fails to load the piece
 *  becomes a plain block and its label still names it, so a missing model costs
 *  the game a picture but never a turn. */
function PieceModel({
  assetId, tint = 1, grey = false,
}: {
  assetId: string;
  tint?: number;
  grey?: boolean;
}) {
  const src = glbSource(assetId);
  const fallback = (
    <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.34, 0.6, 0.34]} />
      <meshStandardMaterial color={grey ? '#8a8a8f' : '#7a5c32'} roughness={0.5} metalness={0.45} />
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
        grey={grey}
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

/** Same idea for the map image: a missing or broken file leaves plain paper
 *  rather than taking the whole chapter down with it. */
class TextureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
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
 * Nothing on this table is anonymous. Both zones are named above their ring,
 * both French places are named, and every piece carries its label from the
 * moment it appears — in the tray, in the hand, and locked in a zone. Labels are
 * DOM, so this measures where everything sits on screen and publishes the list;
 * ShowOrHideMinigame.tsx draws them. It only publishes when something has
 * actually moved, so a still camera costs one update and then nothing.
 */
function useLabelProjection(payoffAge: React.RefObject<number>, draggingId: string | null) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const setLabels = useShowOrHideStore((s) => s.setLabels);
  const last = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const { order, placed, stage } = useShowOrHideStore.getState();
    const out: {
      id: string; text: string; note?: string; left: number; top: number;
      kind: 'piece' | 'zone' | 'target'; dim?: number; row?: number;
    }[] = [];

    const addWorld = (
      id: string, text: string, x: number, z: number,
      kind: 'piece' | 'zone' | 'target', note?: string, dim?: number, row?: number,
    ) => {
      v.set(x, MAP.y + 0.05, z).project(camera);
      out.push({ id, text, note, dim, kind, row, left: ((v.x + 1) / 2) * 100, top: ((1 - v.y) / 2) * 100 });
    };

    // the two English zones, named above their rings
    for (const zone of ZONES) {
      const [x, , z] = mapToWorld(zone.at);
      addWorld(`zone-${zone.id}`, zone.label, x, z - zone.radius - 0.34, 'zone', zone.subLabel);
    }

    // German command, named and travelling with its pin
    addWorld('pin-german', PIN_LABEL, pinAt.x, pinAt.z + 0.42, 'piece');

    // the two French places
    const concealed = countIn(placed, 'conceal');
    for (const t of TARGETS) {
      const [x, , z] = mapToWorld(t.at);
      const dim =
        t.id === 'normandy' && stage === 'play' ? Math.max(0.3, 1 - 0.17 * concealed) : 1;
      addWorld(`target-${t.id}`, t.label, x, z, 'target', undefined, dim);
    }

    // the pieces still waiting below the map — a held piece's label goes with it
    for (const piece of trayPieces(order, placed)) {
      if (piece.id === draggingId) continue;
      const seat = traySeat(order.indexOf(piece.id));
      addWorld(`tray-${piece.id}`, piece.name, seat.x, seat.z + 0.6, 'piece', piece.note);
    }

    // And the pieces locked into a zone. Their names go in a column under the
    // ring, one row each: four tags inside a ring this size would sit on top of
    // one another, and an unreadable label is the same as no label.
    for (const piece of PIECES) {
      const zoneId = placed[piece.id];
      if (!zoneId) continue;
      const zone = zoneById(zoneId);
      const [zx, , zz] = mapToWorld([
        zone.at[0] + zone.listNudge[0],
        zone.at[1] + zone.listNudge[1],
      ]);
      const row = seatIndex(order, placed, piece.id);
      // name only in the column: the piece's note was read in the tray, and the
      // line a correct drop earns says far more than the note ever did
      addWorld(`placed-${piece.id}`, piece.name, zx, zz + zone.radius, 'piece', undefined, undefined, row);
    }

    // one update per real change, never one per frame
    const key = out
      .map((l) => `${l.id}:${l.left.toFixed(1)}:${l.top.toFixed(1)}:${l.dim ?? 1}:${l.row ?? -1}`)
      .join('|');
    if (key !== last.current) {
      last.current = key;
      setLabels(out);
    }
    // the payoff clock is read here only so this hook re-runs with it
    void payoffAge;
  });

  // a resized window re-measures on the next frame
  useEffect(() => {
    last.current = '';
  }, [size.width, size.height]);
}
