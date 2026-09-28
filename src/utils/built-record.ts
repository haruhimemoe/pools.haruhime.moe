/**
 * @file src/utils/built-record.ts
 * @desc What a built pool stores for search besides its own fields, recomputed on every write of
 *       its content: the folded search text (name, tournament, round), the folded sort name and
 *       the map count, so "Built here" searches and sorts run on indexes as past pools' do.
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { foldForSearch, searchTextOf } from "@/utils/fold";

export type BuiltSearchFields = { searchText: string; sortName: string; mapCount: number };

/**
 * @function builtSearchFields
 * @param pool {{ name: string; tournament: string; round: string; slots: readonly unknown[] }}
 *        a built pool's content
 * @returns {BuiltSearchFields} its search text, sort name and map count
 */
export const builtSearchFields = (pool: {
  name: string;
  tournament: string;
  round: string;
  slots: readonly unknown[];
}): BuiltSearchFields => ({
  searchText: searchTextOf(pool.name, pool.tournament, pool.round),
  sortName: foldForSearch(pool.name),
  mapCount: pool.slots.length,
});
