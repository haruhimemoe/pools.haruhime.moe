/**
 * @file src/schemas/candidate-editor.ts
 * @desc What the editor's candidate pieces pass each other: a candidate row's actions, the same
 *       with the slot they're in, the context the bucket rows get (the candidates, who may vote,
 *       the viewer and the actions), and the map browser's "Add as candidate" (the slots it can
 *       choose and the add call). Types only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PoolSlot } from "@haruhimemoe/pool";
import type { Candidate, SlotCandidates, SlotPlace } from "@/schemas/built-candidates";
import type { PoolPerson } from "@/schemas/built-pool-view";
import type { CandidateSlotOption } from "@/utils/candidate-view";

/** What a candidate row can do. */
export type CandidateActions = {
  onPromote: (entry: Candidate) => void;
  onRemove: (entry: Candidate) => void;
  onVote: (entry: Candidate, on: boolean) => void;
  onNote: (entry: Candidate, note: string) => void;
};

/** Candidate actions with the slot they're in. */
export type PlacedCandidateActions = {
  [K in keyof CandidateActions]: (
    place: SlotPlace,
    ...args: Parameters<CandidateActions[K]>
  ) => void;
};

/** What the editor knows about candidates: them, who may vote, the viewer, and the actions. */
export type CandidateContext = PlacedCandidateActions & {
  candidates: SlotCandidates;
  members: readonly PoolPerson[];
  me: number | undefined;
  onDemote: (slot: PoolSlot) => void;
};

/** "Add as candidate" in the map browser: the slots it offers and the add call. */
export type CandidateAdder = {
  options: readonly CandidateSlotOption[];
  onAdd: (
    map: { beatmapId: number; beatmapsetId: number | null; note?: string },
    place: SlotPlace,
  ) => void;
};
