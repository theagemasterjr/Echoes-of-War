'use client';
/**
 * Predictive model preloading: warms the GLBs for whatever 3D the player is
 * most likely to see next, so a beat/view change never stalls on a download.
 *  - On the war-room map: the character model for the chapter they'll enter
 *    next (the same "first not-yet-completed chapter" rule WarRoomScene uses
 *    to pick the active marker — see src/warroom/WarRoomScene.tsx).
 *  - Inside a chapter's conversation: that chapter's minigame models (the
 *    registry's `minigameAssetIds`), so the switch into the minigame is instant.
 * Entirely data-driven off src/chapters/registry.ts + src/assets/registry.tsx
 * — never branches on a chapter id.
 */
import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/state/appStore';
import { useProgressStore } from '@/state/progressStore';
import { CHAPTERS, chapterMeta } from '@/chapters/registry';
import { ASSETS, type AssetId } from '@/assets/registry';

function preloadAsset(assetId: AssetId) {
  const src = ASSETS[assetId]?.source;
  if (src?.kind === 'glb') useGLTF.preload(src.url);
}

export function useModelPreload() {
  const view = useAppStore((s) => s.view);
  const completed = useProgressStore((s) => s.completed);
  const prologueDone = useProgressStore((s) => s.prologueDone);

  useEffect(() => {
    if (view.kind === 'map') {
      // mirrors WarRoomScene's activeId: nothing is "next" until the
      // prologue has played, and nothing is next once every chapter is done
      if (!prologueDone) return;
      const next = CHAPTERS.find((c) => !completed.includes(c.id));
      if (next) preloadAsset(next.characterAssetId);
    } else if (view.kind === 'chapter' && view.beat === 'conversation') {
      chapterMeta(view.chapterId).minigameAssetIds?.forEach(preloadAsset);
    }
  }, [view, completed, prologueDone]);
}
