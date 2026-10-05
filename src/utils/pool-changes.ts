/**
 * @file src/utils/pool-changes.ts
 * @desc A pool revision's changes as lines people read ("Added 2015 to NM3", "Moved 2015 from
 *       NM3 to HD1"), built from @haruhimemoe/vcs's structured diff and the two snapshots it
 *       compares. Slots are keyed by beatmap id, so a map's slot change shows once, whichever of
 *       a top-level move or a nested mod/index set the codec reports it as. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { PoolSlot } from "@haruhimemoe/pool";
import { slotLabel } from "@haruhimemoe/pool";
import type { Change } from "@haruhimemoe/vcs";
import type { PoolSnapshot } from "@/utils/pool-snapshot";

/** One line of a change view; `beatmapId` links the map when there is one. */
export type ChangeLine = {
  kind: "added" | "removed" | "moved" | "changed";
  text: string;
  beatmapId?: number;
};

const label = ({ mod, index }: Pick<PoolSlot, "mod" | "index">): string =>
  slotLabel({ mod, index });

const DETAILS: Readonly<Record<string, string>> = {
  name: "name",
  tournament: "tournament",
  round: "round",
  year: "year",
};

/** A bucket (slot) change: added, removed, reordered, its mods changed, or something else. */
const bucketLine = (change: Change): ChangeLine => {
  const item = change.segments[1];
  if (change.segments.length === 1) {
    if (change.op === "add") return { kind: "added", text: `Added slot ${change.key}` };
    if (change.op === "remove") return { kind: "removed", text: `Removed slot ${change.key}` };
    if (change.op === "move") return { kind: "moved", text: "Reordered slots" };
  }
  const code = typeof item === "object" ? item.key : "key" in change ? change.key : "";
  // The field name is the segment after the item when nested further (a set inside "mods"), or
  // the change's own key when the field itself was just added or removed.
  const field = change.segments.length > 2 ? change.segments[2] : "key" in change ? change.key : "";
  if (field === "mods") return { kind: "changed", text: `Changed the mods on ${code}` };
  return { kind: "changed", text: `Changed slot ${code}` };
};

/** A slot note change: added, removed or changed, by the beatmap id it's keyed on. */
const noteLine = (change: Change): ChangeLine => {
  const item = change.segments[1];
  const id = typeof item === "string" ? item : "key" in change ? change.key : "";
  const beatmapId = Number(id);
  if (change.op === "add") return { kind: "added", text: `Added a note on ${id}`, beatmapId };
  if (change.op === "remove") {
    return { kind: "removed", text: `Removed the note on ${id}`, beatmapId };
  }
  return { kind: "changed", text: `Changed the note on ${id}`, beatmapId };
};

/**
 * @function poolChangeLines
 * @param changes {readonly Change[]} diffValue(before, after, POOL_CODEC)
 * @param before {PoolSnapshot} the older snapshot
 * @param after {PoolSnapshot} the newer snapshot
 * @returns {ChangeLine[]} what changed, in document order
 */
export const poolChangeLines = (
  changes: readonly Change[],
  before: PoolSnapshot,
  after: PoolSnapshot,
): ChangeLine[] => {
  const was = new Map(before.slots.map((slot) => [String(slot.beatmapId), slot]));
  const now = new Map(after.slots.map((slot) => [String(slot.beatmapId), slot]));
  const seen = new Set<string>();
  const lines: ChangeLine[] = [];
  for (const change of changes) {
    const [top, item, field] = change.segments;
    if (top === "slots" && change.segments.length === 1) {
      if (change.op === "add" || change.op === "remove") {
        const slot = change.value as PoolSlot;
        const added = change.op === "add";
        lines.push({
          kind: added ? "added" : "removed",
          text: `${added ? "Added" : "Removed"} ${slot.beatmapId} ${added ? "to" : "from"} ${label(slot)}`,
          beatmapId: slot.beatmapId,
        });
      } else if (change.op === "move" && !seen.has(change.key)) {
        seen.add(change.key);
        const from = was.get(change.key);
        const to = now.get(change.key);
        if (!from || !to) continue;
        const moved = label(from) !== label(to);
        lines.push({
          kind: "moved",
          text: moved
            ? `Moved ${to.beatmapId} from ${label(from)} to ${label(to)}`
            : `Reordered ${to.beatmapId} in ${label(to)}`,
          beatmapId: to.beatmapId,
        });
      }
    } else if (
      top === "slots" &&
      typeof item === "object" &&
      (field === "mod" || field === "index")
    ) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      const from = was.get(item.key);
      const to = now.get(item.key);
      if (from && to) {
        lines.push({
          kind: "moved",
          text: `Moved ${to.beatmapId} from ${label(from)} to ${label(to)}`,
          beatmapId: to.beatmapId,
        });
      }
    } else if (top === "buckets") {
      lines.push(bucketLine(change));
    } else if (top === "targets") {
      const code = typeof item === "string" ? item : "key" in change ? change.key : "";
      lines.push({ kind: "changed", text: `Changed the target for ${code}` });
    } else if (top === "slotNotes") {
      lines.push(noteLine(change));
    } else if (top === "notes") {
      lines.push({ kind: "changed", text: "Changed the notes" });
    } else if (typeof top === "string" && top in DETAILS && change.op === "set") {
      lines.push({
        kind: "changed",
        text: `Changed the ${DETAILS[top]} to ${String(change.to ?? "none")}`,
      });
    }
  }
  return lines;
};
