/**
 * @file src/services/built-pool-create.ts
 * @desc Making a pool: private, version 1, no pack. At most 50 per owner: counted before, and
 *       again after the insert, which takes its own pool back out when the owner is over (so
 *       creates racing each other can fall short of 50 but never pass it). Its id is "b-" and a
 *       generated source id, claimed by inserting it into built_pool_ids (a clash tries another),
 *       so an id is never handed out twice, even after its pool is deleted. Starting from a pool
 *       copies its maps, buckets and details: a past pool that isn't hidden, or a built pool the
 *       caller can see. Anything typed wins over what's copied. /new?from=<id> previews the pool
 *       to start from (startPreview).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { MAX_NAME_LENGTH } from "@haruhimemoe/pool";
import {
  BUILT_POOL_ID_PATTERN,
  BUILT_POOL_ID_PREFIX,
  MAX_POOLS_PER_OWNER,
} from "@/constants/built-pools";
import type { SessionUser } from "@/lib/auth";
import { builtPoolIdsCollection, builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { CreatePoolBody } from "@/schemas/built-pool-ops";
import type { StartFrom } from "@/schemas/built-pool-view";
import { poolIdSchema } from "@/schemas/pool";
import {
  type Answer,
  type BuiltPoolView,
  findBuiltPool,
  refuse,
  toStored,
  viewOf,
} from "@/services/built-pools";
import { getPublicPool } from "@/services/pools";
import { accessOf } from "@/utils/built-access";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { newSourceId, type RandomBytes } from "@/utils/source-ids";

const MAX_CLAIM_TRIES = 5;

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

/**
 * @function claimBuiltPoolId
 * @param now {Date} when it's claimed
 * @param random {RandomBytes | undefined} random bytes (tests)
 * @returns {Promise<string>} a "b-" id no pool has ever had, now claimed
 * @throws {Error} when 5 new ids in a row were all taken
 */
export const claimBuiltPoolId = async (now: Date, random?: RandomBytes): Promise<string> => {
  const ids = await builtPoolIdsCollection();
  for (let i = 0; i < MAX_CLAIM_TRIES; i++) {
    const id = `${BUILT_POOL_ID_PREFIX}${newSourceId(random)}`;
    try {
      await ids.insertOne({ _id: id, claimedAt: now });
      return id;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new Error(`Couldn't find a free built pool id in ${MAX_CLAIM_TRIES} tries.`);
};

type Start = Pick<StoredBuiltPool, "name" | "tournament" | "round" | "year" | "slots" | "buckets">;

/** The pool to copy: a past pool that isn't hidden, or a built pool the caller can see. */
const startingPoint = async (id: string, caller: SessionUser): Promise<Start | null> => {
  if (BUILT_POOL_ID_PATTERN.test(id)) {
    const built = await findBuiltPool(id);
    return built && accessOf(built, caller).canView ? built : null;
  }
  const past = await getPublicPool(id);
  if (!past) return null;
  const seen = new Set<number>();
  return {
    name: past.name.slice(0, MAX_NAME_LENGTH).trim(),
    tournament: past.tournament,
    round: past.round ?? "",
    year: past.year,
    buckets: past.buckets,
    // A built pool holds each map once: keep the first slot a map is in.
    slots: past.slots.filter(({ beatmapId }) => !seen.has(beatmapId) && !!seen.add(beatmapId)),
  };
};

/**
 * @function startPreview
 * @param id {string} an untrusted pool id from /new?from=
 * @param caller {SessionUser} who's starting a pool
 * @returns {Promise<StartFrom | null>} what /new fills in (the name cut to 64 characters) and
 *          how many maps come along; null when there's no such pool the caller may copy
 */
export const startPreview = async (id: string, caller: SessionUser): Promise<StartFrom | null> => {
  if (!poolIdSchema.safeParse(id).success) return null;
  const start = await startingPoint(id, caller);
  if (!start) return null;
  const { name, tournament, round, year, slots } = start;
  return { id, name, tournament, round, year, maps: slots.length };
};

/**
 * @function createBuiltPool
 * @param caller {SessionUser} the new pool's owner
 * @param body {CreatePoolBody} a name and details, or a pool to start from
 * @param now {Date} current time (tests)
 * @returns {Promise<Answer<BuiltPoolView>>} the new pool; 400 past 50 pools or when the copy
 *          doesn't make a valid pool (a name the content filter refuses, say); 404 when the pool
 *          to start from isn't there to copy
 */
export const createBuiltPool = async (
  caller: SessionUser,
  body: CreatePoolBody,
  now: Date = new Date(),
): Promise<Answer<BuiltPoolView>> => {
  const pools = await builtPoolsCollection();
  const owned = () => pools.countDocuments({ ownerId: caller.id });
  const full = () =>
    refuse(
      400,
      "too_many_pools",
      `You can own at most ${MAX_POOLS_PER_OWNER} pools. Delete one to make another.`,
    );
  if ((await owned()) >= MAX_POOLS_PER_OWNER) return full();
  const start = body.startedFrom ? await startingPoint(body.startedFrom, caller) : null;
  if (body.startedFrom && !start) {
    return refuse(404, "not_found", "That pool isn't there to start from.");
  }
  const draft: StoredBuiltPool = {
    _id: "b-a0000000",
    name: body.name ?? start?.name ?? "",
    tournament: body.tournament ?? start?.tournament ?? "",
    round: body.round ?? start?.round ?? "",
    year: body.year !== undefined ? body.year : (start?.year ?? null),
    notes: body.notes ?? "",
    visibility: "private",
    ownerId: caller.id,
    editors: [],
    ...(start?.buckets ? { buckets: start.buckets } : {}),
    slots: start?.slots ?? [],
    version: 1,
    pack: EMPTY_BUILT_PACK,
    hidden: false,
    startedFrom: body.startedFrom ?? null,
    createdAt: now,
    updatedAt: now,
  };
  let pool: StoredBuiltPool;
  try {
    pool = toStored(draft);
  } catch {
    return refuse(400, "bad_start", "That pool can't be copied as it is. Give it a name.");
  }
  pool = { ...pool, _id: await claimBuiltPoolId(now) };
  await pools.insertOne(pool);
  // Another create may have landed since the count: whoever sees the owner over takes theirs back.
  if ((await owned()) > MAX_POOLS_PER_OWNER) {
    await pools.deleteOne({ _id: pool._id });
    return full();
  }
  return { ok: true, value: await viewOf(pool, caller) };
};
