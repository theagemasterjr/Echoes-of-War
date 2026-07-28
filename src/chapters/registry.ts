import type { ChapterId, ChapterMeta, ChapterModule } from './types';

/**
 * The one place chapters are registered. Adding/editing a chapter touches its
 * own folder, its tree file, and (at most) its row here — nothing else.
 * Marker positions are map-local: the paper map spans x âˆ’6..6, z âˆ’3.25..3.25.
 */
export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'ch1', index: 1, title: 'The Spark', subtitle: 'The road to war',
    dates: '1919–1939', location: 'Warsaw, Poland',
    characterName: 'Zofia Kowalska', characterRole: 'Student and diarist',
    markerPosition: [0.48, 0, -1.40], markerAssetId: 'ch1.marker', characterAssetId: 'ch1.character',
    introVideo: '/video/ch1-intro.mp4',
    conversationBackdrop: '/img/ch1-studio.jpg',
    /* across the war-room table, nearly level (~9° down), close on the figure row */
    minigameCamera: { pos: [0, 1.7, 6.6], target: [0, 0.55, -0.3] },
  },
  {
    id: 'ch2', index: 2, title: 'Standing Alone', subtitle: 'The Battle of Britain',
    /* dates end at 1940: Tom's knowledge is locked to late September 1940 (ch3 covers 1941) */
    dates: '1940', location: 'Kent, England',
    characterName: 'Tom Ashcroft', characterRole: 'Spitfire pilot',
    /* nudged north-west of ch5's Normandy marker (was [-0.30, 0, -1.42], nearly on top of it) */
    markerPosition: [-0.52, 0, -1.66], markerAssetId: 'ch2.marker', characterAssetId: 'ch2.character',
    introVideo: '/video/ch2-intro.mp4',
    conversationBackdrop: '/img/ch2-hangar.jpg',
    /* high over the table so the box row sits in the upper third and the
     * piece row across the lower third, full-scale pieces on normal windows */
    minigameCamera: { pos: [0, 4.6, 7.0], target: [0, 0.1, -0.6] },
  },
  {
    id: 'ch3', index: 3, title: 'A World at War', subtitle: 'Pearl Harbor and a global conflict',
    dates: '1941', location: 'Pearl Harbor, Hawaii',
    characterName: 'Ray Doyle', characterRole: 'US Navy sailor',
    /* recalibrated to the current map texture — the old [-4.93, 0, -0.16] sat on the west paper roll */
    markerPosition: [-4.4, 0, 0.0], markerAssetId: 'ch3.marker', characterAssetId: 'ch3.character',
    introVideo: '/video/ch3-intro.mp4',
    conversationBackdrop: '/img/ch3-studio.jpg',
    /* looking down at the row of four flat documents (~37° with the built-in
     * tilt) — room for the round banner above and the confirm panel below */
    minigameCamera: { pos: [0, 2.9, 5.6], target: [0, 0.15, -0.3] },
  },
  {
    id: 'ch4', index: 4, title: 'Turning the Tide', subtitle: 'Stalingrad',
    dates: '1942–1943', location: 'Stalingrad, USSR',
    characterName: 'Nikolai Volkov', characterRole: 'Front-line medic',
    /* recalibrated to the current map texture: the old [1.40, 0, -1.14] sat on
     * the northern shore of the Caspian, a few hundred km south-east of the
     * city. Fixed against the two markers known to be right on this texture
     * (ch1 Warsaw and the recalibrated ch3 Pearl Harbor), which puts the
     * satchel on the lower Volga, north-west of the Caspian. Every marker here
     * is eyeballed to within a degree or two — worth a look, not a re-survey. */
    markerPosition: [1.15, 0, -1.23], markerAssetId: 'ch4.marker', characterAssetId: 'ch4.character',
    /* the film is not made yet: until the file exists the intro beat holds on
     * the styled placeholder frame and its CONTINUE goes on to the brief.
     * Dropping ch4-intro.mp4 in needs no code change at all. */
    introVideo: '/video/ch4-intro.mp4',
    conversationBackdrop: '/img/ch4-ruins.jpg',
    /* Looking down on the whole map (about 52°, the paper filling the frame with
     * the pieces' row along the near edge inside the bottom of it) — the
     * "Operation Uranus" table. Fits the 8.4 × 6.3 map plus the tray at z 3.2
     * on any window down to a square one. */
    minigameCamera: { pos: [0, 7.6, 5.6], target: [0, 0, -0.55] },
  },
  {
    id: 'ch5', index: 5, title: 'The Road Back', subtitle: 'D-Day and the liberation of Europe',
    dates: '1944', location: 'Normandy, France',
    characterName: 'Placeholder: Allied medical worker', characterRole: 'Field medical worker',
    markerPosition: [-0.23, 0, -1.32], markerAssetId: 'ch5.marker', characterAssetId: 'ch5.character',
    conversationBackdrop: '/img/ch5-studio.jpg',
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
