/**
 * @file src/constants/built-pools.ts
 * @desc Pools people build here: the id shape ("b-" and a generated source id, never reused),
 *       who can see one, the pack states, and the limits (maps and custom buckets come from
 *       @haruhimemoe/pool; editors, pools per owner, ops per call, the JSON body cap, text and
 *       paste lengths).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

export { MAX_CUSTOM_BUCKETS, MAX_NAME_LENGTH, MAX_SLOTS } from "@haruhimemoe/pool";

/** Built pool ids are this and a generated source id (a letter, then 7 base36 characters). */
export const BUILT_POOL_ID_PREFIX = "b-";

export const BUILT_POOL_ID_PATTERN = /^b-[a-z][0-9a-z]{7}$/;

/** private: owner and editors only. unlisted: anyone with the link. public: listed too. */
export const VISIBILITIES = ["private", "unlisted", "public"] as const;

export type Visibility = (typeof VISIBILITIES)[number];

/** Where the pool's pack on packs stands (synced from step 7 on; "none" until then). */
export const BUILT_PACK_STATES = ["none", "synced", "pending", "failed"] as const;

export type BuiltPackState = (typeof BUILT_PACK_STATES)[number];

/** Co-editors per pool. */
export const MAX_EDITORS = 10;

/** Pools one person can own. */
export const MAX_POOLS_PER_OWNER = 50;

/** Ops in one POST /api/pools/<id>/ops. */
export const MAX_OPS_PER_CALL = 20;

/** Every pool route's JSON body cap. */
export const MAX_POOL_BODY_BYTES = 32_768;

/** A pasted pool (replaceMaps), in characters. */
export const MAX_PASTE_LENGTH = 16_000;

/** osu! usernames are at most 15 characters; older ones can be a little longer. */
export const MAX_USERNAME_LENGTH = 32;
