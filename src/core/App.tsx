'use client';
import { Canvas } from '@react-three/fiber';
import { SceneRouter } from './SceneRouter';
import { TransitionLayer } from '@/cinematics/TransitionLayer';
import { UiLayer } from '@/ui/UiLayer';
import { ErrorBoundary } from './ErrorBoundary';
import { DebugLayer } from './debug/DebugLayer';
import { useSecretCode } from './debug/useSecretCode';
import { useAppStore } from '@/state/appStore';
import { MusicDirector } from '@/audio/MusicDirector';

export default function App() {
  useSecretCode('debug', () =>
    useAppStore.getState().setDebugOpen(!useAppStore.getState().debugOpen),
  );
  const phase = useAppStore((s) => s.phase);
  const pending = useAppStore((s) => s.pending);
  const view = useAppStore((s) => s.view);
  const diving = phase === 'out' && view.kind === 'map' && pending?.kind === 'chapter';
  const arriving =
    phase === 'in' && view.kind === 'chapter' && view.beat === 'overview';
  const zoomClass = diving ? 'zoom-dive' : arriving ? 'zoom-arrive' : undefined;

  return (
    <ErrorBoundary label="The app hit an unexpected error." onReset={() => window.location.reload()}>
      <div className="fixed inset-0 overflow-hidden bg-black">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 45, near: 0.1, far: 80, position: [0, 2.4, 11] }}
          className={zoomClass}
        >
          <SceneRouter />
        </Canvas>
        <UiLayer />
        <TransitionLayer />
        <DebugLayer />
        <MusicDirector />
      </div>
    </ErrorBoundary>
  );
}
