import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Films and music are big and don't change during a visit — let the
    // browser keep them for a day, so a replay (or coming back later the same
    // day) plays instantly instead of downloading all over again. Only on the
    // live site: while working locally, a film you drop in must show up on the
    // very next reload.
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        // The mission-brief manifest is the INDEX of which audio files exist.
        // It must never be the stale part: a day-old copy would name clips a
        // newer deploy has already replaced, and the briefing would come up
        // silent. It is tiny, so checking it every visit costs nothing. The
        // files it points at carry their own version, so they can still be
        // kept for a day (below).
        source: '/audio/brief/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      {
        source: '/:folder(video|audio)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
