/**
 * Audio is silent this phase by decision. This stub is the permanent API —
 * wiring sounds later means filling in these bodies, not changing callers.
 */
export const audioManager = {
  volume: 0.8,
  setVolume(v: number) {
    this.volume = v;
  },
  // ponytail: no-op playback until sound assets exist; add Howler/WebAudio behind these.
  play(_id: string) {},
  stop(_id: string) {},
};
