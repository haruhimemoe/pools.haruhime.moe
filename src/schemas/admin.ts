/**
 * @file src/schemas/admin.ts
 * @desc What admin forms send. A pool edit: tournament (1 to 100 characters), round (up to 100; an
 *       empty one is none), year (2007 to 2099, or unknown), notes (up to 2000), hidden and badged,
 *       all text trimmed and through the content filter, nothing else. A badged change for every
 *       pool of a tournament key: one year, unknown years (null) or all. A sync retry. A refresh
 *       of the public pages and a pack cleanup retry (empty objects). An added pool: who sent it (host or community),
 *       the credit's name and optional https link (empty means none), tournament, round, year,
 *       badged, notes and the maps as text; fieldErrors names each problem by its field.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { z } from "zod";
import {
  CREDITED_SOURCE_KINDS,
  FIRST_YEAR,
  MAX_NOTES_LENGTH,
  MAX_ROUND_LENGTH,
  MAX_TOURNAMENT_LENGTH,
} from "@/constants/pools";
import { sourceCreditSchema } from "@/schemas/pool";
import { hasBlockedLanguage } from "@/utils/content-filter";

const LAST_YEAR = 2099;

const cleanText = (max: number, field: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${field} to ${max} characters or fewer.`)
    .refine((value) => !hasBlockedLanguage(value), `Please keep the ${field} free of slurs.`);

const YEAR_RANGE = `The year goes from ${FIRST_YEAR} to ${LAST_YEAR}.`;

const yearSchema = z
  .number(YEAR_RANGE)
  .int(YEAR_RANGE)
  .min(FIRST_YEAR, YEAR_RANGE)
  .max(LAST_YEAR, YEAR_RANGE);

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

/** A refresh of the public pages takes nothing: an empty object. */
export const revalidateBodySchema = z.strictObject({});

/** "Retry pack cleanup" takes nothing either. */
export const packCleanupBodySchema = z.strictObject({});

/** PATCH /api/admin/built-pools/<id>: hide a built pool, or show it again. */
export const builtHiddenBodySchema = z.strictObject({ hidden: z.boolean() });

/** The most text the maps field takes: 64 maps with long links and their slots fit easily. */
export const MAX_MAPS_TEXT = 8000;

const HTTPS_LINK = "Use an https link, or leave it empty.";

export const addPoolBodySchema = z.strictObject({
  kind: z.enum(CREDITED_SOURCE_KINDS, "Pick who sent the pool."),
  creditName: sourceCreditSchema.shape.name,
  creditUrl: z
    .string(HTTPS_LINK)
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.url({ protocol: /^https$/, error: HTTPS_LINK }).nullable()),
  tournament: cleanText(MAX_TOURNAMENT_LENGTH, "tournament").refine(
    (value) => value !== "",
    "The tournament needs a name.",
  ),
  round: cleanText(MAX_ROUND_LENGTH, "round")
    .nullable()
    .transform((value) => (value === "" ? null : value)),
  year: yearSchema.nullable(),
  badged: z.boolean().nullable(),
  notes: cleanText(MAX_NOTES_LENGTH, "notes"),
  maps: z
    .string()
    .max(MAX_MAPS_TEXT, `Keep the maps to ${MAX_MAPS_TEXT} characters.`)
    .refine((value) => value.trim() !== "", "Paste the maps."),
});

export type AddPoolBody = z.output<typeof addPoolBodySchema>;

export type AddPoolField = keyof AddPoolBody;

/**
 * @function fieldErrors
 * @param error {z.ZodError} a failed parse
 * @returns {Record<string, string>} the first message for each top-level field; problems with
 *          no field (an extra key) under "form"
 */
export const fieldErrors = (error: z.ZodError): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const [key] = issue.path;
    const name = typeof key === "string" ? key : "form";
    fields[name] ??= issue.message;
  }
  return fields;
};
