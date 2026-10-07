/**
 * @file src/constants/built-pools.ts
 * @desc Pools people build here: the id shape ("b-" and a generated source id, never reused),
 *       who can see one, the pack states, and the limits (maps and custom buckets come from
 *       @haruhimemoe/pool; editors, pools per owner, ops per call, the JSON body cap, text and
 *       paste lengths), how the builder names each visibility, what it says about the pool's pack
 *       on packs, what it says when a pack removal is queued, the "Delete my pools data" warning, when no editor can take the pool
 *       over, and how the editor backs off asking for slot values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

export { MAX_CUSTOM_BUCKETS, MAX_NAME_LENGTH, MAX_SLOTS } from "@haruhimemoe/pool";

/** Built pool ids are this and a generated source id (a letter, then 7 base36 characters). */
export const BUILT_POOL_ID_PREFIX = "b-";

/** A built pool's id: b- and a generated source id. */
export const BUILT_POOL_ID_PATTERN = /^b-[a-z][0-9a-z]{7}$/;

/** private: owner and editors only. unlisted: anyone with the link. public: listed too. */
export const VISIBILITIES = ["private", "unlisted", "public"] as const;

/** Who can see a built pool: private, unlisted or public. */
export type Visibility = (typeof VISIBILITIES)[number];

/** How the builder names each visibility and says who sees it. */
export const VISIBILITY_TEXT: Readonly<Record<Visibility, { label: string; hint: string }>> = {
  private: { label: "Private", hint: "Only you and your editors." },
  unlisted: { label: "Unlisted", hint: "Anyone with the link. It isn't listed anywhere." },
  public: { label: "Public", hint: "Anyone, and search can list it." },
};

/** Said when the owner picks unlisted or public. */
export const PACK_NOTE =
  "Once it has maps, it also gets a pack on packs.haruhime.moe for downloads, kept in step as it changes.";

/** What the editor says about the pool's pack, by where it stands. */
export const PACK_STATUS_TEXT = {
  private: "A private pool has no pack. Make it unlisted or public to get one on packs.",
  privateEditor:
    "A private pool has no pack. Its owner can make it unlisted or public to get one on packs.",
  gone: "packs removed this pool's pack, so it stays off packs, even if the pool goes private and back. Only an admin can undo that; a fresh pool (Start from this pool) gets its own pack.",
  refused: "Your next change sends it again, or use Update pack now.",
  empty: "Add a map and the pool gets a pack on packs.",
  pending: "Your latest changes haven't reached packs yet.",
  synced: "The pack on packs is up to date.",
  failed: "packs didn't take the last update:",
} as const;

/**
 * What a hidden pool's owner, editors and admins see on its page and in its editor, by who can
 * see it: only a public pool is in search, and a private one has no pack.
 */
export const HIDDEN_BY_MODERATION: Record<Visibility, string> = {
  public:
    "Hidden by moderation. Only its owner, its editors and admins can see this pool; it's out of search, and its pack on packs is unlisted.",
  unlisted:
    "Hidden by moderation. Only its owner, its editors and admins can see this pool, and its pack on packs is unlisted.",
  private:
    "Hidden by moderation. If it's shared again, only its owner, its editors and admins will see it.",
};

/** Said when a pack removal couldn't reach packs and waits in pack_cleanup. */
export const PACK_REMOVAL_QUEUED =
  "packs.haruhime.moe didn't answer, so the pack will be removed there as soon as it does.";

/** The "Delete my pools data" warning: what goes, and that the haruhime account stays. */
export const DELETES_POOLS_DATA =
  "This deletes every pool you own (with its pack on packs), takes you off the pools you edit, and deletes your API key. Your haruhime account stays. It can't be undone.";

/**
 * @function packRemovalsQueuedText
 * @param count {number} pack removals queued by one account deletion (1 or more)
 * @returns {string} what the account page says about them
 */
export const packRemovalsQueuedText = (count: number): string =>
  `packs.haruhime.moe didn't answer, so ${count === 1 ? "1 pack" : `${count} packs`} will be removed there as soon as it does.`;

/** Where the pool's pack on packs stands: none (private or empty), pending, synced, failed. */
export const BUILT_PACK_STATES = ["none", "synced", "pending", "failed"] as const;

/** Where a built pool's pack stands on packs. */
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

/** The editor's first wait before asking for slot values again after a failed answer; it doubles. */
export const VALUES_RETRY_MS = 2_000;
/** The longest the editor waits between asks for slot values. */
export const VALUES_RETRY_MAX_MS = 60_000;

/** Said when no editor has signed in to take the pool over. */
export const NO_HANDOVER =
  "Only an editor who has signed in to pools can take the pool over. Add one above first.";

/** Said after a stale save lands cleanly onto a change someone else made meanwhile. */
export const MERGED_NOTICE = "Saved. Someone else changed this pool too; both changes are in.";

/** The 403 when a caller can see the pool but not its history. */
export const HISTORY_PRIVATE = "This pool's history is private.";
/** The 404 for a revision that isn't on this pool. */
export const REVISION_NOT_FOUND = "That version isn't here any more.";
