'use client';
/**
 * Chapter 2 minigame, 3D staging — five recessed boxes across the back of the
 * war-room table and the five bronze game pieces in a shuffled row in front of
 * them (no map dressing). Drag a piece into the box whose description matches
 * it: the box lights up under a held piece, a right drop snaps in and locks
 * with a soft glow, a wrong one gives a small shake and glides back to its
 * place. A piece let go over bare table simply glides back too.
 *
 * No text lives in here. The descriptions are plain DOM in MatchMinigame.tsx,
 * hung directly above their own box from the screen layout this scene measures
 * and publishes (matchStore.screen) — the founder's rule for chapter 1 was that
 * every word in a minigame is 2D DOM, never in-scene 3D or drei-Html text.
 *
 * The camera is owned by SceneRouter and is perfectly still during a minigame;
 * nothing here touches it. Rules and content live in matchStore.ts.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '@/assets/registry';
import { MOMENTS, useMatchStore, type Moment } from './matchStore';

/** Where the two rows lie on the tabletop (the war table spans z ±3.9). */
const BOX_Z = -2.5;
const ROW_Z = 2.5;
/** Roomiest each row ever gets; narrow windows tighten both (see useTableLayout). */
const BOX_SPACING_MAX = 2.3;
const ROW_SPACING_MAX = 1.55;
/** Widest any piece is at its registered scale (the little ship, 1.25 units
 *  across), plus the air that keeps two neighbours from ever touching. */
const PIECE_FOOTPRINT = 1.45;
/** How high a piece rides while it is held, and how deep it sits once boxed.
 *  The lift is deliberately small: the pointer is followed on a plane at this
 *  height, so a held piece sits exactly under the cursor, and a taller lift
 *  would slide it visibly up the screen away from the hand holding it. */
const LIFT = 0.32;
const BOX_FLOOR = 0.02;
/** How long a wrong piece shakes on the spot before it glides home. */
const SHAKE_MS = 460;

const colX = (i: number, spacing: number) => (i - (MOMENTS.length - 1) / 2) * spacing;
/** Which box a piece id belongs in — the row order in matchStore IS the answer. */
const boxOf = (id: string) => MOMENTS.findIndex((m) => m.id === id);

interface TableLayout {
  boxSpacing: number;
  rowSpacing: number;
  boxW: number;
  boxD: number;
  /** Display scale for a piece standing in the front row / sitting in a box. */
  rowScale: number;
  boxScale: number;
  screen: { boxes: { top: number; column: number }; pieces: { top: number; column: number } };
}

/**
 * Fit both rows on screen, whatever the window, and work out where they land
 * for the HUD.
 *
 * Each row is measured by projecting the table itself: one world unit at that
 * row's depth is projected to a fraction of the window, which gives both how
 * much table the camera can see there (so five boxes / five pieces always fit
 * with a margin) and where the row's line sits on screen (so the DOM
 * descriptions can hang above their boxes). Pieces shrink in step with their
 * spacing, so a tight window never turns into a row of overlapping models.
 */
function useTableLayout(): TableLayout {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  // the shared camera director places the camera the frame after this scene
  // mounts, so measure again the moment it actually moves (it then holds
  // perfectly still for the rest of the game, and this settles at once)
  const [moves, setMoves] = useState(0);
  const measuredAt = useRef(new THREE.Vector3(Infinity, 0, 0));
  useFrame(() => {
    if (camera.position.distanceTo(measuredAt.current) > 0.02) {
      measuredAt.current.copy(camera.position);
      setMoves((n) => n + 1);
    }
  });

  return useMemo(() => {
    const measure = (z: number) => {
      const origin = new THREE.Vector3(0, 0, z).project(camera);
      const oneUnit = new THREE.Vector3(1, 0, z).project(camera);
      // ndc x runs -1..1 across the window, so half the difference is the
      // fraction of the window's width that one table unit covers
      const perUnit = Math.max(1e-4, Math.abs(oneUnit.x - origin.x) / 2);
      return { top: (1 - origin.y) / 2, perUnit, visibleW: 1 / perUnit };
    };
    const boxes = measure(BOX_Z);
    const pieces = measure(ROW_Z);
    // 0.86 keeps a margin at both ends so nothing touches the window's edge
    const boxSpacing = Math.min(BOX_SPACING_MAX, (boxes.visibleW * 0.86) / MOMENTS.length);
    const rowSpacing = Math.min(ROW_SPACING_MAX, (pieces.visibleW * 0.86) / MOMENTS.length);
    const boxW = boxSpacing * 0.82;
    const boxD = boxW * 0.74;
    return {
      boxSpacing,
      rowSpacing,
      boxW,
      boxD,
      rowScale: Math.min(1, rowSpacing / PIECE_FOOTPRINT),
      boxScale: Math.min(1, (boxW * 0.82) / PIECE_FOOTPRINT),
      screen: {
        // the lines the HUD has to stay clear of: the far edge of the box row
        // (descriptions hang above it) and the near edge of the piece row
        boxes: { top: measure(BOX_Z - boxD / 2 - 0.1).top, column: boxSpacing * boxes.perUnit },
        pieces: { top: measure(ROW_Z + 0.7).top, column: rowSpacing * pieces.perUnit },
      },
    };
    // `moves` is the camera-settled signal; the maths reads camera directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, width, height, moves]);
}

/** The box under a held piece, or null for bare table. Generous on purpose:
 *  a release anywhere near a box counts as a release into it. */
function boxUnder(p: THREE.Vector3, layout: TableLayout): number | null {
  if (Math.abs(p.z - BOX_Z) > layout.boxD / 2 + 0.55) return null;
  const i = Math.round(p.x / layout.boxSpacing + (MOMENTS.length - 1) / 2);
  if (i < 0 || i >= MOMENTS.length) return null;
  if (Math.abs(p.x - colX(i, layout.boxSpacing)) > layout.boxW / 2 + 0.3) return null;
  // a box that already holds its piece is closed for business
  if (useMatchStore.getState().placed.includes(MOMENTS[i].id)) return null;
  return i;
}

export function MatchTableScene() {
  const reset = useMatchStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // fresh shuffle every time the player arrives
  const layout = useTableLayout();
  const setScreen = useMatchStore((s) => s.setScreen);
  useEffect(() => setScreen(layout.screen), [layout, setScreen]);

  const dragPos = useRef(new THREE.Vector3(0, 0, ROW_Z));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverBox, setHoverBox] = useState<number | null>(null);
  const [shake, setShake] = useState<{ id: string; x: number; z: number; at: number } | null>(null);
  const drag = useRef<{ id: string | null; hover: number | null }>({ id: null, hover: null });
  // our own raycaster, so following the pointer can never disturb the one
  // react-three-fiber uses for its own hover / click events
  const ray = useMemo(() => new THREE.Raycaster(), []);
  // the height a held piece travels at — following the pointer on this plane
  // keeps the piece under the cursor rather than floating above it
  const carry = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  /**
   * While a piece is held it follows the pointer across the tabletop, and the
   * box it is over lights up. The landing point is clamped to the play area:
   * this camera looks along the table almost level, so the top of the frame
   * can look clean past the far edge — an unclamped ray would fling the piece
   * off to the horizon (or nowhere at all).
   */
  useFrame(({ camera, pointer }) => {
    if (!drag.current.id) return;
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(carry, hit)) {
      const reach = colX(MOMENTS.length - 1, layout.boxSpacing) + layout.boxW;
      dragPos.current.set(
        THREE.MathUtils.clamp(hit.x, -reach, reach),
        0,
        THREE.MathUtils.clamp(hit.z, BOX_Z - 1, ROW_Z + 1),
      );
    }
    const over = boxUnder(dragPos.current, layout);
    if (over !== drag.current.hover) {
      drag.current.hover = over;
      setHoverBox(over);
    }
  });

  // Releasing anywhere ends the drag. Over the right box the piece locks; over
  // a wrong one it shakes where it was dropped and then goes home; over bare
  // table it just goes home. Nothing here scolds the player.
  useEffect(() => {
    if (!draggingId) return;
    const onUp = () => {
      const { id, hover } = drag.current;
      if (id) {
        const right = hover !== null && useMatchStore.getState().tryDrop(id, hover);
        if (hover !== null && !right) {
          setShake({ id, x: dragPos.current.x, z: dragPos.current.z, at: performance.now() });
        }
      }
      drag.current = { id: null, hover: null };
      setDraggingId(null);
      setHoverBox(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId]);

  const startDrag = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (useMatchStore.getState().placed.includes(id)) return;
    drag.current = { id, hover: null };
    dragPos.current.set(e.point.x, 0, e.point.z);
    setShake(null);
    setHoverBox(null);
    setDraggingId(id);
  };

  return (
    <group>
      {/* same room mood as the war-room home screen */}
      <fog attach="fog" args={['#0c0a08', 16, 34]} />
      <color attach="background" args={['#0c0a08']} />
      <ambientLight intensity={0.4} color="#ffe0b3" />
      <spotLight
        position={[3.6, 4.6, 2.8]} angle={1.15} penumbra={0.55} intensity={110}
        color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.5} color="#b8c4d6" />
      {/* the key light is over the near half of the table — this lifts the box
          row at the far end out of the dark without flattening it */}
      <pointLight position={[0, 2.6, BOX_Z + 0.6]} intensity={14} distance={9} decay={2} color="#ffd9a0" />

      <Asset assetId="warroom.table" position={[0, -0.01, 0]} />

      {MOMENTS.map((moment, i) => (
        <MatchBox key={moment.id} moment={moment} index={i} layout={layout} lit={hoverBox === i} />
      ))}
      {MOMENTS.map((moment) => (
        <TablePiece
          key={moment.id}
          moment={moment}
          layout={layout}
          dragging={draggingId === moment.id}
          dragPos={dragPos}
          shake={shake && shake.id === moment.id ? shake : null}
          onPointerDown={startDrag}
        />
      ))}
    </group>
  );
}

/** One of the five boxes: a dark well sunk into the tabletop inside an
 *  aged-gold lip. It warms under a held piece ("let go here") and keeps a
 *  steady glow once its piece is home ("this one is done"). Its description is
 *  DOM, hung above it by the HUD. */
function MatchBox({
  moment,
  index,
  layout,
  lit,
}: {
  moment: Moment;
  index: number;
  layout: TableLayout;
  lit: boolean;
}) {
  const locked = useMatchStore((s) => s.placed.includes(moment.id));
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const { boxW: w, boxD: d } = layout;
  const t = 0.07; // the lip's thickness

  // one material for all four sides of the lip, so the whole frame lights as one
  const lip = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6d5530', roughness: 0.45, metalness: 0.55,
        emissive: new THREE.Color('#ffb75e'), emissiveIntensity: 0.1,
      }),
    [],
  );
  useEffect(() => () => lip.dispose(), [lip]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-8 * delta);
    const wantGlow = locked ? 0.26 : lit ? 0.2 : 0.04;
    const wantLip = locked ? 0.5 : lit ? 0.85 : 0.1;
    if (glow.current) glow.current.opacity += (wantGlow - glow.current.opacity) * k;
    lip.emissiveIntensity += (wantLip - lip.emissiveIntensity) * k;
  });

  return (
    <group position={[colX(index, layout.boxSpacing), 0, BOX_Z]}>
      {/* the well itself — darker than the wood, so it reads as a recess */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#0a0806" roughness={0.95} metalness={0} />
      </mesh>
      {/* the light in the bottom of the well */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[w * 0.94, d * 0.94]} />
        <meshBasicMaterial
          ref={glow} color="#ffcf7d" transparent opacity={0.04}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* the lip around it: four bars, one shared material */}
      {(
        [
          [0, -(d + t) / 2, w + t * 2, t],
          [0, (d + t) / 2, w + t * 2, t],
          [-(w + t) / 2, 0, t, d + t * 2],
          [(w + t) / 2, 0, t, d + t * 2],
        ] as [number, number, number, number][]
      ).map(([bx, bz, sx, sz], i) => (
        <mesh key={i} position={[bx, 0.03, bz]} material={lip} castShadow receiveShadow>
          <boxGeometry args={[sx, 0.06, sz]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A game piece. It stands in the front row until it is picked up, follows the
 * pointer while held (lifted clear of the table), and either settles into its
 * box with a little squash of a landing or shakes and glides back. Once boxed
 * it cannot be picked up again. The model comes from the asset registry, so
 * models can be swapped without code changes.
 */
function TablePiece({
  moment,
  layout,
  dragging,
  dragPos,
  shake,
  onPointerDown,
}: {
  moment: Moment;
  layout: TableLayout;
  dragging: boolean;
  dragPos: React.RefObject<THREE.Vector3>;
  shake: { x: number; z: number; at: number } | null;
  onPointerDown: (id: string, e: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  const placedAt = useRef(0);
  const homeIndex = useMatchStore((s) => s.row.indexOf(moment.id));
  const placed = useMatchStore((s) => s.placed.includes(moment.id));
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && !placed);

  useEffect(() => {
    if (placed) placedAt.current = performance.now();
  }, [placed]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    const shaking = !!shake && now - shake.at < SHAKE_MS;

    let tx: number;
    let ty: number;
    let tz: number;
    let scale: number;
    if (placed) {
      tx = colX(boxOf(moment.id), layout.boxSpacing);
      ty = BOX_FLOOR;
      tz = BOX_Z;
      scale = layout.boxScale;
    } else if (dragging) {
      tx = dragPos.current.x;
      ty = LIFT;
      tz = dragPos.current.z;
      scale = layout.rowScale;
    } else if (shaking) {
      tx = shake.x;
      ty = 0.1;
      tz = shake.z;
      scale = layout.rowScale;
    } else {
      tx = colX(homeIndex, layout.rowSpacing);
      ty = 0;
      tz = ROW_Z;
      scale = layout.rowScale;
    }

    if (!snapped.current) {
      // first frame: appear in place instead of gliding in from the origin
      g.position.set(tx, ty, tz);
      g.scale.setScalar(scale);
      snapped.current = true;
      return;
    }
    // a small hop while traveling, so a glide home reads as lift-and-place
    if (!dragging && !placed) {
      ty += Math.min(0.26, Math.hypot(tx - g.position.x, tz - g.position.z) * 0.3);
    }
    const k = 1 - Math.exp(-(dragging ? 22 : placed ? 15 : 9) * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;

    // the landing: a short squash as it settles into its box
    const land = placed ? THREE.MathUtils.clamp((now - placedAt.current) / 420, 0, 1) : 1;
    const want = scale * (land < 1 ? 1 + Math.sin(land * Math.PI) * 0.12 : 1);
    g.scale.setScalar(g.scale.x + (want - g.scale.x) * k);

    // the shake rides on an inner group, so it never fights the glide
    if (inner.current) {
      inner.current.position.x = shaking
        ? Math.sin(((now - shake.at) / 1000) * 46) * 0.12
        : 0;
    }
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <PieceModel moment={moment} />
        {/* fat invisible grip so small fingers can grab the piece */}
        {!placed && (
          <mesh
            position={[0, 0.5, 0]}
            onPointerDown={(e) => onPointerDown(moment.id, e)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
          >
            <cylinderGeometry args={[0.6, 0.6, 1.1, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** The piece's model, from the registry. If its file ever fails to load the
 *  piece falls back to a plain bronze block and the HUD names it, so a missing
 *  model costs the game a picture but never a turn. */
function PieceModel({ moment }: { moment: Moment }) {
  const markFailed = useMatchStore((s) => s.markFailed);
  return (
    <ModelBoundary
      onFail={() => markFailed(moment.id)}
      fallback={
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.68, 0.6, 0.68]} />
          <meshStandardMaterial color="#7a5c32" roughness={0.5} metalness={0.45} />
        </mesh>
      }
    >
      <Asset assetId={moment.assetId} />
    </ModelBoundary>
  );
}

class ModelBoundary extends Component<
  { onFail: () => void; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
