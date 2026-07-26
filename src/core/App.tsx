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
import { VideoPreloader } from '@/media/VideoPreloader';
import { useVideoPlayback } from '@/media/videoCache';

export default function App() {
  useSecretCode('debug', () =>
    useAppStore.getState().setDebugOpen(!useAppStore.getState().debugOpen),
  );
  const phase = useAppStore((s) => s.phase);
  const pending = useAppStore((s) => s.pending);
  const view = useAppStore((s) => s.view);
  const diving = phase === 'out' && view.kind === 'map' && pending?.kind === 'chapter';
  const zoomClass = diving ? 'zoom-dive' : undefined;
  // a film covers the whole screen while it plays — stop drawing the war room
  // underneath it so nothing competes for the graphics card and the picture
  // stays smooth. Only while nothing is moving in 3D: the moment a transition
  // starts (the film fades out into the glide down to the map) it draws again.
  const filmPlaying = useVideoPlayback((s) => s.playing);
  const freeze = filmPlaying && phase === 'idle';

  return (
    /* Recovers IN PLACE. This used to reload the whole page, which threw the
       player back to the title screen (the view isn't saved anywhere) — one
       hiccup anywhere in the app and you were starting over from BEGIN. Now
       it re-mounts the tree and puts you on the map, where your progress
       already is. */
    <ErrorBoundary
      label="The app hit an unexpected error."
      resetLabel="Return to the map"
      onReset={() => useAppStore.getState().returnToMap(true)}
    >
      <div className="fixed inset-0 overflow-hidden bg-black">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 45, near: 0.1, far: 80, position: [0, 2.4, 11] }}
          className={zoomClass}
          frameloop={freeze ? 'never' : 'always'}
        >
          <SceneRouter />
        </Canvas>
        <UiLayer />
        <TransitionLayer />
        <DebugLayer />
        <MusicDirector />
        <VideoPreloader />
      </div>
    </ErrorBoundary>
  );
}
