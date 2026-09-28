/**
 * @file src/schemas/compliance.ts
 * @desc The check's shapes: a cached beatmapset's facts (setFacts rows, keyed by set id, with the
 *       difficulty ids seen for it), one set's verdict as the route sends it (with the package's
 *       wording, so browsers never load the rules' data), what the check says about each map in
 *       our pools, and the whole answer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { ComplianceReason, ComplianceStatus } from "@haruhimemoe/compliance";
import { z } from "zod";

/** A cached beatmapset's facts for the check, with its difficulty ids. */
export const setFactsDocSchema = z.object({
  _id: z.number().int().positive(),
  status: z.string(),
  artist: z.string(),
  title: z.string(),
  artistUnicode: z.string(),
  titleUnicode: z.string(),
  source: z.string(),
  tags: z.string(),
  trackId: z.number().int().nullable(),
  downloadDisabled: z.boolean(),
  moreInformation: z.string().nullable(),
  beatmapIds: z.array(z.number().int().positive()),
  fetchedAt: z.date(),
});

/** A cached beatmapset's facts. */
export type SetFactsDoc = z.infer<typeof setFactsDocSchema>;

/** One beatmapset's verdict, for every asked map in it. */
export type ComplianceSet = {
  setId: number;
  beatmapIds: number[];
  status: ComplianceStatus;
  reason?: ComplianceReason;
  notes?: string;
  /** The package's wording for the verdict. */
  text: string;
  ranked: boolean;
};

/** What pools knows about a checked map: its label (when a pool that isn't hidden has it) and usage. */
export type CheckMap = { label: string | null; count: number; lastYear: number | null };

/** What GET /api/check answers. */
export type CheckResponse = {
  sets: ComplianceSet[];
  /** Ids osu! doesn't know. */
  missing: number[];
  /** Ids we couldn't check this time (budget spent, osu! failed). */
  unchecked: number[];
  /** By beatmap id, as text. */
  maps: Record<string, CheckMap>;
};
