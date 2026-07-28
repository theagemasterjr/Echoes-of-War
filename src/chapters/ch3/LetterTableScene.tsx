'use client';
/**
 * Chapter 3 minigame, 3D staging — the four sealed documents of the current
 * round lying in one row on the war-room table (no map dressing). All four are
 * the SAME registry prop, so nothing about how a document looks can hint at
 * which one is real: the player has to open one and read it.
 *
 * Everything here is motion and light. Hovering lifts a document a little and
 * warms it; tapping it lifts it off the table toward the camera over about
 * half a second, while its sealed model settles into the reading pose behind
 * a plain paper sheet (OpenLetterSheet below) that carries the actual words,
 * held up in front of the camera. Closing reverses the lift. A committed
 * document keeps a quiet green ring; a ruled-out one a red ring, and falls
 * into shadow.
 *
 * Rules and content live in lettersStore.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, useCursor, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS, Asset } from '@/assets/registry';
import { ROUNDS, docById, useLettersStore } from './lettersStore';

/** Roomiest the row ever gets; narrow windows tighten it (see useRowLayout). */
const SPACING_MAX = 1.5;
const ROW_Z = -0.3;
/** Footprint of a document prop at its registered scale, in table units. */
const DOC_W = 1.0;
const DOC_D = 0.75;
/** Resting pose: flat on the table, tipped a touch toward the camera so the
 *  face of the document is readable from across the table rather than edge-on.
 *  The lift compensates for the tip so the far edge never sinks into the wood. */
const REST_TILT = 0.2;
const REST_Y = DOC_D * 0.5 * Math.sin(REST_TILT);
/** Reading pose: up off the table and forward, facing the camera. */
const OPEN_Y = 1.15;
const OPEN_Z = 1.9;
const OPEN_TILT = 1.35;

/** Documents on the table per round (four, every round). */
const SLOTS = ROUNDS[0].docs.length;
const colX = (i: number, spacing: number) => (i - (SLOTS - 1) / 2) * spacing;

/** The .glb behind an asset id, or '' if that row is not a model file. Reading
 *  the registry (never a file path) keeps the model a swap-in-place detail. */
function glbSource(assetId: string) {
  const src = ASSETS[assetId]?.source;
  return src?.kind === 'glb' ? src : null;
}

/**
 * Fit the row of four on screen, whatever the window. Measures how wide the
 * camera actually sees at the row's depth and divides that among the four
 * documents, so no document is ever cut off at the edges of a narrow window.
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
    // 0.9 keeps a margin at both ends; never tighter than the props are wide
    // never tighter than the props are wide, or two documents would share one tap
    const spacing = Math.max(DOC_W * 1.22, Math.min(SPACING_MAX, (visibleW * 0.9) / SLOTS));
    return { spacing };
  }, [camera, width, height]);
}

export function LetterTableScene() {
  const reset = useLettersStore((s) => s.reset);
  useEffect(() => reset(), [reset]); // fresh deal every time the player arrives
  const roundIndex = useLettersStore((s) => s.roundIndex);
  const stage = useLettersStore((s) => s.stage);
  const slots = useLettersStore((s) => s.slots);
  const openId = useLettersStore((s) => s.openId);
  const { spacing } = useRowLayout();
  const round = ROUNDS[roundIndex];
  const source = glbSource(round.assetId);

  // Warm every round's prop up front: a model that only starts loading when
  // its round begins would suspend this whole scene and blank the table.
  useEffect(() => {
    for (const r of ROUNDS) {
      const s = glbSource(r.assetId);
      if (s) useGLTF.preload(s.url);
    }
  }, []);

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

      {/* the score screen and the summary are black DOM takeovers — the table
          keeps rendering under them, but the round's documents are done */}
      {stage === 'rounds' && source &&
        slots.map((docId, i) => (
          <DocumentSlot
            key={`${round.id}-${docId}`}
            docId={docId}
            url={source.url}
            scale={source.scale ?? 1}
            offset={source.offset ?? [0, 0, 0]}
            modelRotation={source.rotation ?? [0, 0, 0]}
            x={colX(i, spacing)}
          />
        ))}

      {/* the open letter: a plain paper sheet held up in front of the camera,
          the words rendered right on it — see OpenLetterSheet */}
      {stage === 'rounds' && openId && <OpenLetterSheet key={openId} docId={openId} />}
    </group>
  );
}

/** How far in front of the camera the sheet is held, and how big. Sized
 *  against the camera's own vertical FOV (BASE_FOV = 45° in SceneRouter, the
 *  narrowest this view ever gets — a wider window only ever widens it) so the
 *  sheet's top and bottom edges stay on screen: at 3 units out the frustum is
 *  ~2.49 tall, and 1.9 leaves a comfortable margin on every window shape while
 *  still holding the longest letter (~570 characters) at a legible size. */
const SHEET_DISTANCE = 3;
const SHEET_W = 1.4;
const SHEET_H = 1.9;
/** The sealed document behind it takes ~0.5s to settle into its reading pose
 *  (see DocumentSlot's useFrame); the sheet waits out most of that before it
 *  shows, so the two read as one motion — lift, then open into the page —
 *  instead of the flat page popping in ahead of the model. */
const SHEET_REVEAL_MS = 260;

/**
 * The opened letter's actual words, in the game's paper colours. A single flat
 * sheet held up in front of the camera every frame (billboarded, like the
 * chapter backdrop in SceneRouter) rather than nested under the sealed
 * document's own tilt — that keeps the text always level and always facing
 * the player, whatever the physical prop's model happens to be.
 *
 * Plain drei Text on a paper-coloured plane: no DOM, no per-sentence
 * highlighting — simple enough to stay dyslexia-safe-sized and legible for a
 * 10-14 year old reader at a glance. The read-aloud toggle, the "ruled out"
 * note and the close/commit buttons stay in the DOM control strip
 * (LettersMinigame.tsx) since they're interface, not the letter itself.
 */
function OpenLetterSheet({ docId }: { docId: string }) {
  const doc = docById(docId);
  const group = useRef<THREE.Group>(null);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), SHEET_REVEAL_MS);
    return () => clearTimeout(t);
  }, [docId]);

  // tracked every frame (even before it's visible) so it's never a frame late
  // to wherever the camera is looking once it does appear
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    camera.getWorldDirection(forward);
    at.copy(camera.position).addScaledVector(forward, SHEET_DISTANCE);
    g.position.copy(at);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group} visible={ready}>
      {/* a shade darker and a touch larger behind the paper — reads as a thin frame */}
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[SHEET_W + 0.06, SHEET_H + 0.06]} />
        <meshBasicMaterial color="#5c4520" depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[SHEET_W, SHEET_H]} />
        <meshBasicMaterial color="#e7d8b4" depthWrite={false} />
      </mesh>
      <Text
        position={[0, SHEET_H / 2 - 0.14, 0.005]}
        fontSize={0.058}
        maxWidth={SHEET_W - 0.24}
        lineHeight={1.4}
        letterSpacing={0.01}
        color="#2b2318"
        anchorX="center"
        anchorY="top"
        textAlign="left"
      >
        {doc.text}
      </Text>
    </group>
  );
}

/**
 * A private, tintable copy of a loaded model.
 *
 * The four documents of a round are the same asset id, and a three.js object
 * can only ever hang under one parent — rendering the shared <Asset> four
 * times would leave three empty places on the table. So each slot clones the
 * loaded scene, and clones its materials too, which is what lets one document
 * fall into shadow while its neighbours stay lit. The model itself still comes
 * from the asset registry by id: swapping it stays a registry-only edit.
 */
function useDocumentModel(url: string) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const root = scene.clone(true);
    const tints: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const many = Array.isArray(mesh.material);
      const originals: THREE.Material[] = many
        ? (mesh.material as THREE.Material[])
        : [mesh.material as THREE.Material];
      const copies = originals.map((m) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        if (c.color) tints.push({ mat: c, base: c.color.clone() });
        return c;
      });
      mesh.material = many ? copies : copies[0];
    });
    return { root, tints };
  }, [scene]);

  // the clones own their materials, so they have to hand them back
  useEffect(() => () => model.tints.forEach((t) => t.mat.dispose()), [model]);
  return model;
}

/** One document lying in the row: its hover lift, its open/close travel, and
 *  the rings that mark what the player has decided about it. */
function DocumentSlot({
  docId,
  url,
  scale,
  offset,
  modelRotation,
  x,
}: {
  docId: string;
  url: string;
  scale: number;
  offset: [number, number, number];
  modelRotation: [number, number, number];
  x: number;
}) {
  const group = useRef<THREE.Group>(null);
  const snapped = useRef(false);
  const opened = useLettersStore((s) => s.openId === docId);
  const anyOpen = useLettersStore((s) => s.openId !== null);
  const ruledOut = useLettersStore((s) => s.ruledOut.includes(docId));
  const committed = useLettersStore((s) => s.solvedId === docId);
  const roundOver = useLettersStore((s) => s.solvedId !== null);
  const [hovered, setHovered] = useState(false);
  const model = useDocumentModel(url);

  // the real one is found: everything else settles back into the dark
  const dimmed = ruledOut || (roundOver && !committed);
  const lit = hovered && !anyOpen && !dimmed;
  useCursor(hovered && !anyOpen);

  // the letter page covers the canvas, so no "pointer left" ever arrives while
  // it is up — drop the hover ourselves rather than come back to a lit slot
  useEffect(() => {
    if (anyOpen) setHovered(false);
  }, [anyOpen]);

  // warm on hover, shadowed once ruled out — a discrete change, not a per-frame
  // one, so the tint costs nothing while the table sits still. Kept subtle: a
  // document should feel noticed, not lit up like a prize.
  useEffect(() => {
    const factor = dimmed ? 0.3 : lit ? 1.08 : 1;
    for (const { mat, base } of model.tints) mat.color.copy(base).multiplyScalar(factor);
  }, [model, dimmed, lit]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const tx = opened ? x * 0.35 : x;
    const ty = opened ? OPEN_Y : REST_Y + (lit ? 0.1 : 0);
    const tz = opened ? OPEN_Z : ROW_Z;
    const trx = opened ? OPEN_TILT : REST_TILT;
    if (!snapped.current) {
      // first frame: appear in place instead of gliding in from the origin
      g.position.set(tx, ty, tz);
      g.rotation.x = trx;
      snapped.current = true;
      return;
    }
    // ~0.5s to settle into the reading pose, and the same back down again
    const k = 1 - Math.exp(-8 * delta);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    g.rotation.x += (trx - g.rotation.x) * k;
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model.root} scale={scale} position={offset} rotation={modelRotation} />
        {/* fat invisible slab so small fingers can hit the document */}
        <mesh
          position={[0, 0.16, 0]}
          onClick={(e) => {
            e.stopPropagation();
            const { openId, stage, open } = useLettersStore.getState();
            if (stage !== 'rounds' || openId) return; // the open letter owns the screen
            open(docId);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[DOC_W * 1.15, 0.34, DOC_D * 1.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* the warm reading lamp that follows a hovered document — a hint, not
            a spotlight */}
        {lit && <pointLight position={[0, 0.9, 0.4]} intensity={2.2} distance={2.4} color="#ffcf7d" />}
      </group>

      {/* the rings stay on the table in the document's own place, so a lifted
          document still shows where it came from */}
      {committed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, ROW_Z]}>
          <ringGeometry args={[0.58, 0.67, 40]} />
          <meshBasicMaterial color="#7dc98f" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      {ruledOut && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, ROW_Z]}>
          <ringGeometry args={[0.58, 0.65, 40]} />
          <meshBasicMaterial color="#c96a5a" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
