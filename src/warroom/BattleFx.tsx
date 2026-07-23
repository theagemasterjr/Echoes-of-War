'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Miniature battle dressing around the ACTIVE chapter marker: small orange
 * explosion flashes popping around the prop, grey smoke puffs drifting up,
 * and a warm flickering light. Deliberately toy-scale and restrained — it
 * reads as "the fight is here" on a war-game table, not real violence.
 */

const FLASHES = 3;
const PUFFS = 4;

type Cycle = {
  /** seconds into the current life; negative = waiting to (re)start */
  t: number;
  dur: number;
  pos: THREE.Vector3;
};

const randomSpot = (v: THREE.Vector3) => {
  const a = Math.random() * Math.PI * 2;
  const r = THREE.MathUtils.randFloat(0.22, 0.5);
  v.set(Math.cos(a) * r, THREE.MathUtils.randFloat(0.02, 0.1), Math.sin(a) * r);
};

export function BattleFx() {
  const flashRefs = useRef<(THREE.Mesh | null)[]>([]);
  const puffRefs = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);

  const flashes = useMemo<Cycle[]>(
    () =>
      Array.from({ length: FLASHES }, () => {
        const c = { t: -Math.random() * 1.6, dur: 0.5, pos: new THREE.Vector3() };
        randomSpot(c.pos);
        return c;
      }),
    [],
  );
  const puffs = useMemo<Cycle[]>(
    () =>
      Array.from({ length: PUFFS }, () => {
        const c = { t: -Math.random() * 2.5, dur: 2.6, pos: new THREE.Vector3() };
        randomSpot(c.pos);
        return c;
      }),
    [],
  );

  useFrame((_, delta) => {
    let glow = 0;
    flashes.forEach((c, i) => {
      const m = flashRefs.current[i];
      if (!m) return;
      c.t += delta;
      if (c.t < 0) {
        m.visible = false;
        return;
      }
      if (c.t >= c.dur) {
        c.t = -THREE.MathUtils.randFloat(0.4, 1.7);
        c.dur = THREE.MathUtils.randFloat(0.35, 0.6);
        randomSpot(c.pos);
        m.visible = false;
        return;
      }
      const k = c.t / c.dur;
      m.visible = true;
      m.position.copy(c.pos);
      m.scale.setScalar(0.03 + 0.12 * (1 - (1 - k) * (1 - k))); // fast pop, slow tail
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      glow = Math.max(glow, 1 - k);
    });

    puffs.forEach((c, i) => {
      const m = puffRefs.current[i];
      if (!m) return;
      c.t += delta;
      if (c.t < 0) {
        m.visible = false;
        return;
      }
      if (c.t >= c.dur) {
        c.t = -THREE.MathUtils.randFloat(0.5, 2.0);
        c.dur = THREE.MathUtils.randFloat(2.2, 3.0);
        randomSpot(c.pos);
        m.visible = false;
        return;
      }
      const k = c.t / c.dur;
      m.visible = true;
      m.position.set(c.pos.x, c.pos.y + k * 0.32, c.pos.z);
      m.scale.setScalar(0.05 + 0.11 * k);
      // quick fade-in, long fade-out
      (m.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.min(1, k * 5) * (1 - k);
    });

    if (light.current) light.current.intensity = 0.35 + glow * 2.2;
  });

  return (
    <group>
      <pointLight ref={light} color="#ff9a3d" distance={1.7} intensity={0.35} position={[0, 0.2, 0]} />
      {Array.from({ length: FLASHES }, (_, i) => (
        <mesh
          key={`f${i}`}
          ref={(el) => {
            flashRefs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial
            color="#ffb347" transparent opacity={0}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh
          key={`p${i}`}
          ref={(el) => {
            puffRefs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#6b6258" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
