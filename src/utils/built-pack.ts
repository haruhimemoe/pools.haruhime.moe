/**
 * @file src/utils/built-pack.ts
 * @desc A built pool's pack on packs.haruhime.moe. What pools sends (the name; a description
 *       crediting the owner and editors by osu! username with a link back, within packs' 500
 *       characters and without names the content filter refuses; public for a public pool
 *       that isn't hidden, unlisted otherwise; bare slots; buckets when the pool has its own
 *       list), when a pool is due a sync (unlisted or public, not removed by packs' moderators,
 *       pending or failed, and 30 s since the last try), the state each packs answer leaves,
 *       and what the browser sees (the state, a link once synced: the pack's page for a public
 *       pool packs lists, else the pack key; the reason once failed). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import type { Visibility } from "@/constants/built-pools";
import { PACKS_SITE_URL } from "@/constants/pools";
import { SITE } from "@/constants/site";
import type { BuiltPack, StoredBuiltPool } from "@/schemas/built-pool";
import type { ClientPack } from "@/schemas/built-pool-view";
import { hasBlockedLanguage } from "@/utils/content-filter";
import type { PackInput, PackVisibility } from "@/utils/pack-input";
import type { SyncAnswer } from "@/utils/sync";

/** packs' description limit. */
export const PACK_DESCRIPTION_MAX = 500;

/** One sync per pool at most this often. */
export const PACK_SYNC_INTERVAL_MS = 30_000;

/** What builders read when packs refuses pools' settings (the real reason is logged). */
export const PACKS_NOT_TAKING = "packs isn't taking updates from pools right now.";

/** Why a pool stopped syncing: packs' moderators deleted its pack. */
export const PACK_GONE = "packs removed this pool's pack.";

export const EMPTY_BUILT_PACK: BuiltPack = {
  state: "none",
  slug: null,
  syncedAt: null,
  error: null,
  lastAttemptAt: null,
  listed: false,
  gone: false,
};

type PackPool = Pick<StoredBuiltPool, "_id" | "name" | "visibility" | "hidden" | "slots"> & {
  buckets?: StoredBuiltPool["buckets"];
};

const joinNames = (names: readonly string[], more: number): string => {
  const all = more > 0 ? [...names, `${more} more`] : [...names];
  if (all.length <= 1) return all.join("");
  return `${all.slice(0, -1).join(", ")} and ${all.at(-1)}`;
};

/**
 * @function builtPackDescription
 * @param id {string} the pool's id
 * @param names {readonly string[]} the owner's and editors' osu! usernames, owner first
 * @returns {string} "Built on pools.haruhime.moe by A, B and C: <pool page>", fewer names and
 *          "and N more" when that's over 500 characters, no names when none can be shown
 */
export const builtPackDescription = (id: string, names: readonly string[]): string => {
  const link = `${SITE.url}/pools/${id}`;
  const shown = names.map((name) => name.trim()).filter((n) => n && !hasBlockedLanguage(n));
  for (let count = shown.length; count > 0; count--) {
    const text = `Built on ${SITE.title} by ${joinNames(shown.slice(0, count), shown.length - count)}: ${link}`;
    if (text.length <= PACK_DESCRIPTION_MAX && !hasBlockedLanguage(text)) return text;
  }
  return `Built on ${SITE.title}: ${link}`;
};

/**
 * @function packVisibilityOf
 * @param pool {Pick<StoredBuiltPool, "visibility" | "hidden">} an unlisted or public pool
 * @returns {PackVisibility} public for a public pool moderators haven't hidden, else unlisted
 */
export const packVisibilityOf = (
  pool: Pick<StoredBuiltPool, "visibility" | "hidden">,
): PackVisibility => (pool.visibility === "public" && !pool.hidden ? "public" : "unlisted");

/**
 * @function builtPackInput
 * @param pool {PackPool} an unlisted or public pool with at least one map
 * @param names {readonly string[]} its owner's and editors' osu! usernames
 * @returns {PackInput} the body of packs' PUT /api/service/pools/<id>
 */
export const builtPackInput = (pool: PackPool, names: readonly string[]): PackInput => ({
  name: pool.name,
  description: builtPackDescription(pool._id, names),
  visibility: packVisibilityOf(pool),
  slots: pool.slots.map(({ mod, index, beatmapId }) => ({ mod, index, beatmapId })),
  ...(pool.buckets ? { buckets: pool.buckets.map((bucket) => structuredClone(bucket)) } : {}),
});

/**
 * @function packSyncDue
 * @param pool {{ visibility: Visibility; pack: BuiltPack }} a pool
 * @param now {Date} current time
 * @returns {boolean} true for an unlisted or public pool whose pack is pending or failed (and
 *          not removed by packs), last tried 30 s ago or never
 */
export const packSyncDue = (
  pool: { visibility: Visibility; pack: BuiltPack },
  now: Date,
): boolean => {
  const { pack } = pool;
  if (pool.visibility === "private" || pack.gone) return false;
  if (pack.state !== "pending" && pack.state !== "failed") return false;
  return (
    pack.lastAttemptAt === null ||
    now.getTime() - pack.lastAttemptAt.getTime() >= PACK_SYNC_INTERVAL_MS
  );
};

/**
 * @function nextBuiltPack
 * @param previous {BuiltPack} the pack before the PUT
 * @param answer {SyncAnswer} what packs said
 * @param now {Date} when it answered
 * @returns {BuiltPack} synced (created, updated or unchanged), or failed with the reason (a
 *          plain one when packs refused pools' settings); a 410 also marks it gone, so it's never
 *          synced again
 */
export const nextBuiltPack = (previous: BuiltPack, answer: SyncAnswer, now: Date): BuiltPack => {
  switch (answer.kind) {
    case "ok":
      return {
        ...previous,
        state: "synced",
        slug: answer.slug,
        listed: answer.listed,
        syncedAt: now,
        error: null,
        gone: false,
      };
    case "gone":
      return { ...previous, state: "failed", error: PACK_GONE, listed: false, gone: true };
    case "rejected":
      return {
        ...previous,
        state: "failed",
        error: `packs refused it (${answer.status}): ${answer.message}`,
      };
    case "config":
      return { ...previous, state: "failed", error: PACKS_NOT_TAKING };
    default:
      return { ...previous, state: "failed", error: answer.message };
  }
};

/** The pool's pack key on packs, or null for a pool (read by shape only) it can't encode. */
const keyHref = (pool: PackPool): string | null => {
  try {
    const slots = pool.slots.map(({ mod, index, beatmapId }) => ({ mod, index, beatmapId }));
    const buckets = pool.buckets ? { buckets: [...pool.buckets] } : {};
    return `${PACKS_SITE_URL}/k#${encodePackKey({ name: pool.name, slots, ...buckets })}`;
  } catch {
    return null;
  }
};

/**
 * @function clientPackOf
 * @param pool {PackPool & { pack: BuiltPack }} a stored pool
 * @param options {{ withError?: boolean }} give packs' reason when failed (the owner and
 *        editors; default true)
 * @returns {ClientPack} its pack as the pages show it: none for a private pool; once synced, a
 *          link to the pack's page on packs for a public pool packs lists, else its pack key
 *          (/k#…: an unlisted pack's page is closed, and so is a public one packs' moderators
 *          hid; the key works in every case); the reason when failed, to those who may see it
 */
export const clientPackOf = (
  pool: PackPool & { pack: BuiltPack },
  { withError = true }: { withError?: boolean } = {},
): ClientPack => {
  const { pack } = pool;
  if (pool.visibility === "private") return { state: "none", href: null, error: null, gone: false };
  let href: string | null = null;
  if (pack.state === "synced" && pack.slug !== null) {
    const pageOpen = pack.listed && packVisibilityOf(pool) === "public";
    href = pageOpen ? `${PACKS_SITE_URL}/p/${pack.slug}` : keyHref(pool);
  }
  return {
    state: pack.state,
    href,
    error: withError && pack.state === "failed" ? pack.error : null,
    gone: pack.gone,
  };
};

/**
 * @function packWaiting
 * @param pack {ClientPack} a pool's pack as the pages see it
 * @returns {boolean} true while it's pending or failed and packs hasn't removed it: a page or
 *          editor load then tries a sync (the sync itself keeps to one per 30 s)
 */
export const packWaiting = (pack: ClientPack): boolean =>
  !pack.gone && (pack.state === "pending" || pack.state === "failed");
