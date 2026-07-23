import type { ChapterId, ChapterMeta, ChapterModule } from './types';

/**
 * The one place chapters are registered. Adding/editing a chapter touches its
 * own folder, its tree file, and (at most) its row here â€” nothing else.
 * Marker positions are map-local: the paper map spans x âˆ’6..6, z âˆ’3.25..3.25.
 */
export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'ch1', index: 1, title: 'The Spark', subtitle: 'The road to war',
    dates: '1919 â€“ 1939', location: 'Warsaw, Poland',
    characterName: 'Placeholder: Polish radio journalist', characterRole: 'Radio journalist',
    markerPosition: [0.48, 0, -1.40], markerAssetId: 'ch1.marker', characterAssetId: 'ch1.character',
  },
  {
    id: 'ch2', index: 2, title: 'Standing Alone', subtitle: 'The Battle of Britain',
    dates: '1940 â€“ 1941', location: 'Southern England',
    characterName: 'Placeholder: RAF pilot', characterRole: 'RAF fighter pilot',
    markerPosition: [-0.30, 0, -1.42], markerAssetId: 'ch2.marker', characterAssetId: 'ch2.character',
  },
  {
    id: 'ch3', index: 3, title: 'A World at War', subtitle: 'Pearl Harbor and a global conflict',
    dates: '1941', location: 'Pearl Harbor, Hawaii',
    characterName: 'Placeholder: US Navy sailor', characterRole: 'US Navy sailor',
    markerPosition: [-4.93, 0, -0.16], markerAssetId: 'ch3.marker', characterAssetId: 'ch3.character',
  },
  {
    id: 'ch4', index: 4, title: 'Turning the Tide', subtitle: 'Stalingrad',
    dates: '1942 â€“ 1943', location: 'Stalingrad, USSR',
    characterName: 'Placeholder: Soviet combat medic', characterRole: 'Combat medic',
    markerPosition: [1.40, 0, -1.14], markerAssetId: 'ch4.marker', characterAssetId: 'ch4.character',
  },
  {
    id: 'ch5', index: 5, title: 'The Road Back', subtitle: 'D-Day and the liberation of Europe',
    dates: '1944', location: 'Normandy, France',
    characterName: 'Placeholder: Allied medical worker', characterRole: 'Field medical worker',
    markerPosition: [-0.23, 0, -1.32], markerAssetId: 'ch5.marker', characterAssetId: 'ch5.character',
  },
  {
    id: 'ch6', index: 6, title: 'The Cost of Victory', subtitle: 'The Pacific war ends',
    dates: '1945', location: 'Hiroshima, Japan',
    characterName: 'Placeholder: Hiroshima doctor', characterRole: 'Hospital doctor',
    markerPosition: [3.83, 0, -0.70], markerAssetId: 'ch6.marker', characterAssetId: 'ch6.character',
  },
];

export function chapterMeta(id: ChapterId): ChapterMeta {
  return CHAPTERS.find((c) => c.id === id)!;
}

const loaders: Record<ChapterId, () => Promise<{ default: ChapterModule }>> = {
  ch1: () => import('./ch1'),
  ch2: () => import('./ch2'),
  ch3: () => import('./ch3'),
  ch4: () => import('./ch4'),
  ch5: () => import('./ch5'),
  ch6: () => import('./ch6'),
};

export const loadChapter = (id: ChapterId) => loaders[id]();
