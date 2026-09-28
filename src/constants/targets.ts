/**
 * @file src/constants/targets.ts
 * @desc Planning a pool: each bucket's target (how many maps it should hold, 0 to 16, and an
 *       optional star range under its mods, on the search's own star scale) and the templates
 *       /new offers, and how long a slot's note can be. A template only sets counts; it never adds maps. The counts are common
 *       shapes for each stage of a tournament, not a rule: the owner changes them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { STAR_RANGE } from "@/constants/search";

/** A slot's note, in characters. */
export const MAX_SLOT_NOTE_LENGTH = 280;

/** The most maps a bucket's target can ask for. */
export const MAX_TARGET_COUNT = 16;

/** A target's star range: the search's star scale (0 to 10, two decimals). */
export const TARGET_STARS = STAR_RANGE;

/** /new's templates, by id. */
export const TEMPLATE_IDS = ["blank", "qualifiers", "groups", "knockout", "finals"] as const;
/** One of TEMPLATE_IDS. */
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** A template: its name, what it's for, and a map count per bucket (never maps). */
export type PoolTemplate = {
  id: TemplateId;
  name: string;
  /** Maps per built-in bucket, in the pool's bucket order. */
  counts: Readonly<Partial<Record<"NM" | "HD" | "HR" | "DT" | "FM" | "TB", number>>>;
};

/** The templates /new offers. */
export const POOL_TEMPLATES: readonly PoolTemplate[] = Object.freeze([
  { id: "blank", name: "Blank", counts: {} },
  { id: "qualifiers", name: "Qualifiers", counts: { NM: 5, HD: 2, HR: 2, DT: 3, FM: 2 } },
  { id: "groups", name: "Group stage", counts: { NM: 6, HD: 3, HR: 3, DT: 4, FM: 3, TB: 1 } },
  { id: "knockout", name: "Knockout", counts: { NM: 6, HD: 4, HR: 4, DT: 4, FM: 3, TB: 1 } },
  { id: "finals", name: "Finals", counts: { NM: 7, HD: 4, HR: 4, DT: 5, FM: 4, TB: 1 } },
]);

/** What a target's refusals say. */
export const TARGET_MESSAGES = {
  count: `A slot's target is 0 to ${MAX_TARGET_COUNT} maps.`,
  bothEnds: "Give both ends of the star range, or neither.",
  crossed: "The low end is above the high end.",
  stars: `Star ratings are ${TARGET_STARS.min} to ${TARGET_STARS.max}.`,
} as const;
