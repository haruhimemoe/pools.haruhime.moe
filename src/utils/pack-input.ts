/**
 * @file src/utils/pack-input.ts
 * @desc What pools sends packs for a pool, and the links to it: the pack input (the pool's name,
 *       a one-line description linking back here, public or unlisted, slots and buckets as
 *       stored), its hash (sha256 of the canonical input and the contract version: a pool
 *       re-syncs only when it changes), the pack key built from the same fields, and where
 *       "Open in packs" goes (the pack's page while packs lists it, else the key, which always
 *       works). Server code only (node:crypto).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { createHash } from "node:crypto";
import { type BucketEntry, encodePackKey, type PoolSlot } from "@haruhimemoe/pool";
import type { PackVisibility as ServiceVisibility } from "@haruhimemoe/pool/service";
import { PACK_CONTRACT_VERSION, PACKS_SITE_URL } from "@/constants/pools";
import { SITE } from "@/constants/site";
import { LISTED_STATES, type PackSync } from "@/schemas/pool";

/** What pools asks packs for: a pool with a pack is never private on packs. */
export type PackVisibility = Exclude<ServiceVisibility, "private">;

/**
 * The body of PUT /api/service/pools/{id} on packs, as @haruhimemoe/pool/service's
 * `poolsPackBodySchema` reads it (tests parse every input pools builds with it).
 */
export type PackInput = {
  name: string;
  description: string;
  visibility: PackVisibility;
  slots: PoolSlot[];
  buckets?: BucketEntry[];
};

/** The pool fields a pack input is built from. */
export type PackSourcePool = {
  _id: string;
  name: string;
  tournament: string;
  round: string | null;
  year: number | null;
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
  hidden: boolean;
  supersededBy: string | null;
};

type KeyFields = {
  name: string;
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
};

const bareSlots = (slots: readonly PoolSlot[]): PoolSlot[] =>
  slots.map(({ mod, index, beatmapId }) => ({ mod, index, beatmapId }));

const copyBuckets = (buckets: readonly BucketEntry[]): BucketEntry[] =>
  buckets.map((bucket) => structuredClone(bucket));

/**
 * @function poolPageUrl
 * @param id {string} a pool id
 * @returns {string} the pool's page on pools
 */
export const poolPageUrl = (id: string): string => `${SITE.url}/pools/${id}`;

/**
 * @function packDescription
 * @param pool {{ _id: string; tournament: string; round: string | null; year: number | null }} a pool
 * @returns {string} "{tournament}[ {round}][ ({year})]. Pool details and sources: {page}"
 */
export const packDescription = (pool: {
  _id: string;
  tournament: string;
  round: string | null;
  year: number | null;
}): string => {
  const head = [pool.tournament, pool.round ?? "", pool.year === null ? "" : `(${pool.year})`]
    .filter((part) => part !== "")
    .join(" ");
  return `${head}. Pool details and sources: ${poolPageUrl(pool._id)}`;
};

/**
 * @function packInputOf
 * @param pool {PackSourcePool} a pool
 * @returns {PackInput} name, description, public (unlisted when hidden or superseded), bare slots,
 *          and buckets only when the pool has a list
 */
export const packInputOf = (pool: PackSourcePool): PackInput => ({
  name: pool.name,
  description: packDescription(pool),
  visibility: pool.hidden || pool.supersededBy !== null ? "unlisted" : "public",
  slots: bareSlots(pool.slots),
  ...(pool.buckets ? { buckets: copyBuckets(pool.buckets) } : {}),
});

/**
 * @function packKeyOf
 * @param pool {KeyFields} name, slots and buckets
 * @returns {string} the pool's pack key (pk1., pk2. or pk3.)
 * @throws {ZodError} when the pool isn't valid (stored pools always are)
 */
export const packKeyOf = (pool: KeyFields): string =>
  encodePackKey({
    name: pool.name,
    slots: bareSlots(pool.slots),
    ...(pool.buckets ? { buckets: copyBuckets(pool.buckets) } : {}),
  });

/**
 * @function packInputHash
 * @param input {PackInput} a pack input
 * @returns {string} sha256 hex of the contract version, name, description, visibility and pack
 *          key (the key orders slots, so slot order never changes the hash)
 */
export const packInputHash = (input: PackInput): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        PACK_CONTRACT_VERSION,
        input.name,
        input.description,
        input.visibility,
        packKeyOf(input),
      ]),
      "utf8",
    )
    .digest("hex");

/**
 * @function openInPacksHref
 * @param pool {KeyFields & { pack: PackSync }} a pool and its sync state
 * @returns {string} packs' /p/{slug} when the last answer was created, updated or unchanged and
 *          packs lists the pack; otherwise /k#{key}, which always opens the pool
 */
export const openInPacksHref = (pool: KeyFields & { pack: PackSync }): string => {
  const { slug, state, listed } = pool.pack;
  if (slug !== null && state !== null && LISTED_STATES.includes(state) && listed === true) {
    return `${PACKS_SITE_URL}/p/${slug}`;
  }
  return `${PACKS_SITE_URL}/k#${packKeyOf(pool)}`;
};
