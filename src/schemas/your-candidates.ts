/**
 * @file src/schemas/your-candidates.ts
 * @desc GET /api/candidates: its query (the pool being edited and the bucket whose mods the stars
 *       are under, a source-slot bucket filter, text, whether picks come too, a page) and its
 *       answer's rows (an entry from src/utils/your-candidates.ts with its map's details and its
 *       values under the current bucket's mods). Anything unreadable in the query falls back to
 *       its default; the pool id must be a built pool's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { BUCKET_CODE_PATTERN } from "@haruhimemoe/pool";
import { z } from "zod";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { YOUR_CANDIDATES } from "@/constants/candidates";
import type { BuiltMap } from "@/schemas/built-pool-view";
import type { SlotValueAnswer } from "@/utils/slot-values";
import type { OwnEntry } from "@/utils/your-candidates";

const code = z.string().regex(BUCKET_CODE_PATTERN);

/** The query, read leniently: a bad bucket, page or flag reads as its default. */
export const yourCandidatesQuerySchema = z.object({
  pool: z.string().regex(BUILT_POOL_ID_PATTERN),
  under: code.catch("NM"),
  bucket: code.nullable().catch(null),
  q: z.string().trim().max(YOUR_CANDIDATES.maxQuery).catch(""),
  picks: z
    .literal("1")
    .nullable()
    .catch(null)
    .transform((flag) => flag === "1"),
  page: z.coerce.number().int().min(1).max(200).catch(1),
});

/** A parsed query. */
export type YourCandidatesQuery = z.infer<typeof yourCandidatesQuerySchema>;

/**
 * @function readYourCandidatesQuery
 * @param params {URLSearchParams} the request's search params
 * @returns {YourCandidatesQuery | null} the query, or null without a built pool id
 */
export const readYourCandidatesQuery = (params: URLSearchParams): YourCandidatesQuery | null => {
  const parsed = yourCandidatesQuerySchema.safeParse({
    pool: params.get("pool") ?? "",
    under: params.get("under") ?? "NM",
    bucket: params.get("bucket") || null,
    q: params.get("q") ?? "",
    picks: params.get("picks"),
    page: params.get("page") ?? 1,
  });
  return parsed.success ? parsed.data : null;
};

/** One row of the answer. */
export type YourCandidateRow = OwnEntry & {
  map: BuiltMap | null;
  /** Its values under the current bucket's mods, once known. */
  values: SlotValueAnswer | null;
};

/** The answer: a page of rows, the total, the pages, and whether every value is the mirror's. */
export type YourCandidatesAnswer = {
  rows: YourCandidateRow[];
  total: number;
  page: number;
  pages: number;
  /** The combo the values are under ("HDHR", "NM"...). */
  under: string;
  complete: boolean;
};
