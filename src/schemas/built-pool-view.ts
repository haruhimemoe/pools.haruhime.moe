/**
 * @file src/schemas/built-pool-view.ts
 * @desc What the browser holds of a built pool: the pool as the pages and editor show it (no
 *       dates, no pack or moderation fields, editors as osu! id and name) and each of its maps'
 *       details from the maps collection (label parts, no-mod stars, length, BPM, and how many
 *       past pools used it). Plain JSON, so a server page and an API answer give the same shape.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import type { Visibility } from "@/constants/built-pools";

/** An osu! user on a pool: the owner or an editor. */
export type PoolPerson = { osuId: number; username: string };

/** What the caller may do (from src/utils/built-access.ts). */
export type ClientAccess = {
  isOwner: boolean;
  isEditor: boolean;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
};

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
  editors: PoolPerson[];
  buckets: BucketEntry[];
  slots: PoolSlot[];
  version: number;
  access: ClientAccess;
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
  editors: view.editors.map(({ osuId, username }) => ({ osuId, username })),
  buckets: view.buckets,
  slots: view.slots,
  version: view.version,
  access: view.access,
});
