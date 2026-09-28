/**
 * @file src/utils/candidate-activity.ts
 * @desc What the activity log says about a candidate op: added, removed, promoted (and the pick
 *       it replaced), the pick moved to candidates, moved to another slot, or a note changed. A
 *       vote says nothing (the log leaves votes out: too chatty). Slot labels are the ones people
 *       saw before the op. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { slotLabel } from "@haruhimemoe/pool";
import type { ActivityKind } from "@/constants/activity";
import type { SlotPlace } from "@/schemas/built-candidates";
import type { BuiltContent } from "@/utils/built-content";
import type { CandidateOp } from "@/utils/candidate-ops";

const labelOf = ({ bucket, index }: SlotPlace): string => slotLabel({ mod: bucket, index });

const pickAt = (pool: BuiltContent, { bucket, index }: SlotPlace) =>
  pool.slots.find((slot) => slot.mod === bucket && slot.index === index);

/**
 * @function describeCandidateOp
 * @param before {BuiltContent} the pool just before the op
 * @param op {CandidateOp} the op (it applied)
 * @returns {{ kind: ActivityKind; summary: string } | null} its entry, or null for a vote
 */
export const describeCandidateOp = (
  before: BuiltContent,
  op: CandidateOp,
): { kind: ActivityKind; summary: string } | null => {
  const at = labelOf(op.slot);
  switch (op.type) {
    case "addCandidate":
      return {
        kind: "candidate-add",
        summary: `Added beatmap ${op.beatmapId} as a candidate for ${at}`,
      };
    case "removeCandidate":
      return { kind: "candidate-remove", summary: `Removed candidate ${op.beatmapId} from ${at}` };
    case "promoteCandidate": {
      const old = pickAt(before, op.slot);
      const was = old ? ` in place of beatmap ${old.beatmapId}` : "";
      return {
        kind: "candidate-promote",
        summary: `Picked candidate ${op.beatmapId} for ${at}${was}`,
      };
    }
    case "demotePick": {
      const id = pickAt(before, op.slot)?.beatmapId ?? 0;
      return { kind: "candidate-demote", summary: `Made ${at}'s pick, beatmap ${id}, a candidate` };
    }
    case "setCandidateNote":
      return {
        kind: "candidate-note",
        summary: `${op.note ? "Changed" : "Cleared"} the note on candidate ${op.beatmapId} for ${at}`,
      };
    case "moveCandidate": {
      const to = labelOf({ bucket: op.slot.bucket, index: op.to });
      return {
        kind: "candidate-move",
        summary: `Moved candidate ${op.beatmapId} from ${at} to ${to}`,
      };
    }
    case "voteCandidate":
      return null;
  }
};
