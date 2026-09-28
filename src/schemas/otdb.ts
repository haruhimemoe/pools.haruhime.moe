/**
 * @file src/schemas/otdb.ts
 * @desc otdb's mappool export (https://otdb.sheppsu.me/static/mappools-export.json), only the
 *       fields the importer uses: each pool's id, name and description, and per map its slot
 *       label, mods, set (id, artist, title, set host) and difficulty (osu! id, name, AR, OD,
 *       CS, HP, length, BPM, all without mods). Submitters, favorite counts and star ratings are
 *       dropped on parse and never stored.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { z } from "zod";

/** One map in a pool. `beatmap.id` is otdb's own id; the osu! id is `beatmap_metadata.id`. */
export const otdbConnectionSchema = z.object({
  slot: z.string(),
  beatmap: z.object({
    mods: z.array(z.object({ acronym: z.string() })),
    beatmapset_metadata: z.object({
      id: z.number().int().positive(),
      artist: z.string(),
      title: z.string(),
      creator: z.string(),
    }),
    beatmap_metadata: z.object({
      id: z.number().int().positive(),
      difficulty: z.string(),
      ar: z.number(),
      od: z.number(),
      cs: z.number(),
      hp: z.number(),
      /** Seconds, without mods. */
      length: z.number().nonnegative(),
      bpm: z.number().nonnegative(),
    }),
  }),
});

/** One map of an otdb pool, as the export writes it. */
export type OtdbConnection = z.infer<typeof otdbConnectionSchema>;

/** One otdb pool in the export. */
export const otdbPoolSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z
    .string()
    .nullish()
    .transform((text) => text ?? ""),
  beatmap_connections: z.array(otdbConnectionSchema),
});

/** An otdb pool. */
export type OtdbPool = z.infer<typeof otdbPoolSchema>;
