'use client';
/**
 * Chapter 1 minigame, 3D staging — the carved wooden figures standing in one
 * row on the war-room table (no map dressing). The row starts shuffled; the
 * player swaps figures until they run earliest → latest. Each figure has a
 * 2D card anchored right under it (screen-anchored Html, same as the map's
 * chapter labels); the check button and summary live in TimelineMinigame.tsx.
 * Tap a figure then tap another to swap, or drag one across the row.
 * Rules and content live in timelineStore.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '@/assets/registry';
import { EVENTS, eventById, useTimelineStore, type TimelineEvent } from './timelineStore';

/** Roomiest the row ever gets; narrow windows tighten it (see useRowLayout). */
const SPACING_MAX = 1.3;
export const ROW_Z = -0.3;
const colX = (i: number, spacing: number) => (i - (EVENTS.length - 1) / 2) * spacing;

/** Minimum center-to-center distance (in the row's x/y plane) a piece being
 *  dragged keeps from every other piece it passes — a shade over two figure
 *  radii (the invisible grab cylinder is 0.45 across, so the models
 *  themselves are smaller than that). No physics engine: the dragged piece
 *  just adds enough extra hop height, on top of its normal "picked up" lift,
 *  to keep this distance whenever a neighbour is close in x — see
 *  `positions` below. */
const MIN_PIECE_SEP = 0.5;

/**
 * Fit the whole row on screen, whatever the window. Measures how wide the
 * camera actually sees at the row's depth and divides that among the eight
 * figures, so no figure (or its card) is ever cut off at the edges. The cards
 * are scaled by the same factor, so a tighter row never turns into overlapping
 * labels — the spacing and the label size move together.
 */
function useRowLayout() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  return useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const distance = Math.abs(cam.position.z - ROW_Z) || 1;
    const visibleH = 2 * distance * Math.tan(((cam.fov ?? 45) * Math.PI) / 360);
    const visibleW = visibleH * (width / Math.max(1, height));
    // 0.88 keeps a margin at both ends so the end figures never touch the edge
    const spacing = Math.min(SPACING_MAX, (visibleW * 0.88) / EVENTS.length);
    return { spacing, cardScale: spacing / SPACING_MAX, halfWidth: visibleW / 2 };
  }, [camera, width, height]);
}

export function TimelineTableScene() {
  const reset = useTimelineStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // fresh shuffle every time the player arrives
  const { spacing, cardScale, halfWidth } = useRowLayout();

  const dragX = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragInfo = useRef<{ id: string | null; moved: boolean; startX: number; startY: number }>({
    id: null, moved: false, startX: 0, startY: 0,
  });
  // Every piece registers its own current position here (see WoodenPiece);
  // whichever piece is being dragged reads it to hop clear of anyone it
  // passes close by instead of clipping through them (MIN_PIECE_SEP above).
  const positions = useRef(new Map<string, THREE.Vector3>()).current;

  // While dragging, follow the pointer horizontally along the row.
  useFrame(({ pointer }) => {
    if (dragInfo.current.id) {
      dragX.current = THREE.MathUtils.clamp(
        pointer.x * halfWidth,
        colX(0, spacing),
        colX(EVENTS.length - 1, spacing),
      );
    }
  });

  // Release anywhere ends the drag: a still pointer is a tap (toggle select),
  // a real drag swaps with the figure of the column it lands on.
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragInfo.current;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 7) d.moved = true;
    };
    const onUp = () => {
      const d = dragInfo.current;
      const { order, selected, select, swapById } = useTimelineStore.getState();
      if (d.id) {
        if (!d.moved) {
          if (selected && selected !== d.id) swapById(selected, d.id);
          else select(selected === d.id ? null : d.id);
        } else {
          const col = Math.round(dragX.current / spacing + (EVENTS.length - 1) / 2);
          const target = order[THREE.MathUtils.clamp(col, 0, EVENTS.length - 1)];
          swapById(d.id, target);
        }
      }
      d.id = null;
      setDraggingId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingId]);

  const startDrag = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (useTimelineStore.getState().locked.includes(id)) return;
    dragInfo.current = { id, moved: false, startX: e.nativeEvent.clientX, startY: e.nativeEvent.clientY };
    dragX.current = e.point.x;
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

      <Asset assetId="warroom.table" position={[0, -0.01, 0]} />

      {EVENTS.map((event) => (
        <WoodenPiece
          key={event.id}
          event={event}
          dragging={draggingId === event.id}
          dragX={dragX}
          spacing={spacing}
          cardScale={cardScale}
          positions={positions}
          onPointerDown={startDrag}
        />
      ))}
    </group>
  );
}

/** The 2D card under a figure. It is a child of the figure's own group, so it
 *  is anchored to the piece itself rather than to a column: same x, same z,
 *  only lower. That keeps it exactly under its piece at any window size and
 *  through every camera lean — anchoring it nearer the camera (as a separate
 *  column marker would) makes the outer cards splay away from their pieces in
 *  perspective. It rides along through swaps and drags for the same reason. */
const CARD_OFFSET: [number, number, number] = [0, -0.42, 0];

function PieceCard({ id, cardScale }: { id: string; cardScale: number }) {
  const index = useTimelineStore((s) => s.order.indexOf(id));
  const selected = useTimelineStore((s) => s.selected);
  const isLocked = useTimelineStore((s) => s.locked.includes(id));
  const isWrong = useTimelineStore((s) => s.lastWrong.includes(id));
  const event = eventById(id);
  const isSel = selected === id;

  const onClick = () => {
    const { locked, selected: sel, select, swapById } = useTimelineStore.getState();
    if (locked.includes(id)) return;
    if (sel && sel !== id) swapById(sel, id);
    else select(sel === id ? null : id);
  };

  return (
    <Html
      position={CARD_OFFSET}
      center
      /* shrinks in step with the row's spacing, so cards never crowd each other */
      distanceFactor={5.2 * cardScale}
      zIndexRange={[15, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={isLocked}
        style={{ pointerEvents: 'auto' }}
        className={`flex w-36 flex-col items-center rounded-sm border px-2 py-1.5 text-center backdrop-blur-sm transition ${
          isLocked
            ? 'border-emerald-600/50 bg-emerald-950/70'
            : isSel
              ? 'border-amber-300 bg-stone-950/85'
              : isWrong
                ? 'border-red-800/80 bg-stone-950/75 hover:border-red-500/80'
                : 'border-stone-600 bg-stone-950/75 hover:border-amber-200/60'
        }`}
      >
        <span className="text-[9px] uppercase tracking-widest text-stone-500">
          {index + 1}{index === 0 ? ' · earliest' : index === EVENTS.length - 1 ? ' · latest' : ''}
        </span>
        <span className={`mt-0.5 text-xs leading-snug ${isLocked ? 'text-emerald-200' : isSel ? 'text-amber-100' : 'text-stone-200'}`}>
          {isLocked ? '✓ ' : ''}{event.label}
        </span>
        {isLocked && (
          <>
            <span className="mt-0.5 text-[10px] font-medium text-amber-200/80">{event.date}</span>
            <span className="mt-0.5 text-[10px] leading-snug text-stone-400">{event.why}</span>
          </>
        )}
        {!isLocked && isSel && (
          <span className="mt-0.5 text-[9px] uppercase tracking-widest text-amber-200/70">
            tap another to swap
          </span>
        )}
      </button>
    </Html>
  );
}

/** A wooden figure standing in the row. Glides when swapped, lifts while
 *  selected or dragged. The model comes from the asset registry
 *  (ch1.figure.<id>), so models can be swapped without code changes. */
function WoodenPiece({
  event,
  dragging,
  dragX,
  spacing,
  cardScale,
  positions,
  onPointerDown,
}: {
  event: TimelineEvent;
  dragging: boolean;
  dragX: React.RefObject<number>;
  spacing: number;
  cardScale: number;
  positions: Map<string, THREE.Vector3>;
  onPointerDown: (id: string, e: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  // this piece's last-known position, shared with the others via `positions`
  // so a dragged piece can see where everyone else currently is
  const pos = useRef(new THREE.Vector3());
  const index = useTimelineStore((s) => s.order.indexOf(event.id));
  const selected = useTimelineStore((s) => s.selected === event.id);
  const locked = useTimelineStore((s) => s.locked.includes(event.id));
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && !locked);

  useEffect(() => {
    positions.set(event.id, pos.current);
    return () => void positions.delete(event.id);
  }, [positions, event.id]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    let tx = colX(index, spacing);
    let ty = 0;
    if (dragging) {
      tx = dragX.current;
      ty = 0.45;
      // hop clear of anyone this piece is passing close by, rather than
      // sliding straight through them (positions are last frame's, one
      // frame stale — imperceptible at 60fps, and avoids reading our own
      // not-yet-updated entry)
      let extra = 0;
      positions.forEach((p, id) => {
        if (id === event.id) return;
        const dx = tx - p.x;
        if (Math.abs(dx) >= MIN_PIECE_SEP) return;
        const clearY = Math.sqrt(MIN_PIECE_SEP * MIN_PIECE_SEP - dx * dx);
        extra = Math.max(extra, clearY - Math.max(0, ty - p.y));
      });
      ty += extra;
    } else if (selected) {
      ty = 0.22 + Math.sin(clock.elapsedTime * 2.6) * 0.03;
    }
    if (!snapped.current) {
      // first frame: appear in place instead of gliding in from the origin
      g.position.set(tx, ty, ROW_Z);
      snapped.current = true;
      pos.current.copy(g.position);
      return;
    }
    // small hop while traveling, so swaps read as a lift-and-place
    const travel = Math.abs(g.position.x - tx);
    if (!dragging) ty += Math.min(0.3, travel * 0.4);
    const k = 1 - Math.exp(-9 * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * (dragging ? Math.min(1, k * 1.6) : k);
    g.position.z = ROW_Z;
    pos.current.copy(g.position);
  });

  return (
    <group ref={group}>
      <Asset assetId={`ch1.figure.${event.id}`} />
      <PieceCard id={event.id} cardScale={cardScale} />
      {/* fat invisible grip so small fingers can grab the figure */}
      {!locked && (
        <mesh
          position={[0, 0.45, 0]}
          onPointerDown={(e) => onPointerDown(event.id, e)}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <cylinderGeometry args={[0.45, 0.45, 1.05, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {selected && !dragging && (
        /* soft ring under a picked-up figure — "I'm in your hand" */
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.3, 0.42, 32]} />
          <meshBasicMaterial color="#ffcf7d" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      {locked && (
        /* quiet green base ring — this one is in the right place */
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshBasicMaterial color="#7dc98f" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
