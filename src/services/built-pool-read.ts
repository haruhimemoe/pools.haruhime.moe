/**
 * @file src/services/built-pool-read.ts
 * @desc Reading built pools: one row by shape only (builtPoolReadSchema, so a pool a newer
 *       content filter or limit would refuse still reads and can be fixed or deleted; a row of
 *       the wrong shape is left out, never shown half-broken), the stored form with its search
 *       fields, owners' current osu! names (from the hub's identity database), what a caller sees of a pool (every bucket, and for
 *       the owner which editors have a haruhime account, looked up by osu! id, its targets and slot notes, with notes today's
 *       filter refuses left out for anyone who can't edit, and its candidates for the owner and
 *       editors alone), and loading one for a caller who
 *       must be allowed something.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { bucketsOf } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { QUERY_TIME_MS } from "@/constants/db";
import { getIdentityDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { passingNotes } from "@/schemas/built-plan";
import {
  builtPoolReadSchema,
  type StoredBuiltPool,
  storedBuiltPoolSchema,
} from "@/schemas/built-pool";
import { userIdsFor } from "@/services/identity-users";
import { type Access, accessOf, type Caller } from "@/utils/built-access";
import { type Answer, type BuiltPoolView, NOT_FOUND, refuse } from "@/utils/built-answer";
import { clientPackOf } from "@/utils/built-pack";
import { type BuiltSearchFields, builtSearchFields } from "@/utils/built-record";
import { countedVotes, membersOf } from "@/utils/candidate-view";

/**
 * @function readBuiltPool
 * @param row {unknown} a built_pools row
 * @returns {StoredBuiltPool | null} the pool by shape (builtPoolReadSchema), or null for a row
 *          of the wrong shape (logged)
 */
export const readBuiltPool = (row: unknown): StoredBuiltPool | null => {
  if (!row) return null;
  const parsed = builtPoolReadSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  const id = typeof row === "object" && "_id" in row ? String(row._id) : "a row";
  console.error(`[built] ${id} doesn't parse`, parsed.error.issues[0]?.message);
  return null;
};

/**
 * @function findBuiltPool
 * @param id {string} an untrusted built pool id
 * @returns {Promise<StoredBuiltPool | null>} the pool, or null (no such id, or a row of the
 *          wrong shape, which is logged)
 */
export const findBuiltPool = async (id: string): Promise<StoredBuiltPool | null> => {
  if (!BUILT_POOL_ID_PATTERN.test(id)) return null;
  return readBuiltPool(await (await builtPoolsCollection()).findOne({ _id: id }));
};

/**
 * @function toStored
 * @param pool {StoredBuiltPool} a pool about to be written
 * @returns {StoredBuiltPool & BuiltSearchFields} the same pool, checked, with `buckets` left out
 *          for the default list and `targets`, `slotNotes` and `candidates` when there are none (the driver
 *          would store an undefined value as null), and its search fields
 * @throws {z.ZodError} when it doesn't satisfy the stored schema (a bug)
 */
export const toStored = (pool: StoredBuiltPool): StoredBuiltPool & BuiltSearchFields => {
  const { buckets, targets, slotNotes, candidates, ...rest } = storedBuiltPoolSchema.parse(pool);
  const some = (record: object | undefined) =>
    record !== undefined && Object.keys(record).length > 0;
  const stored = {
    ...rest,
    ...(buckets === undefined ? {} : { buckets }),
    ...(some(targets) ? { targets } : {}),
    ...(some(slotNotes) ? { slotNotes } : {}),
    ...(some(candidates) ? { candidates } : {}),
  };
  return { ...stored, ...builtSearchFields(stored) };
};

/**
 * @function ownerOf
 * @param ownerId {string} a pool's owner (a user id)
 * @returns {Promise<BuiltPoolView["owner"]>} their osu! id and current username, or null when
 *          the user row is gone
 */
export const ownerOf = async (ownerId: string): Promise<BuiltPoolView["owner"]> => {
  if (!ObjectId.isValid(ownerId)) return null;
  const user = await getIdentityDb()
    .collection("user")
    .findOne({ _id: new ObjectId(ownerId) }, { projection: { osuId: 1, username: 1 } });
  return typeof user?.osuId === "number" && typeof user.username === "string"
    ? { osuId: user.osuId, username: user.username }
    : null;
};

/**
 * @function ownerNamesOf
 * @param ownerIds {readonly string[]} pools' owners (user ids)
 * @returns {Promise<Map<string, string>>} each one's current osu! username, where the user row is
 *          there (one query)
 */
export const ownerNamesOf = async (ownerIds: readonly string[]): Promise<Map<string, string>> => {
  const ids = [...new Set(ownerIds)].filter((id) => ObjectId.isValid(id));
  if (ids.length === 0) return new Map();
  const users = await getIdentityDb()
    .collection("user")
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { username: 1 }, maxTimeMS: QUERY_TIME_MS },
    )
    .toArray();
  return new Map(
    users.flatMap((user) =>
      typeof user.username === "string" ? [[String(user._id), user.username] as const] : [],
    ),
  );
};

/**
 * @function viewOf
 * @param pool {StoredBuiltPool} a stored pool the caller may see
 * @param caller {Caller} who's asking
 * @returns {Promise<BuiltPoolView>} what the API sends (candidates and `me` only for the owner
 *          and editors)
 */
export const viewOf = async (pool: StoredBuiltPool, caller: Caller): Promise<BuiltPoolView> => {
  const { isOwner, isEditor, canEdit, canManage, canDelete } = accessOf(pool, caller);
  const owner = await ownerOf(pool.ownerId);
  // Only the owner and admins see who has signed in, read from identity by osu! id.
  const accounts = canManage
    ? await userIdsFor(pool.editors.map((editor) => editor.osuId))
    : new Map<number, string>();
  const members = membersOf({ owner, editors: pool.editors });
  // Candidates are the owner's and editors' alone, with only current members' votes.
  const candidates =
    canEdit && caller
      ? { candidates: countedVotes(pool.candidates ?? {}, members), me: caller.osuId }
      : {};
  return {
    id: pool._id,
    name: pool.name,
    tournament: pool.tournament,
    round: pool.round,
    year: pool.year,
    notes: pool.notes,
    visibility: pool.visibility,
    hidden: pool.hidden,
    owner,
    editors: pool.editors.map(({ osuId, username, addedAt }) => ({
      osuId,
      username,
      addedAt,
      ...(canManage ? { signedIn: accounts.has(osuId) } : {}),
    })),
    buckets: bucketsOf(pool).map((entry) => ({ ...entry })),
    slots: pool.slots,
    targets: pool.targets ?? {},
    // Everyone else sees only notes a write would take today; editors see theirs to fix them.
    slotNotes: canEdit ? (pool.slotNotes ?? {}) : passingNotes(pool.slotNotes ?? {}),
    ...candidates,
    ...(canEdit ? { head: pool.head ?? null } : {}),
    ...(canManage ? { historyPublic: pool.historyPublic === true } : {}),
    version: pool.version,
    // packs' reasons are for the people who fix the pool.
    pack: clientPackOf(pool, { withError: canEdit }),
    startedFrom: pool.startedFrom,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    access: { isOwner, isEditor, canEdit, canManage, canDelete },
  };
};

/**
 * @function getBuiltPoolFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @returns {Promise<Answer<BuiltPoolView>>} the pool, or 404 when it's not there or not theirs
 *          to see
 */
export const getBuiltPoolFor = async (
  id: string,
  caller: Caller,
): Promise<Answer<BuiltPoolView>> => {
  const pool = await findBuiltPool(id);
  if (!pool || !accessOf(pool, caller).canView) return refuse(404, "not_found", NOT_FOUND);
  return { ok: true, value: await viewOf(pool, caller) };
};

/**
 * @function loadFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @param may {(access: Access) => boolean} what they need to be allowed
 * @returns {Promise<Answer<{ pool: StoredBuiltPool; access: Access }>>} the pool and the
 *          caller's access; 404 when it's not there or they can't see it (and aren't allowed
 *          anyway), 403 when they see it but aren't allowed
 */
export const loadFor = async (
  id: string,
  caller: Caller,
  may: (access: Access) => boolean,
): Promise<Answer<{ pool: StoredBuiltPool; access: Access }>> => {
  const pool = await findBuiltPool(id);
  if (!pool) return refuse(404, "not_found", NOT_FOUND);
  const access = accessOf(pool, caller);
  const allowed = may(access);
  if (!access.canView && !allowed) return refuse(404, "not_found", NOT_FOUND);
  if (!allowed) return refuse(403, "forbidden", "You can't do that to this pool.");
  return { ok: true, value: { pool, access } };
};
