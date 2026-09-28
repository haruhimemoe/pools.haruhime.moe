/**
 * @file src/utils/your-candidates.ts
 * @desc "Your candidates", the pure side: every candidate (and, when asked, every pick) from the
 *       pools someone owns or edits, one entry each with its pool, slot and note; filtered by the
 *       source slot's bucket and by text (the map's artist, title, difficulty and mapper, the
 *       pool's name and the note, folded as search folds them); newest first (a candidate by
 *       when it was added, a pick by its pool's last change); one page at a time. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PoolSlot } from "@haruhimemoe/pool";
import { YOUR_CANDIDATES } from "@/constants/candidates";
import { placeOfKey, type SlotCandidates } from "@/schemas/built-candidates";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { foldForSearch } from "@/utils/fold";

/** One map from your pools: a candidate or a pick, with where it is. */
export type OwnEntry = {
  poolId: string;
  poolName: string;
  bucket: string;
  index: number;
  kind: "candidate" | "pick";
  beatmapId: number;
  beatmapsetId: number | null;
  note: string;
  /** When it was added (a pick: its pool's last change), ISO text. */
  at: string;
};

/** The parts of a stored pool this list reads. */
export type OwnPool = {
  _id: string;
  name: string;
  slots: readonly PoolSlot[];
  slotNotes?: Readonly<Record<string, string>> | undefined;
  candidates?: SlotCandidates | undefined;
  updatedAt: Date;
};

/**
 * @function entriesOf
 * @param pools {readonly OwnPool[]} the pools someone owns or edits
 * @param picks {boolean} include every pick too
 * @returns {OwnEntry[]} one entry per candidate (and pick), newest first
 */
export const entriesOf = (pools: readonly OwnPool[], picks: boolean): OwnEntry[] => {
  const entries: OwnEntry[] = [];
  for (const pool of pools) {
    const base = { poolId: pool._id, poolName: pool.name };
    for (const [key, list] of Object.entries(pool.candidates ?? {})) {
      const place = placeOfKey(key);
      if (!place) continue;
      for (const c of list) {
        const { beatmapId, beatmapsetId, note, addedAt: at } = c;
        entries.push({ ...base, ...place, kind: "candidate", beatmapId, beatmapsetId, note, at });
      }
    }
    if (!picks) continue;
    for (const slot of pool.slots) {
      if (slot.mod === null) continue;
      entries.push({
        ...base,
        bucket: slot.mod,
        index: slot.index,
        kind: "pick",
        beatmapId: slot.beatmapId,
        beatmapsetId: null,
        note: pool.slotNotes?.[String(slot.beatmapId)] ?? "",
        at: pool.updatedAt.toISOString(),
      });
    }
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.beatmapId - b.beatmapId);
};

const textOf = (entry: OwnEntry, map: BuiltMap | null | undefined): string =>
  foldForSearch(
    [map?.artist, map?.title, map?.version, map?.setHost, entry.poolName, entry.note]
      .filter(Boolean)
      .join(" "),
  );

/**
 * @function filterEntries
 * @param entries {readonly OwnEntry[]} every entry, newest first
 * @param filters {{ bucket: string | null; q: string }} the source slot's bucket (null: any) and
 *        text to find (empty: any)
 * @param maps {Readonly<Record<number, BuiltMap | null>>} the maps' details
 * @returns {OwnEntry[]} the entries that match, in the same order
 */
export const filterEntries = (
  entries: readonly OwnEntry[],
  { bucket, q }: { bucket: string | null; q: string },
  maps: Readonly<Record<number, BuiltMap | null>>,
): OwnEntry[] => {
  const words = foldForSearch(q).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (bucket !== null && entry.bucket !== bucket) return false;
    if (words.length === 0) return true;
    const text = textOf(entry, maps[entry.beatmapId]);
    return words.every((word) => text.includes(word));
  });
};

/**
 * @function pageOf
 * @param entries {readonly OwnEntry[]} the matching entries
 * @param page {number} 1 or more
 * @returns {{ entries: OwnEntry[]; total: number; pages: number }} that page, the total and how
 *          many pages there are (at least 1)
 */
export const pageOf = (entries: readonly OwnEntry[], page: number) => {
  const size = YOUR_CANDIDATES.pageSize;
  return {
    entries: entries.slice((page - 1) * size, page * size),
    total: entries.length,
    pages: Math.max(1, Math.ceil(entries.length / size)),
  };
};
