'use client';
import { Canvas } from '@react-three/fiber';
import { SceneRouter } from './SceneRouter';
import { TransitionLayer } from '@/cinematics/TransitionLayer';
import { UiLayer } from '@/ui/UiLayer';
import { ErrorBoundary } from './ErrorBoundary';
import { DebugLayer } from './debug/DebugLayer';
import { useSecretCode } from './debug/useSecretCode';
import { useAppStore } from '@/state/appStore';

export default function App() {
  useSecretCode('debug', () =>
    useAppStore.getState().setDebugOpen(!useAppStore.getState().debugOpen),
  );

  return (
    <ErrorBoundary label="The app hit an unexpected error." onReset={() => window.location.reload()}>
      <div className="fixed inset-0 bg-black">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ fov: 45, near: 0.1, far: 80, position: [0, 2.4, 11] }}
        >
          <SceneRouter />
        </Canvas>
        <UiLayer />
        <TransitionLayer />
        <DebugLayer />
      </div>
    </ErrorBoundary>
  );
}
