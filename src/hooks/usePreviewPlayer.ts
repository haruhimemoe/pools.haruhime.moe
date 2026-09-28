/**
 * @file src/hooks/usePreviewPlayer.ts
 * @desc The page's one preview clip: a clip plays straight from osu!'s CDN in the browser, and
 *       starting one stops whatever was playing, so only one ever plays. A clip that ends, or
 *       can't play, frees the player. usePlayingSet says which set is playing, for the buttons.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useSyncExternalStore } from "react";

/** Preview clips are loud next to a page: they start at half volume. */
export const PREVIEW_VOLUME = 0.5;

let current: { setId: number; audio: HTMLAudioElement } | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const release = (audio: HTMLAudioElement) => {
  if (current?.audio !== audio) return;
  current = null;
  emit();
};

/**
 * @function stopPreview
 * @returns {void} stops the clip that's playing, if one is
 */
export const stopPreview = (): void => {
  if (!current) return;
  current.audio.pause();
  current = null;
  emit();
};

/**
 * @function togglePreview
 * @param setId {number} the set whose button was pressed
 * @param url {string} its clip
 * @returns {void} stops it when it's the one playing; otherwise stops any other and plays it
 */
export const togglePreview = (setId: number, url: string): void => {
  if (current?.setId === setId) {
    stopPreview();
    return;
  }
  stopPreview();
  const audio = new Audio(url);
  audio.volume = PREVIEW_VOLUME;
  audio.addEventListener("ended", () => release(audio));
  current = { setId, audio };
  emit();
  audio.play().catch(() => release(audio));
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * @function usePlayingSet
 * @returns {number | null} the set whose clip is playing, or null
 */
export const usePlayingSet = (): number | null =>
  useSyncExternalStore(
    subscribe,
    () => current?.setId ?? null,
    () => null,
  );
