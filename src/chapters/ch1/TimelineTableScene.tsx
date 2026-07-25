'use client';
/**
 * Chapter 1 minigame, 3D staging — the carved wooden figures standing in one
 * row on the war-room table (no map dressing). The row starts shuffled; the
 * player swaps figures until they run earliest → latest. All text lives in
 * the 2D HUD (TimelineMinigame.tsx) — the table only shows the figures.
 * Tap a figure then tap another to swap, or drag one across the row.
 * Rules and content live in timelineStore.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '@/assets/registry';
import { EVENTS, useTimelineStore, type TimelineEvent } from './timelineStore';

/** Column layout of the single figure row — keep in sync with the HUD strip. */
export const SPACING = 1.3;
export const ROW_Z = -0.3;
export const colX = (i: number) => (i - (EVENTS.length - 1) / 2) * SPACING;
/** Approximate world half-width the row spans on screen at the row's depth —
 *  used to map pointer x → column while dragging (precision not needed). */
const POINTER_HALF_WIDTH = 6.0;

export function TimelineTableScene() {
  const reset = useTimelineStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // fresh shuffle every time the player arrives

  const dragX = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragInfo = useRef<{ id: string | null; moved: boolean; startX: number; startY: number }>({
    id: null, moved: false, startX: 0, startY: 0,
  });

  // While dragging, follow the pointer horizontally along the row.
  useFrame(({ pointer }) => {
    if (dragInfo.current.id) dragX.current = THREE.MathUtils.clamp(pointer.x * POINTER_HALF_WIDTH, colX(0), colX(EVENTS.length - 1));
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
          const col = Math.round(dragX.current / SPACING + (EVENTS.length - 1) / 2);
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
          onPointerDown={startDrag}
        />
      ))}
    </group>
  );
}

/** A wooden figure standing in the row. Glides when swapped, lifts while
 *  selected or dragged. The model comes from the asset registry
 *  (ch1.figure.<id>), so models can be swapped without code changes. */
function WoodenPiece({
  event,
  dragging,
  dragX,
  onPointerDown,
}: {
  event: TimelineEvent;
  dragging: boolean;
  dragX: React.RefObject<number>;
  onPointerDown: (id: string, e: ThreeEvent<PointerEvent>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  const index = useTimelineStore((s) => s.order.indexOf(event.id));
  const selected = useTimelineStore((s) => s.selected === event.id);
  const locked = useTimelineStore((s) => s.locked.includes(event.id));
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && !locked);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    let tx = colX(index);
    let ty = 0;
    if (dragging) {
      tx = dragX.current;
      ty = 0.45;
    } else if (selected) {
      ty = 0.22 + Math.sin(clock.elapsedTime * 2.6) * 0.03;
    }
    if (!snapped.current) {
      // first frame: appear in place instead of gliding in from the origin
      g.position.set(tx, ty, ROW_Z);
      snapped.current = true;
      return;
    }
    // small hop while traveling, so swaps read as a lift-and-place
    const travel = Math.abs(g.position.x - tx);
    if (!dragging) ty += Math.min(0.3, travel * 0.4);
    const k = 1 - Math.exp(-9 * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * (dragging ? Math.min(1, k * 1.6) : k);
    g.position.z = ROW_Z;
  });

  return (
    <group ref={group}>
      <Asset assetId={`ch1.figure.${event.id}`} />
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
