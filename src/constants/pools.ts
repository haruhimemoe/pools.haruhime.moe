/**
 * @file src/constants/pools.ts
 * @desc Pool data constants: where pools come from (otdb's export, tournament hosts, community
 *       members) and how each source is credited, which of them the import CLI reads, the
 *       credit name limit, otdb's export and pool pages, the pool id pattern, text limits and
 *       the first year a pool can have, the "played as" codes a map can carry, the pack contract
 *       version the sync hash includes, and packs' public address.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

/**
 * Where pools come from: otdb's export, a tournament's own hosts, or anyone else who sends one.
 * Open for later third parties (o!TR, wybin), which get their own kind and importer.
 */
export const SOURCE_KINDS = ["otdb", "host", "community"] as const;

/** Where a past pool came from: otdb, a host or a community member. */
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Kinds an admin adds by hand, each carrying the credit the admin typed (a name, maybe a link). */
export const CREDITED_SOURCE_KINDS = ["host", "community"] as const;

/** A source kind credited by name: host or community. */
export type CreditedSourceKind = (typeof CREDITED_SOURCE_KINDS)[number];

/** What `bun run import` reads. Host and community pools come in through /admin/pools/new. */
export const IMPORT_SOURCES = ["otdb"] as const;

/** A source the import command reads. */
export type ImportSource = (typeof IMPORT_SOURCES)[number];

/** How a source kind is credited. */
export type SourceCredit = {
  /** Its short name: import reports, source links. */
  label: string;
  /** How a pool page introduces the name an admin typed (credited kinds only). */
  lead: string | null;
  /** Who made the source, when that's fixed (otdb's author). */
  author: string | null;
  /** The source's home, when it has one. */
  url: string | null;
};

/**
 * How each source is named and credited on pool pages, /credits and in import reports. otdb's
 * credit is fixed; a host or community pool's name and link are its own (`credit` on the
 * source), introduced by `lead`.
 */
export const SOURCE_CREDITS = Object.freeze({
  otdb: { label: "otdb", lead: null, author: "Sheppsu", url: "https://otdb.sheppsu.me" },
  host: { label: "host", lead: "From the tournament's hosts:", author: null, url: null },
  community: { label: "community", lead: "Sent by", author: null, url: null },
} as const) satisfies Readonly<Record<SourceKind, SourceCredit>>;

/** A host or community credit's name: at most this many characters after trimming. */
export const MAX_CREDIT_NAME_LENGTH = 100;

/** otdb's public export of every pool (Sheppsu OK'd using it on 2026-09-23). */
export const OTDB_EXPORT_URL = "https://otdb.sheppsu.me/static/mappools-export.json";

/** otdb's page for one pool is this, the pool id and a slash. */
export const OTDB_POOL_URL_PREFIX = "https://otdb.sheppsu.me/db/mappools/";

/** "<source>-<id>", then "-2", "-3" for later versions. Also packs' ref for the pool. */
export const POOL_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

/** The longest tournament name. */
export const MAX_TOURNAMENT_LENGTH = 100;
/** The longest round name. */
export const MAX_ROUND_LENGTH = 100;
/** The longest pool notes. */
export const MAX_NOTES_LENGTH = 2000;

/** osu!'s first year: the earliest a pool's year can be (admin edits, the year slider). */
export const FIRST_YEAR = 2007;

/** What a map was played as, in chip order: the built-in slots, then mods a custom slot forces. */
export const PLAYED_AS_CODES = ["NM", "HD", "HR", "DT", "FM", "TB", "EZ", "HT", "FL"] as const;

/** A slot code a map was played as. */
export type PlayedAsCode = (typeof PLAYED_AS_CODES)[number];

/** Part of every pack input hash: bump it when what pools sends packs changes shape. */
export const PACK_CONTRACT_VERSION = 1;

/** Where "Open in packs" links go. */
export const PACKS_SITE_URL = "https://packs.haruhime.moe";
