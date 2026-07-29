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
    // the eight timeline figures (src/chapters/ch1/timelineStore.ts EVENTS)
    minigameAssetIds: [
      'ch1.figure.versailles', 'ch1.figure.depression', 'ch1.figure.hitler', 'ch1.figure.rhineland',
      'ch1.figure.munich', 'ch1.figure.pact', 'ch1.figure.invasion', 'ch1.figure.declarations',
    ],
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
    // the five matching pieces (src/chapters/ch2/matchStore.ts MOMENTS)
    minigameAssetIds: ['ch2.piece.boat', 'ch2.piece.carriage', 'ch2.piece.bomber', 'ch2.piece.cathedral', 'ch2.piece.crown'],
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
    // the three sealed documents (src/chapters/ch3/lettersStore.ts ROUNDS), each rendered four times
    minigameAssetIds: ['ch3.doc.decree', 'ch3.doc.folder', 'ch3.doc.envelope'],
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
    introVideo: '/video/ch4-intro.mp4',
    conversationBackdrop: '/img/ch4-ruins.jpg',
    /* Looking down on the whole map (about 52°, the paper filling the frame with
     * the pieces' row along the near edge inside the bottom of it) — the
     * "Operation Uranus" table. Fits the 8.4 × 6.3 map plus the tray at z 3.2
     * on any window down to a square one. */
    minigameCamera: { pos: [0, 7.6, 5.6], target: [0, 0, -0.55] },
    // the draggable pieces + standing scenery (src/chapters/ch4/uranusStore.ts PIECES, SCENERY)
    minigameAssetIds: ['ch4.piece.derrick', 'ch4.piece.barge', 'ch4.piece.hammer', 'ch4.piece.city', 'ch4.piece.german', 'ch4.piece.ally'],
  },
  {
    id: 'ch5', index: 5, title: 'The Road Back', subtitle: 'D-Day and the liberation of Europe',
    dates: '1944', location: 'Normandy, France',
    characterName: 'Corporal Ted Marsh', characterRole: 'Medical orderly, field surgical unit',
    /* recalibrated to the current map texture (the old [-0.23, 0, -1.32] was
     * from the pre-retexture survey): interpolated from the three known-good
     * markers (ch1 Warsaw, ch3 Pearl Harbor, ch4 Stalingrad), which puts the
     * helmet on the Normandy coast at ~49.4N 0.9W — and comfortably clear of
     * ch2's Kent marker to the north-west. */
    markerPosition: [-0.13, 0, -1.27], markerAssetId: 'ch5.marker', characterAssetId: 'ch5.character',
    introVideo: '/video/ch5-intro.mp4',
    conversationBackdrop: '/img/ch5-studio.jpg',
    /* Looking down on the Channel map (the paper filling the frame with the two
     * rows of pieces along the near edge inside the bottom of it) — the
     * "Show it or hide it" table. Setting this is also what pins the camera:
     * SceneRouter places it absolutely every frame and ignores the pointer, so
     * the view never drifts, orbits or answers the mouse while the player drags. */
    minigameCamera: { pos: [0, 7.4, 5.3], target: [0, 0, -0.95] },
    // the eight sortable props + the German command pin (src/chapters/ch5/showOrHideStore.ts PIECES)
    minigameAssetIds: [
      'ch5.piece.inflatable-tank', 'ch5.piece.dummy-landing-craft', 'ch5.piece.fake-hq-sign', 'ch5.piece.radio-truck',
      'ch5.piece.camouflage-netting', 'ch5.piece.sealed-camp-gate', 'ch5.piece.mail-sack', 'ch5.piece.blackout-screen',
      'ch5.pin.german-command',
    ],
  },
  {
    id: 'ch6', index: 6, title: 'The Cost of Victory', subtitle: 'The Pacific war ends',
    dates: '1945', location: 'Hiroshima, Japan',
    characterName: 'Doctor Kenzo Sato', characterRole: 'Doctor, relief hospital',
    /* Verified against the current map texture (2026-07-28) by extracting the
     * world-map GLB's texture and plotting this position on it: the lantern
     * sits on south-western Honshu at the Seto Inland Sea — the Hiroshima
     * region — so unlike ch3/ch4/ch5 this marker needed NO recalibration. */
    markerPosition: [3.83, 0, -0.70], markerAssetId: 'ch6.marker', characterAssetId: 'ch6.character',
    /* the film is not made yet: until the file exists the intro beat holds on
     * the styled placeholder frame and its CONTINUE goes on to the brief.
     * Dropping ch6-intro.mp4 into public/video/ needs no code change at all. */
    introVideo: '/video/ch6-intro.mp4',
    /* TODO(founder): conversation backdrop — leave commented out until the
     * image file physically exists (an empty reference hangs the 3D scene):
     * conversationBackdrop: '/img/ch6-hospital.jpg', */
    /* Looking down on "The Voices" table — four pieces around a clear centre,
     * the slip stack along the near edge. Setting this is also what pins the
     * camera: SceneRouter places it absolutely every frame and ignores the
     * pointer, so the view never drifts, orbits or answers the mouse. */
    minigameCamera: { pos: [0, 7.0, 5.4], target: [0, 0, -0.35] },
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
