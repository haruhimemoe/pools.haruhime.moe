/**
 * @file src/utils/candidate-view.ts
 * @desc How candidates are shown: only votes by the pool's current owner and editors count (a
 *       vote by someone removed as an editor is dropped), "2 of 3 editors" counts the owner too,
 *       each slot's list and whether the viewer voted, and the pseudo-slots that let the editor
 *       ask for candidates' map details and values under their slot's mods as it does for picks.
 *       Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { MAX_SLOT_INDEX, type PoolSlot } from "@haruhimemoe/pool";
import {
  type Candidate,
  candidateKey,
  placeOfKey,
  type SlotCandidates,
  type SlotPlace,
} from "@/schemas/built-candidates";

/**
 * @function countedVotes
 * @param candidates {SlotCandidates} a pool's candidates as stored
 * @param members {readonly number[]} the osu! ids of its owner and current editors
 * @returns {SlotCandidates} the same candidates, each keeping only its members' votes
 */
export const countedVotes = (
  candidates: SlotCandidates,
  members: readonly number[],
): SlotCandidates =>
  Object.fromEntries(
    Object.entries(candidates).map(([key, list]) => [
      key,
      list.map((entry) => ({ ...entry, votes: entry.votes.filter((id) => members.includes(id)) })),
    ]),
  );

/**
 * @function membersOf
 * @param pool {{ owner: { osuId: number } | null; editors: readonly { osuId: number }[] }} a pool
 * @returns {number[]} the osu! ids that may vote: the owner and every editor
 */
export const membersOf = (pool: {
  owner: { osuId: number } | null;
  editors: readonly { osuId: number }[];
}): number[] => [...(pool.owner ? [pool.owner.osuId] : []), ...pool.editors.map((e) => e.osuId)];

/**
 * @function votesText
 * @param entry {Candidate} a candidate
 * @param members {readonly number[]} who may vote
 * @returns {string} "2 of 3 editors" (the owner counts as one), counting members' votes only
 */
export const votesText = (entry: Candidate, members: readonly number[]): string => {
  const count = entry.votes.filter((id) => members.includes(id)).length;
  return `${count} of ${members.length} ${members.length === 1 ? "editor" : "editors"}`;
};

/**
 * @function candidatesAt
 * @param candidates {SlotCandidates | undefined} a pool's candidates
 * @param place {SlotPlace} a slot
 * @returns {Candidate[]} that slot's list (empty when it has none)
 */
export const candidatesAt = (
  candidates: SlotCandidates | undefined,
  place: SlotPlace,
): Candidate[] => candidates?.[candidateKey(place)] ?? [];

/**
 * @function candidateSlots
 * @param candidates {SlotCandidates | undefined} a pool's candidates
 * @returns {PoolSlot[]} one slot-shaped entry per candidate (its slot's bucket and number), so map
 *          details and values under the slot's mods are asked for as for picks
 */
export const candidateSlots = (candidates: SlotCandidates | undefined): PoolSlot[] =>
  Object.entries(candidates ?? {}).flatMap(([key, list]) => {
    const place = placeOfKey(key);
    return place
      ? list.map((entry) => ({ mod: place.bucket, index: place.index, beatmapId: entry.beatmapId }))
      : [];
  });

/**
 * @function emptyRows
 * @param candidates {SlotCandidates | undefined} a pool's candidates
 * @param picks {readonly PoolSlot[]} its picks
 * @param bucket {string} one bucket
 * @returns {number[]} that bucket's slot numbers with candidates and no pick, in order
 */
export const emptyRows = (
  candidates: SlotCandidates | undefined,
  picks: readonly PoolSlot[],
  bucket: string,
): number[] =>
  Object.keys(candidates ?? {})
    .flatMap((key) => {
      const place = placeOfKey(key);
      return place?.bucket === bucket ? [place.index] : [];
    })
    .filter((index) => !picks.some((slot) => slot.mod === bucket && slot.index === index))
    .sort((a, b) => a - b);

/** A slot "Add as candidate" can choose: its value ("NM:2"), label and place. */
export type CandidateSlotOption = { value: string; label: string; bucket: string; index: number };

/**
 * @function candidateSlotOptions
 * @param pool {{ buckets: readonly { code: string }[]; slots: readonly PoolSlot[]; candidates?: SlotCandidates }}
 *        the pool being edited
 * @returns {CandidateSlotOption[]} for each bucket in order, every slot with a pick or candidates
 *          ("NM4 (no pick)" for one without a pick), then a new slot after them ("New NM5")
 */
export const candidateSlotOptions = (pool: {
  buckets: readonly { code: string }[];
  slots: readonly PoolSlot[];
  candidates?: SlotCandidates | undefined;
}): CandidateSlotOption[] =>
  pool.buckets.flatMap(({ code }) => {
    const picks = new Set(pool.slots.filter((s) => s.mod === code).map((s) => s.index));
    const rows = [...new Set([...picks, ...emptyRows(pool.candidates, pool.slots, code)])].sort(
      (a, b) => a - b,
    );
    const next = Math.max(0, ...rows) + 1;
    const option = (index: number, label: string) => ({
      value: `${code}:${index}`,
      label,
      bucket: code,
      index,
    });
    return [
      ...rows.map((index) =>
        option(index, `${code}${index}${picks.has(index) ? "" : " (no pick)"}`),
      ),
      ...(next <= MAX_SLOT_INDEX ? [option(next, `New ${code}${next}`)] : []),
    ];
  });
