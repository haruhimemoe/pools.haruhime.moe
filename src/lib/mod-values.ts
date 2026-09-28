/**
 * @file src/lib/mod-values.ts
 * @desc Stars, AR, OD, CS and BPM under a mod combo from the hinai mirror's precomputed rosu-pp
 *       values (GET /v3/osu/pp/batch?ids=&mods=, server only, SERVER_USER_AGENT, 10 s timeout,
 *       100 ids a call), kept 30 days in mod_values per beatmap id and combo. Ids the mirror
 *       lacks come back missing and aren't cached (the mirror computes cold maps soon after);
 *       a failed call (an error status, a body that isn't the answer, success false, another
 *       combo than asked, a dropped connection or timeout) answers its ids missing, caches
 *       nothing and says it failed. The mirror search's Retry-After cool-down applies here too.
 *       The caller falls back to no-mod values and src/utils/mod-values.ts for missing ids.
 *       A cache read or write that fails is logged and skipped. Never rejects on the mirror.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { z } from "zod";
import { QUERY_TIME_MS } from "@/constants/db";
import { PP_BATCH_SIZE, PP_BATCH_TIMEOUT_MS, PP_BATCH_URL } from "@/constants/mod-values";
import { SERVER_USER_AGENT } from "@/constants/site";
import { isMirrorCooling, noteMirrorRetryAfter } from "@/lib/map-search";
import { modValuesCollection } from "@/models/ModValues";
import { type ModValues, modValuesSchema, storedModValuesSchema } from "@/schemas/mod-values";
import { modsCode, parseMods } from "@/utils/mod-values";

export type ModValuesResult = {
  /** Values under the combo, by beatmap id. */
  values: Map<number, ModValues>;
  /** Asked ids with no values, in the order asked. */
  missing: number[];
  /** Whether a mirror call failed (or was skipped for a Retry-After). */
  failed: boolean;
};

export type ModValuesDeps = { fetch?: typeof fetch; timeoutMs?: number; now?: () => number };

const answerSchema = z.object({
  success: z.boolean().optional(),
  results: z.record(z.string(), z.unknown()),
  mods: z.string().optional(),
});

/** One mirror call: the ids it had values for, or null when it failed. */
const askMirror = async (
  ids: readonly number[],
  code: string,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = PP_BATCH_TIMEOUT_MS,
    now = Date.now,
  }: ModValuesDeps,
): Promise<Map<number, ModValues> | null> => {
  const url = `${PP_BATCH_URL}?${new URLSearchParams({ ids: ids.join(","), mods: code })}`;
  let body: unknown;
  try {
    const response = await doFetch(url, {
      headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      noteMirrorRetryAfter(response, now());
      console.error(`[mod-values] the mirror answered ${response.status}`);
      return null;
    }
    body = await response.json();
  } catch (error) {
    console.error("[mod-values] the mirror call failed", error);
    return null;
  }
  const answer = answerSchema.safeParse(body);
  if (!answer.success || answer.data.success === false) return null;
  if (answer.data.mods !== undefined && answer.data.mods !== code) return null;
  const found = new Map<number, ModValues>();
  for (const id of ids) {
    const row = modValuesSchema.safeParse(answer.data.results[String(id)]);
    if (row.success) found.set(id, row.data);
  }
  return found;
};

/** A cache row's key. */
const keyOf = (id: number, code: string): string => `${id}:${code}`;

/** Cached values for the ids under the combo; none when the read fails. */
const readCache = async (ids: readonly number[], code: string): Promise<Map<number, ModValues>> => {
  const found = new Map<number, ModValues>();
  try {
    const rows = await (await modValuesCollection())
      .find({ _id: { $in: ids.map((id) => keyOf(id, code)) } }, { maxTimeMS: QUERY_TIME_MS })
      .toArray();
    for (const row of rows) {
      const parsed = storedModValuesSchema.safeParse(row);
      if (parsed.success && parsed.data.mods === code) {
        const { stars, ar, od, cs, bpm } = parsed.data;
        found.set(parsed.data.beatmapId, { stars, ar, od, cs, bpm });
      }
    }
  } catch (error) {
    console.error("[mod-values] couldn't read mod_values", error);
  }
  return found;
};

/** Keeps fetched values; a failed write is logged. */
const writeCache = async (
  values: ReadonlyMap<number, ModValues>,
  code: string,
  fetchedAt: Date,
): Promise<void> => {
  if (values.size === 0) return;
  try {
    await (await modValuesCollection()).bulkWrite(
      [...values].map(([beatmapId, row]) => ({
        replaceOne: {
          filter: { _id: keyOf(beatmapId, code) },
          replacement: { _id: keyOf(beatmapId, code), beatmapId, mods: code, ...row, fetchedAt },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (error) {
    console.error("[mod-values] couldn't write mod_values", error);
  }
};

/**
 * @function getModValues
 * @param ids {readonly number[]} beatmap ids (each asked once)
 * @param mods {string} a mod combo ("NM", "HDHR", any order, NC as DT)
 * @param deps {ModValuesDeps} fetch, timeout and clock (tests)
 * @returns {Promise<ModValuesResult>} values from the cache and the mirror, the ids with none,
 *          and whether a mirror call failed
 * @throws {RangeError} when mods isn't a combo osu! allows
 */
export const getModValues = async (
  ids: readonly number[],
  mods: string,
  deps: ModValuesDeps = {},
): Promise<ModValuesResult> => {
  const parsed = parseMods(mods);
  if (parsed === null) throw new RangeError(`Not a mod combo: ${mods}`);
  const code = modsCode(parsed);
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { values: new Map(), missing: [], failed: false };
  const values = await readCache(unique, code);
  const asked = unique.filter((id) => !values.has(id));
  const now = deps.now ?? Date.now;
  let failed = false;
  if (asked.length > 0 && isMirrorCooling(now())) failed = true;
  else if (asked.length > 0) {
    const chunks: number[][] = [];
    for (let i = 0; i < asked.length; i += PP_BATCH_SIZE) {
      chunks.push(asked.slice(i, i + PP_BATCH_SIZE));
    }
    const answers = await Promise.all(chunks.map((chunk) => askMirror(chunk, code, deps)));
    const fetched = new Map<number, ModValues>();
    for (const answer of answers) {
      if (answer === null) failed = true;
      else for (const [id, row] of answer) fetched.set(id, row);
    }
    await writeCache(fetched, code, new Date(now()));
    for (const [id, row] of fetched) values.set(id, row);
  }
  return { values, missing: unique.filter((id) => !values.has(id)), failed };
};
