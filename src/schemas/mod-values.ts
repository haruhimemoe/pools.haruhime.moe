/**
 * @file src/schemas/mod-values.ts
 * @desc Values under a mod combo: what the mirror's pp/batch sends per beatmap id (stars, AR, OD,
 *       CS and BPM, already under the combo, DT timing included; its other fields are dropped)
 *       and the mod_values cache row that keeps them (keyed "<beatmap id>:<combo>", with the
 *       time they were fetched for the 30-day TTL), or that says the mirror lacked the id or its
 *       call failed, so a page loaded over and over doesn't ask again each time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { z } from "zod";

/** AR and OD can pass 10 (DT) or drop below 0 (EZ with HT). */
export const modValuesSchema = z.object({
  stars: z.number().nonnegative(),
  ar: z.number(),
  od: z.number(),
  cs: z.number(),
  bpm: z.number().nonnegative(),
});

/** A difficulty's values under one combo. */
export type ModValues = z.output<typeof modValuesSchema>;

/** Values kept 30 days in mod_values. */
export const storedModValuesSchema = modValuesSchema.extend({
  _id: z.string(),
  beatmapId: z.number().int().positive(),
  mods: z.string(),
  fetchedAt: z.date(),
});

/** Values as stored. */
export type StoredModValues = z.output<typeof storedModValuesSchema>;

/** Why a mod_values row holds no values: the mirror lacked the id, or the call failed. */
export const MOD_VALUES_RESTS = ["missing", "failed"] as const;

/** A rest row: ids the mirror lacked, or a failed call's, asked again later. */
export const storedModRestSchema = z.object({
  _id: z.string(),
  beatmapId: z.number().int().positive(),
  mods: z.string(),
  rest: z.enum(MOD_VALUES_RESTS),
  fetchedAt: z.date(),
});

/** A rest row. */
export type StoredModRest = z.output<typeof storedModRestSchema>;
