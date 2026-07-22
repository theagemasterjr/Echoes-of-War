'use client';
import dynamic from 'next/dynamic';

// The whole experience is client-rendered — one boundary here, then the app
// is written like a plain SPA (no SSR/hydration concerns for the 3D canvas).
const App = dynamic(() => import('@/core/App'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-xs tracking-[0.4em] text-stone-500">
      ECHOES OF WAR
    </div>
  ),
});

export default function Page() {
  return <App />;
}
