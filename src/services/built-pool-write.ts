/**
 * @file src/services/built-pool-write.ts
 * @desc What ops and revert share when they write a built pool's content: the 409 (the pool as
 *       it is now, for whoever can still see it), the $set/$unset that writes only content
 *       fields (so editors, pack and hidden survive untouched), and the ZodError mapping a bad
 *       `toStored` throws into a 400 with the content rule's code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { z } from "zod";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { SessionUser } from "@/schemas/session-user";
import { findBuiltPool, viewOf } from "@/services/built-pool-read";
import { accessOf } from "@/utils/built-access";
import { NOT_FOUND, type Refusal, refuse } from "@/utils/built-answer";
import type { BuiltSearchFields } from "@/utils/built-record";

/** The 409's message: the pool comes with it. */
export const CONFLICT_MESSAGE = "Someone else changed this pool. Here it is as it is now.";

/**
 * @function conflict
 * @param id {string} the pool
 * @param caller {SessionUser} who tried to write it
 * @returns {Promise<Refusal>} 409 with the pool as it is now, or 404 when the caller can no
 *          longer see it (an editor removed mid-call)
 */
export const conflict = async (id: string, caller: SessionUser): Promise<Refusal> => {
  const current = await findBuiltPool(id);
  // An editor removed since the first read gets a 404, never the pool.
  if (!current || !accessOf(current, caller).canView) return refuse(404, "not_found", NOT_FOUND);
  return refuse(409, "conflict", CONFLICT_MESSAGE, { pool: await viewOf(current, caller) });
};

/**
 * @function contentOf
 * @param pool {StoredBuiltPool & BuiltSearchFields} the pool to write, already through toStored
 * @returns {{ $set: object; $unset?: object }} the update: content, search fields, version and
 *          when (buckets, targets, slotNotes and candidates unset when toStored left them out)
 */
export const contentOf = ({
  buckets,
  targets,
  slotNotes,
  candidates,
  ...pool
}: StoredBuiltPool & BuiltSearchFields) => {
  // toStored leaves out the default buckets and empty plans: the stored ones go too.
  const gone: Record<string, ""> = {};
  for (const [key, value] of Object.entries({ buckets, targets, slotNotes, candidates })) {
    if (value === undefined) gone[key] = "";
  }
  return {
    $set: {
      searchText: pool.searchText,
      sortName: pool.sortName,
      mapCount: pool.mapCount,
      name: pool.name,
      tournament: pool.tournament,
      round: pool.round,
      year: pool.year,
      notes: pool.notes,
      slots: pool.slots,
      version: pool.version,
      updatedAt: pool.updatedAt,
      ...(buckets === undefined ? {} : { buckets }),
      ...(targets === undefined ? {} : { targets }),
      ...(slotNotes === undefined ? {} : { slotNotes }),
      ...(candidates === undefined ? {} : { candidates }),
    },
    ...(Object.keys(gone).length > 0 ? { $unset: gone } : {}),
  };
};

/**
 * @function refusalOfZod
 * @param error {unknown} whatever `toStored` threw
 * @returns {Refusal} 400 with the stored schema's named code (content_filter and so on) when the
 *          error carries one, else a generic "invalid"
 */
export const refusalOfZod = (error: unknown): Refusal => {
  const issue = error instanceof z.ZodError ? error.issues[0] : undefined;
  const named = issue?.code === "custom" ? issue.params?.code : undefined;
  return refuse(
    400,
    typeof named === "string" ? named : "invalid",
    issue?.message ?? "That change isn't valid.",
  );
};
