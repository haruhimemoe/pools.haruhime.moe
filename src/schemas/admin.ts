/**
 * @file src/schemas/admin.ts
 * @desc What admin forms send. A pool edit: tournament (1 to 100 characters), round (up to 100; an
 *       empty one is none), year (2007 to 2099, or unknown), notes (up to 2000), hidden and badged,
 *       all text trimmed and through the content filter, nothing else. A badged change for every
 *       pool of a tournament key: one year, unknown years (null) or all. A sync retry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import {
  FIRST_YEAR,
  MAX_NOTES_LENGTH,
  MAX_ROUND_LENGTH,
  MAX_TOURNAMENT_LENGTH,
} from "@/constants/pools";
import { hasBlockedLanguage } from "@/utils/content-filter";

const LAST_YEAR = 2099;

const cleanText = (max: number, field: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${field} to ${max} characters or fewer.`)
    .refine((value) => !hasBlockedLanguage(value), `Please keep the ${field} free of slurs.`);

const yearSchema = z.number().int().min(FIRST_YEAR).max(LAST_YEAR);

export const poolEditBodySchema = z.strictObject({
  tournament: cleanText(MAX_TOURNAMENT_LENGTH, "tournament").refine(
    (value) => value !== "",
    "The tournament needs a name.",
  ),
  round: cleanText(MAX_ROUND_LENGTH, "round")
    .nullable()
    .transform((value) => (value === "" ? null : value)),
  year: yearSchema.nullable(),
  notes: cleanText(MAX_NOTES_LENGTH, "notes"),
  hidden: z.boolean(),
  badged: z.boolean().nullable(),
});

export type PoolEditBody = z.output<typeof poolEditBodySchema>;

export const badgedBodySchema = z.strictObject({
  tournamentKey: z.string().min(1).max(200),
  year: z.union([yearSchema, z.null(), z.literal("all")]),
  badged: z.boolean().nullable(),
});

export type BadgedBody = z.output<typeof badgedBodySchema>;

export const syncBodySchema = z.strictObject({ includeRejected: z.boolean() });
