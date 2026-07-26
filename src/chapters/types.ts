import type { ComponentType } from 'react';

export type ChapterId = 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6';
/** Every chapter runs the same beats: intro film → mission brief → live
 *  conversation → minigame. A chapter missing a film or a brief simply skips
 *  that beat (see appStore.beatsFor) — no chapter needs its own flow. */
export type Beat = 'intro' | 'brief' | 'conversation' | 'minigame';

export interface MinigameResult {
  chapterId: ChapterId;
  completed: boolean;
  score?: number;
}

export interface BeatProps {
  chapterId: ChapterId;
  onAdvance: () => void;
}

export interface MinigameProps {
  chapterId: ChapterId;
  onComplete: (result: MinigameResult) => void;
}

/** One topic of the end-of-chapter summary: its title and the line the
 *  narrator reads. The chapter's recording is matched to these BY INDEX. */
export interface SummaryEntry {
  topic: string;
  line: string;
}

/** What each chapter folder default-exports. Only DOM beats live here — 3D staging is shared. */
export interface ChapterModule {
  Minigame: ComponentType<MinigameProps>;
  /** Optional chapter-owned 3D staging for the minigame, rendered inside the
   *  shared Canvas instead of the default floating-marker stage. Pair with
   *  `minigameCamera` on the chapter's registry row. */
  MinigameScene?: ComponentType;
  /** The chapter's summary topics. Exported here (not just used inside the
   *  minigame) so the debug menu can open the real summary screen without the
   *  chapter having been played. Absent = this chapter has no summary yet. */
  summary?: SummaryEntry[];
}

/** Static metadata — lives in the registry so the map never loads chapter code. */
export interface ChapterMeta {
  id: ChapterId;
  index: number;
  title: string;
  subtitle: string;
  dates: string;
  location: string;
  characterName: string;
  characterRole: string;
  /** Position of the marker prop on the tabletop map (map-local x, y, z). */
  markerPosition: [number, number, number];
  markerAssetId: string;
  characterAssetId: string;
  /** Optional intro film shown between overview and conversation (drop-in path under public/). */
  introVideo?: string;
  /** Optional photo shown behind the character during the conversation (path under public/). */
  conversationBackdrop?: string;
  /** Set when the chapter module exports a 3D MinigameScene: where the camera
   *  sits while that scene plays. Absent = shared DOM minigame staging. */
  minigameCamera?: { pos: [number, number, number]; target: [number, number, number] };
}
