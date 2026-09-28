/**
 * @file src/utils/bucket-targets.ts
 * @desc Bucket targets, the pure side: a /new template as targets (counts only) and its label,
 *       each bucket's shortfall and what its placeholder says ("2 more NM maps"), which side of
 *       a star range a map's stars under its slot's mods fall on (unknown stars never count), the
 *       maps outside their bucket's range, what a target says, and the target form's text read
 *       into a target. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { slotLabel } from "@haruhimemoe/pool";
import {
  POOL_TEMPLATES,
  type PoolTemplate,
  TARGET_MESSAGES,
  TARGET_STARS,
  type TemplateId,
} from "@/constants/targets";
import type { BucketTarget, BucketTargets, TargetRange } from "@/schemas/built-plan";
import { bucketTargetSchema } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import type { SlotGroup } from "@/utils/built-editor";
import { starsUnderMods } from "@/utils/built-summary";
import { formatRange, formatStars } from "@/utils/format";
import type { SlotValueMap } from "@/utils/slot-values";

/**
 * @function templateLabel
 * @param template {PoolTemplate} a template
 * @returns {string} "Qualifiers (5 NM, 2 HD, 2 HR, 3 DT, 2 FM)", or just "Blank"
 */
export const templateLabel = (template: PoolTemplate): string => {
  const counts = Object.entries(template.counts).map(([code, count]) => `${count} ${code}`);
  return counts.length === 0 ? template.name : `${template.name} (${counts.join(", ")})`;
};

/**
 * @function templateTargets
 * @param id {TemplateId} a template
 * @returns {Record<string, BucketTarget>} its counts as targets (no star ranges)
 */
export const templateTargets = (id: TemplateId): Record<string, BucketTarget> => {
  const template = POOL_TEMPLATES.find((entry) => entry.id === id);
  return Object.fromEntries(
    Object.entries(template?.counts ?? {}).map(([code, count]) => [code, { count }]),
  );
};

export type TargetGap = { code: string; have: number; want: number; missing: number };

/**
 * @function targetGaps
 * @param groups {readonly SlotGroup[]} the pool's slots by bucket
 * @param targets {BucketTargets} its targets
 * @returns {TargetGap[]} each bucket short of its count, in the pool's order
 */
export const targetGaps = (groups: readonly SlotGroup[], targets: BucketTargets): TargetGap[] =>
  groups.flatMap((group) => {
    const want = group.code === null ? 0 : (targets[group.code]?.count ?? 0);
    const have = group.slots.length;
    return group.code !== null && have < want
      ? [{ code: group.code, have, want, missing: want - have }]
      : [];
  });

/**
 * @function placeholderText
 * @param code {string} a bucket
 * @param missing {number} maps it still needs (1 or more)
 * @returns {string} "2 more NM maps"
 */
export const placeholderText = (code: string, missing: number): string =>
  `${missing} more ${code} ${missing === 1 ? "map" : "maps"}`;

/**
 * @function rangeSide
 * @param stars {number | null} a map's stars under its slot's mods (null: unknown)
 * @param sr {TargetRange | undefined} its bucket's range
 * @returns {"below" | "above" | null} where it falls outside the range (ends included), or null
 */
export const rangeSide = (
  stars: number | null,
  sr: TargetRange | undefined,
): "below" | "above" | null => {
  if (stars === null || !sr) return null;
  if (stars < sr.min) return "below";
  return stars > sr.max ? "above" : null;
};

export type OutOfRange = {
  beatmapId: number;
  slot: string;
  stars: number;
  side: "below" | "above";
  sr: TargetRange;
};

/**
 * @function targetsOutOfRange
 * @param groups {readonly SlotGroup[]} the pool's slots by bucket
 * @param maps {BuiltMaps} map details
 * @param values {SlotValueMap} values under each slot's mods, as far as they're known
 * @param targets {BucketTargets} its targets
 * @returns {OutOfRange[]} each map whose known stars are outside its bucket's range, in order
 */
export const targetsOutOfRange = (
  groups: readonly SlotGroup[],
  maps: BuiltMaps,
  values: SlotValueMap,
  targets: BucketTargets,
): OutOfRange[] =>
  groups.flatMap((group) => {
    const sr = group.code === null ? undefined : targets[group.code]?.sr;
    if (!sr) return [];
    return group.slots.flatMap((slot) => {
      const stars = starsUnderMods(slot, group.entry, maps, values);
      const side = rangeSide(stars, sr);
      return side && stars !== null
        ? [{ beatmapId: slot.beatmapId, slot: slotLabel(slot), stars, side, sr }]
        : [];
    });
  });

/**
 * @function targetRangeText
 * @param sr {TargetRange} a star range
 * @returns {string} "5.80–6.30★"
 */
export const targetRangeText = (sr: TargetRange): string =>
  `${formatRange(sr.min, sr.max, formatStars)}★`;

/**
 * @function rangeBadgeText
 * @param side {"below" | "above"} where a map's stars fall
 * @param sr {TargetRange} its bucket's range
 * @returns {string} "Below 5.80–6.30★"
 */
export const rangeBadgeText = (side: "below" | "above", sr: TargetRange): string =>
  `${side === "below" ? "Below" : "Above"} ${targetRangeText(sr)}`;

/**
 * @function targetText
 * @param target {BucketTarget} a bucket's target
 * @returns {string} "5 maps", "1 map, 5.80–6.30★", or only the range for a count of 0
 */
export const targetText = ({ count, sr }: BucketTarget): string => {
  const parts = [
    count > 0 ? `${count} ${count === 1 ? "map" : "maps"}` : null,
    sr ? targetRangeText(sr) : null,
  ];
  return parts.filter((part) => part !== null).join(", ");
};

export type TargetInput = { count: string; min: string; max: string };
export type TargetRead =
  | ({ ok: true } & BucketTarget)
  | { ok: false; field: "count" | "range"; message: string };

const STAR_TEXT = /^\d+(?:[.,]\d+)?$/;
const readStars = (text: string): number | null => {
  const trimmed = text.trim();
  if (!STAR_TEXT.test(trimmed)) return null;
  const stars = Number(trimmed.replace(",", "."));
  return stars <= TARGET_STARS.max ? Math.round(stars * 100) / 100 : null;
};

/**
 * @function readTargetInput
 * @param input {TargetInput} the target form's text (an empty count is 0)
 * @returns {TargetRead} the target, or which field is wrong and why
 */
export const readTargetInput = (input: TargetInput): TargetRead => {
  const countText = input.count.trim() || "0";
  const count = /^\d{1,2}$/.test(countText) ? Number(countText) : Number.NaN;
  const counted = bucketTargetSchema.shape.count.safeParse(count);
  if (!counted.success) return { ok: false, field: "count", message: TARGET_MESSAGES.count };
  const [minText, maxText] = [input.min.trim(), input.max.trim()];
  if (minText === "" && maxText === "") return { ok: true, count };
  if (minText === "" || maxText === "") {
    return { ok: false, field: "range", message: TARGET_MESSAGES.bothEnds };
  }
  const [min, max] = [readStars(minText), readStars(maxText)];
  if (min === null || max === null) {
    return { ok: false, field: "range", message: TARGET_MESSAGES.stars };
  }
  if (min > max) return { ok: false, field: "range", message: TARGET_MESSAGES.crossed };
  return { ok: true, count, sr: { min, max } };
};
