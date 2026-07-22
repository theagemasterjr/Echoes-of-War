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

export const Lamp: FC<GroupProps> = (p) => (
  <group {...p}>
    <mesh position={[0, 0.5, 0]}>
      <cylinderGeometry args={[0.05, 0.09, 1, 8]} />
      <meshStandardMaterial color={brass} metalness={0.6} roughness={0.4} />
    </mesh>
    <mesh position={[0, 1.05, 0]} rotation={[0, 0, 0.4]}>
      <coneGeometry args={[0.35, 0.35, 16, 1, true]} />
      <meshStandardMaterial color="#1d3a2a" side={2} roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.98, 0]}>
      <sphereGeometry args={[0.09, 12, 12]} />
      <meshStandardMaterial color="#ffe9b0" emissive="#ffca6e" emissiveIntensity={2.2} />
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
    <mesh castShadow position={[0, 0.12, 0]}>
      <boxGeometry args={[0.22, 0.16, 0.12]} />
      <meshStandardMaterial color="#4a3325" roughness={0.6} />
    </mesh>
    <mesh position={[0.08, 0.28, 0]}>
      <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
      <meshStandardMaterial color={metal} metalness={0.7} />
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

export const LandingCraftProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#5d6c74" />
    <mesh castShadow position={[0, 0.09, 0]}>
      <boxGeometry args={[0.26, 0.08, 0.12]} />
      <meshStandardMaterial color="#556058" roughness={0.6} />
    </mesh>
    <mesh castShadow position={[0.13, 0.11, 0]} rotation={[0, 0, -0.5]}>
      <boxGeometry args={[0.1, 0.02, 0.12]} />
      <meshStandardMaterial color="#68746b" roughness={0.6} />
    </mesh>
  </group>
);

export const PaperCraneProp: FC<GroupProps> = (p) => (
  <group {...p}>
    <PropBase color="#8d8371" />
    <group position={[0, 0.12, 0]} rotation={[0, 0.4, 0]}>
      <mesh castShadow rotation={[0, 0, 0.7]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.9} />
      </mesh>
      <mesh castShadow rotation={[0, 0, -0.7]} position={[0.06, 0, 0]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.9} />
      </mesh>
    </group>
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
