/**
 * @file src/utils/activity.ts
 * @desc What the activity log says about a change to a built pool: an ops call is one entry,
 *       with its first op's kind and each op's summary joined (worked out on the pool as it was
 *       at that op, so slot labels are the ones people saw), cut to 300 characters; and the
 *       entries for a visibility, editor or owner change (which name their subject, so a deleted
 *       account's name can be taken out of them). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { slotLabel } from "@haruhimemoe/pool";
import { type ActivityKind, DELETED_USER, MAX_SUMMARY_LENGTH } from "@/constants/activity";
import type { Visibility } from "@/constants/built-pools";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { targetText } from "@/utils/bucket-targets";
import type { BuiltContent } from "@/utils/built-content";
import { applyOps } from "@/utils/built-ops";
import { formatShortDate } from "@/utils/date";

/** Someone an entry names besides its author: an editor added or removed, a new owner. */
export type ActivitySubject = { osuId: number; username: string };

/** What one change records: its kind, the summary, and whom it names. */
export type ActivityNote = { kind: ActivityKind; summary: string; subject?: ActivitySubject };

const listed = (words: string[]): string =>
  words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

const labelOf = (pool: BuiltContent, beatmapId: number): string => {
  const slot = pool.slots.find((s) => s.beatmapId === beatmapId);
  return slot ? slotLabel(slot) : `beatmap ${beatmapId}`;
};

const describe = (before: BuiltContent, after: BuiltContent, op: PoolOp): ActivityNote => {
  switch (op.type) {
    case "setDetails":
      return { kind: "details", summary: `Changed the ${listed(Object.keys(op).slice(1))}` };
    case "addMap":
      return {
        kind: "add",
        summary: `Added beatmap ${op.beatmapId} to ${labelOf(after, op.beatmapId)}`,
      };
    case "removeMap": {
      const gone = before.slots.find((s) => s.mod === op.slot.bucket && s.index === op.slot.index);
      const id = gone?.beatmapId ?? 0;
      return {
        kind: "remove",
        summary: `Removed beatmap ${id} from ${slotLabel({ mod: op.slot.bucket, index: op.slot.index })}`,
      };
    }
    case "moveMap": {
      const was = before.slots.find((s) => s.mod === op.slot.bucket && s.index === op.slot.index);
      const id = was?.beatmapId ?? 0;
      return {
        kind: "move",
        summary: `Moved beatmap ${id} from ${slotLabel({ mod: op.slot.bucket, index: op.slot.index })} to ${labelOf(after, id)}`,
      };
    }
    case "setSlotMods":
      return { kind: "mods", summary: `Changed the mods of the slot ${op.bucket}` };
    case "addBucket":
      return { kind: "mods", summary: `Added the slot ${op.code}` };
    case "removeBucket":
      return { kind: "mods", summary: `Removed the slot ${op.code}` };
    case "replaceMaps":
      return { kind: "add", summary: `Pasted maps: the pool has ${after.slots.length} now` };
    case "setTarget": {
      const target = after.targets?.[op.bucket];
      return {
        kind: "target",
        summary: target
          ? `Set ${op.bucket}'s target: ${targetText(target)}`
          : `Cleared ${op.bucket}'s target`,
      };
    }
    case "setNote":
      return {
        kind: "note",
        summary: `${op.note ? "Changed" : "Cleared"} the note on ${labelOf(before, op.beatmapId)}`,
      };
  }
};

const cut = (text: string): string =>
  text.length <= MAX_SUMMARY_LENGTH ? text : `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…`;

/**
 * @function opsActivity
 * @param pool {BuiltContent} the pool before the call
 * @param ops {readonly PoolOp[]} the call's ops (they applied)
 * @returns {ActivityNote} one entry: the first op's kind, every op's summary
 */
export const opsActivity = (pool: BuiltContent, ops: readonly PoolOp[]): ActivityNote => {
  let current = pool;
  const notes: ActivityNote[] = [];
  for (const op of ops) {
    const next = applyOps(current, [op]);
    const after = next.ok ? next.pool : current;
    notes.push(describe(current, after, op));
    current = after;
  }
  const summary = notes
    .map((note, i) =>
      i === 0 ? note.summary : note.summary.charAt(0).toLowerCase() + note.summary.slice(1),
    )
    .join("; ");
  return { kind: notes[0]?.kind ?? "details", summary: cut(summary) };
};

/**
 * @function visibilityActivity
 * @param visibility {Visibility} who sees the pool now
 * @returns {ActivityNote} the entry
 */
export const visibilityActivity = (visibility: Visibility): ActivityNote => ({
  kind: "visibility",
  summary: `Made the pool ${visibility}`,
});

/**
 * @function editorActivity
 * @param change {"added" | "removed" | "left"} what happened
 * @param editor {ActivitySubject} the editor
 * @returns {ActivityNote} the entry (an editor who left is the one who made it, so it names no
 *          subject)
 */
export const editorActivity = (
  change: "added" | "removed" | "left",
  editor: ActivitySubject,
): ActivityNote =>
  change === "left"
    ? { kind: "editors", summary: "Stopped editing the pool" }
    : {
        kind: "editors",
        summary: `${change === "added" ? "Added" : "Removed"} ${editor.username} as an editor`,
        subject: { osuId: editor.osuId, username: editor.username },
      };

/**
 * @function ownerActivity
 * @param owner {ActivitySubject} the new owner
 * @returns {ActivityNote} the entry
 */
export const ownerActivity = (owner: ActivitySubject): ActivityNote => ({
  kind: "owner",
  summary: `Handed the pool to ${owner.username}`,
  subject: { osuId: owner.osuId, username: owner.username },
});

const NOBODY: ActivitySubject = { osuId: 0, username: DELETED_USER };

/**
 * @function withoutSubject
 * @param entry {{ kind: ActivityKind; summary: string }} an editor or owner entry
 * @returns {string} its summary rebuilt naming "deleted user" (from the same wording, never by
 *          replacing text, since a name can be any word the summary also has)
 */
export const withoutSubject = ({
  kind,
  summary,
}: {
  kind: ActivityKind;
  summary: string;
}): string => {
  if (kind === "owner") return ownerActivity(NOBODY).summary;
  if (kind !== "editors") return summary;
  return editorActivity(summary.startsWith("Added ") ? "added" : "removed", NOBODY).summary;
};

/**
 * @function activityWhen
 * @param iso {string} when an entry was written
 * @param now {Date} the time now
 * @returns {string} "just now", "5 min ago", "3 h ago", or the date for a day or more
 */
export const activityWhen = (iso: string, now: Date): string => {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatShortDate(iso);
};
