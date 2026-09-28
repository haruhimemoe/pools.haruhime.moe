/**
 * @file src/schemas/built-pool-view.ts
 * @desc What the browser holds of a built pool: the pool as the pages and editor show it (no
 *       dates, the pack as a state with its link or reason, editors as osu! id and name, and for
 *       the owner whether each has signed in, each bucket's target, each slot's note, and for the
 *       editor alone each slot's candidates and the caller's osu! id) and each of its maps' details from the maps
 *       collection (label parts, no-mod stars, length, BPM, AR, OD, CS, and how many past pools
 *       used it), and the pool a new one starts from. Plain JSON, so a server page and an API
 *       answer give the same shape.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import type { BuiltPackState, Visibility } from "@/constants/built-pools";
import type { SlotCandidates } from "@/schemas/built-candidates";
import type { BucketTargets, SlotNotes } from "@/schemas/built-plan";

/** An osu! user on a pool: the owner or an editor. */
export type PoolPerson = { osuId: number; username: string };

/** An editor; `signedIn` (they've signed in to pools) is sent to the owner only. */
export type ClientEditor = PoolPerson & { signedIn?: boolean };

/** What the caller may do (from src/utils/built-access.ts). */
export type ClientAccess = {
  isOwner: boolean;
  isEditor: boolean;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
};

/** The pool's pack on packs as pages show it: a link while there's one, the reason once failed. */
export type ClientPack = {
  state: BuiltPackState;
  href: string | null;
  error: string | null;
  /** packs' moderators removed it: it's never synced again. */
  gone: boolean;
  /** A failure pools tries again by itself; false after a refusal, which waits for a change. */
  retry: boolean;
};

/** A built pool as the browser holds it: the API's view with dates as strings. */
export type ClientPool = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  notes: string;
  visibility: Visibility;
  hidden: boolean;
  owner: PoolPerson | null;
  editors: ClientEditor[];
  buckets: BucketEntry[];
  slots: PoolSlot[];
  /** Each bucket's target ({} when there are none). */
  targets: BucketTargets;
  /** Each slot's note by beatmap id ({} when there are none). */
  slotNotes: SlotNotes;
  /** Each slot's candidates: the owner and editors only, and only in the editor. */
  candidates?: SlotCandidates;
  /** The caller's osu! id, sent with the candidates (their own votes). */
  me?: number;
  version: number;
  pack: ClientPack;
  access: ClientAccess;
};

/** The pool a new one starts from (/new?from=<id>): its details fill the form, its maps come along. */
export type StartFrom = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  maps: number;
};

/** A map's details as a slot shows them; every detail null until the mirror answers for it. */
export type BuiltMap = {
  id: number;
  setId: number | null;
  artist: string | null;
  title: string | null;
  version: string | null;
  setHost: string | null;
  stars: number | null;
  length: number | null;
  bpm: number | null;
  /** No-mod AR, OD and CS (the math under a slot's mods starts from them). */
  ar: number | null;
  od: number | null;
  cs: number | null;
  /** Past pools (current, not hidden) that played it, and the latest year among them. */
  usage: { count: number; lastYear: number | null };
};

/** Map details by beatmap id; null when we asked and nobody knows the map. */
export type BuiltMaps = Readonly<Record<number, BuiltMap | null>>;

/**
 * @function clientPoolOf
 * @param view {ClientPool} a pool view (the API's answer or the service's, with more fields)
 * @returns {ClientPool} only the fields the browser holds
 */
export const clientPoolOf = (view: ClientPool): ClientPool => ({
  id: view.id,
  name: view.name,
  tournament: view.tournament,
  round: view.round,
  year: view.year,
  notes: view.notes,
  visibility: view.visibility,
  hidden: view.hidden,
  owner: view.owner ? { osuId: view.owner.osuId, username: view.owner.username } : null,
  editors: view.editors.map(({ osuId, username, signedIn }) =>
    signedIn === undefined ? { osuId, username } : { osuId, username, signedIn },
  ),
  buckets: view.buckets,
  slots: view.slots,
  targets: view.targets,
  slotNotes: view.slotNotes,
  ...(view.candidates ? { candidates: view.candidates } : {}),
  ...(view.me === undefined ? {} : { me: view.me }),
  version: view.version,
  pack: view.pack,
  access: view.access,
});
