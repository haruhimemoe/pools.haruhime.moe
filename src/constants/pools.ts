/**
 * @file src/constants/pools.ts
 * @desc Pool data constants: where pools come from (otdb for now) and how each source is
 *       credited, otdb's export and pool pages, the pool id pattern, text limits and the first
 *       year a pool can have, the "played as" codes a map can carry, the pack contract version
 *       the sync hash includes, and packs' public address.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/** Where pools come from. o!TR and wybin get their own importers later. */
export const SOURCE_KINDS = ["otdb"] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

/** How each source is named and credited on pool pages, /credits and in import reports. */
export const SOURCE_CREDITS: Readonly<
  Record<SourceKind, { label: string; author: string; url: string }>
> = Object.freeze({
  otdb: { label: "otdb", author: "Sheppsu", url: "https://otdb.sheppsu.me" },
});

/** otdb's public export of every pool (Sheppsu OK'd using it on 2026-09-23). */
export const OTDB_EXPORT_URL = "https://otdb.sheppsu.me/static/mappools-export.json";

/** otdb's page for one pool is this, the pool id and a slash. */
export const OTDB_POOL_URL_PREFIX = "https://otdb.sheppsu.me/db/mappools/";

/** "<source>-<id>", then "-2", "-3" for later versions. Also packs' ref for the pool. */
export const POOL_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export const MAX_TOURNAMENT_LENGTH = 100;
export const MAX_ROUND_LENGTH = 100;
export const MAX_NOTES_LENGTH = 2000;

/** osu!'s first year: the earliest a pool's year can be (admin edits, the year slider). */
export const FIRST_YEAR = 2007;

/** What a map was played as, in chip order: the built-in slots, then mods a custom slot forces. */
export const PLAYED_AS_CODES = ["NM", "HD", "HR", "DT", "FM", "TB", "EZ", "HT", "FL"] as const;

export type PlayedAsCode = (typeof PLAYED_AS_CODES)[number];

/** Part of every pack input hash: bump it when what pools sends packs changes shape. */
export const PACK_CONTRACT_VERSION = 1;

/** Where "Open in packs" links go. */
export const PACKS_SITE_URL = "https://packs.haruhime.moe";
