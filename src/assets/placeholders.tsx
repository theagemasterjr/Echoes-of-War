'use client';
/**
 * Primitive stand-ins for every hero object. These are DELIBERATELY simple —
 * the real models are generated externally (see docs/model-prompts.md) and
 * swapped in via src/assets/registry.tsx without touching any of this logic.
 */
import type { FC } from 'react';
import type { ThreeElements } from '@react-three/fiber';

type GroupProps = ThreeElements['group'];

const wood = '#3d2b1f';
const paper = '#d8cbaa';
const metal = '#5a5f57';
const brass = '#8a713a';

export const Table: FC<GroupProps> = (p) => (
  <group {...p}>
    <mesh receiveShadow position={[0, -0.06, 0]}>
      <boxGeometry args={[15.5, 0.12, 9]} />
      <meshStandardMaterial color={wood} roughness={0.7} />
    </mesh>
    {[[-7, -4], [7, -4], [-7, 4], [7, 4]].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x, -1.1, z]}>
        <boxGeometry args={[0.35, 2, 0.35]} />
        <meshStandardMaterial color="#2c1f16" roughness={0.8} />
      </mesh>
    ))}
  </group>
);

export const MapSheet: FC<GroupProps> = (p) => (
  <group {...p}>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12.6, 7.1]} />
      <meshStandardMaterial color="#b3a582" roughness={0.9} />
    </mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
      <planeGeometry args={[12, 6.5]} />
      <meshStandardMaterial color={paper} roughness={0.95} />
    </mesh>
  </group>
);

/** Shared little base so each marker prop reads as a deliberate game piece. */
const PropBase: FC<{ color?: string }> = ({ color = '#7a6a4d' }) => (
  <mesh castShadow position={[0, 0.02, 0]}>
    <cylinderGeometry args={[0.17, 0.19, 0.04, 20]} />
    <meshStandardMaterial color={color} roughness={0.8} />
  </mesh>
);

export const RadioProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase />
    {/* cathedral-style 1930s radio: body + arched top + speaker + dial */}
    <mesh castShadow position={[0, 0.12, 0]}>
      <boxGeometry args={[0.18, 0.16, 0.1]} />
      <meshStandardMaterial color="#4a3325" roughness={0.6} />
    </mesh>
    <mesh castShadow position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.1, 16, 1, false, 0, Math.PI]} />
      <meshStandardMaterial color="#4a3325" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.17, 0.051]}>
      <circleGeometry args={[0.05, 16]} />
      <meshStandardMaterial color="#26180f" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.08, 0.051]}>
      <circleGeometry args={[0.02, 12]} />
      <meshStandardMaterial color={brass} metalness={0.5} roughness={0.4} />
    </mesh>
  </group>
);

export const SpitfireProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase />
    <group position={[0, 0.13, 0]} rotation={[0, 0.6, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.05, 0.06]} />
        <meshStandardMaterial color="#4f5d3f" roughness={0.5} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.03, 0.26]} />
        <meshStandardMaterial color="#4f5d3f" roughness={0.5} />
      </mesh>
    </group>
  </group>
);

export const ShipProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#5d6c74" />
    <mesh castShadow position={[0, 0.09, 0]}>
      <boxGeometry args={[0.3, 0.07, 0.09]} />
      <meshStandardMaterial color={metal} roughness={0.5} metalness={0.4} />
    </mesh>
    <mesh castShadow position={[0.02, 0.16, 0]}>
      <boxGeometry args={[0.09, 0.08, 0.05]} />
      <meshStandardMaterial color="#6b7680" roughness={0.5} />
    </mesh>
  </group>
);

export const MedicSatchelProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#6b5a45" />
    <mesh castShadow position={[0, 0.1, 0]}>
      <boxGeometry args={[0.2, 0.13, 0.09]} />
      <meshStandardMaterial color="#7a6a50" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.11, 0.048]}>
      <boxGeometry args={[0.07, 0.07, 0.004]} />
      <meshStandardMaterial color="#b9b3a6" roughness={0.7} />
    </mesh>
  </group>
);

export const HelmetProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#6b5a45" />
    {/* M1 helmet dome with a small red cross on a white disc */}
    <mesh castShadow position={[0, 0.1, 0]} scale={[1, 0.62, 1.15]}>
      <sphereGeometry args={[0.13, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#4f5442" roughness={0.55} />
    </mesh>
    <mesh position={[0, 0.14, 0.128]} rotation={[0.35, 0, 0]}>
      <circleGeometry args={[0.035, 16]} />
      <meshStandardMaterial color="#ddd6c8" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.14, 0.131]} rotation={[0.35, 0, 0]}>
      <planeGeometry args={[0.04, 0.012]} />
      <meshStandardMaterial color="#8a2318" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.14, 0.131]} rotation={[0.35, 0, Math.PI / 2]}>
      <planeGeometry args={[0.04, 0.012]} />
      <meshStandardMaterial color="#8a2318" roughness={0.7} />
    </mesh>
  </group>
);

export const LanternProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#8d8371" />
    {/* softly glowing paper lantern: ovoid body + dark caps */}
    <mesh castShadow position={[0, 0.16, 0]} scale={[1, 1.25, 1]}>
      <sphereGeometry args={[0.1, 20, 16]} />
      <meshStandardMaterial
        color="#f0e6cf" roughness={0.9}
        emissive="#ffca6e" emissiveIntensity={0.35}
      />
    </mesh>
    <mesh position={[0, 0.3, 0]}>
      <cylinderGeometry args={[0.035, 0.045, 0.03, 12]} />
      <meshStandardMaterial color="#3a2e22" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.035, 0]}>
      <cylinderGeometry args={[0.045, 0.035, 0.03, 12]} />
      <meshStandardMaterial color="#3a2e22" roughness={0.7} />
    </mesh>
  </group>
);

/** Stand-in person: simple bust used on every character stage until real models land. */
export const CharacterBust: FC<GroupProps> = (p) => (
  <group {...p}>
    <mesh castShadow position={[0, 0.55, 0]}>
      <cylinderGeometry args={[0.28, 0.36, 1.1, 20]} />
      <meshStandardMaterial color="#4a4438" roughness={0.8} />
    </mesh>
    <mesh castShadow position={[0, 1.32, 0]}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial color="#8c7a66" roughness={0.7} />
    </mesh>
  </group>
);
