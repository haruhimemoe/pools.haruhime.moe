/**
 * @file src/services/admin-pools.ts
 * @desc The admin pool list on /admin/pools: what to show (all, hidden, superseded, a failed
 *       pack sync), 50 a page on its indexes, and how many pools are in each sync state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Filter } from "mongodb";
import { QUERY_TIME_MS } from "@/constants/db";
import { poolsCollection } from "@/models/Pool";
import { type StoredPool, SYNC_STATES, type SyncState } from "@/schemas/pool";
import { escapeRegExp, searchTerms } from "@/utils/fold";

/** Which pools the admin list shows. */
export const ADMIN_SHOWS = ["all", "hidden", "superseded", "failed"] as const;

/** One of ADMIN_SHOWS. */
export type AdminShow = (typeof ADMIN_SHOWS)[number];

/** Pools per admin list page. */
export const ADMIN_PAGE_SIZE = 50;

/** One row of the admin pool list. */
export type AdminPoolRow = Pick<
  StoredPool,
  "_id" | "name" | "tournament" | "round" | "year" | "hidden" | "supersededBy" | "badged" | "pack"
>;

const SHOW_FILTERS: Readonly<Record<AdminShow, Record<string, unknown>>> = {
  all: {},
  hidden: { hidden: true },
  superseded: { supersededBy: { $ne: null } },
  failed: { "pack.state": { $in: ["error", "rejected"] } },
};

/**
 * @function listPoolsForAdmin
 * @param options {{ q: string; show: AdminShow; page: number }} text, which pools, 1-based page
 * @returns {Promise<{ rows: AdminPoolRow[]; total: number; page: number; pageCount: number }>}
 *          every pool (hidden and superseded included) matching, by id
 */
export const listPoolsForAdmin = async ({
  q,
  show,
  page,
}: {
  q: string;
  show: AdminShow;
  page: number;
}) => {
  const pools = await poolsCollection();
  const filter = {
    $and: [
      SHOW_FILTERS[show],
      ...searchTerms(q).map((term) => ({ searchText: { $regex: escapeRegExp(term) } })),
    ],
  } as Filter<StoredPool>;
  const [rows, total] = await Promise.all([
    pools
      .find(filter, {
        projection: {
          name: 1,
          tournament: 1,
          round: 1,
          year: 1,
          hidden: 1,
          supersededBy: 1,
          badged: 1,
          pack: 1,
        },
        sort: { _id: 1 },
        skip: (page - 1) * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
        maxTimeMS: QUERY_TIME_MS,
      })
      .toArray(),
    pools.countDocuments(filter, { maxTimeMS: QUERY_TIME_MS }),
  ]);
  return {
    rows: rows as AdminPoolRow[],
    total,
    page,
    pageCount: Math.ceil(total / ADMIN_PAGE_SIZE),
  };
};

/**
 * @function countSyncStates
 * @returns {Promise<Record<SyncState | "never", number>>} pools per pack state
 */
export const countSyncStates = async (): Promise<Record<SyncState | "never", number>> => {
  const pools = await poolsCollection();
  const counts = await Promise.all(
    [...SYNC_STATES, null].map((state) =>
      pools.countDocuments({ "pack.state": state }, { maxTimeMS: QUERY_TIME_MS }),
    ),
  );
  return Object.fromEntries(
    [...SYNC_STATES, "never"].map((state, i) => [state, counts[i] ?? 0]),
  ) as Record<SyncState | "never", number>;
};
