/**
 * @file src/utils/draft-key.ts
 * @desc /new#<pack key>: a draft pool another app (harumin's /pool fromtop) hands over in the
 *       URL fragment, so nothing is stored until the person makes the pool. Reads the key the
 *       way packs' /k# does. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { type BucketEntry, decodePackKey, extractPackKey, type PoolSlot } from "@haruhimemoe/pool";

/** A draft read from the hash: the key itself (sent on create), its name and its maps. */
export type Draft = { key: string; name: string; slots: PoolSlot[]; buckets?: BucketEntry[] };

/**
 * @function draftFromHash
 * @param hash {string} location.hash, with or without "#"
 * @returns {Draft | null} the draft, or null when there's no readable key
 */
export const draftFromHash = (hash: string): Draft | null => {
  const key = extractPackKey(hash.replace(/^#/, ""));
  if (key === null) return null;
  try {
    const pool = decodePackKey(key);
    return {
      key,
      name: pool.name,
      slots: pool.slots,
      ...(pool.buckets ? { buckets: pool.buckets } : {}),
    };
  } catch {
    return null;
  }
};

/** Where /new keeps a draft's key across the sign-in round trip (sessionStorage). */
export const DRAFT_STORAGE_KEY = "pools:new-draft";

/**
 * @function keepDraftHash
 * @returns {void} stores location.hash's key, if any, for after sign-in (never throws)
 */
export const keepDraftHash = (): void => {
  try {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) sessionStorage.setItem(DRAFT_STORAGE_KEY, hash);
  } catch {
    // Storage blocked: the draft is lost on sign-in, and the plain form shows.
  }
};

/**
 * @function takeDraftHash
 * @returns {string} the hash's key, else the one kept before sign-in (then forgotten), else ""
 */
export const takeDraftHash = (): string => {
  const hash = window.location.hash.replace(/^#/, "");
  let kept = "";
  try {
    kept = sessionStorage.getItem(DRAFT_STORAGE_KEY) ?? "";
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage blocked: only the hash counts.
  }
  return hash || kept;
};
