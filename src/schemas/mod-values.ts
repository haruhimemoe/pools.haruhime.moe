/**
 * @file src/schemas/mod-values.ts
 * @desc Values under a mod combo: what the mirror's pp/batch sends per beatmap id (stars, AR, OD,
 *       CS and BPM, already under the combo, DT timing included; its other fields are dropped)
 *       and the mod_values cache row that keeps them (keyed "<beatmap id>:<combo>", with the
 *       time they were fetched for the 30-day TTL).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
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

export type ModValues = z.output<typeof modValuesSchema>;

export const storedModValuesSchema = modValuesSchema.extend({
  _id: z.string(),
  beatmapId: z.number().int().positive(),
  mods: z.string(),
  fetchedAt: z.date(),
});

export type StoredModValues = z.output<typeof storedModValuesSchema>;
