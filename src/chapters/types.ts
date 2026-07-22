import type { ComponentType } from 'react';

export type ChapterId = 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6';
export type Beat = 'overview' | 'conversation' | 'minigame';

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

/** What each chapter folder default-exports. Only DOM beats live here — 3D staging is shared. */
export interface ChapterModule {
  Overview: ComponentType<BeatProps>;
  Minigame: ComponentType<MinigameProps>;
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
}
