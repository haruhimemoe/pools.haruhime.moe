/**
 * @file src/utils/built-record.ts
 * @desc What a built pool stores for search besides its own fields, recomputed on every write of
 *       its content: the folded search text (name, tournament, round), the folded sort name and
 *       the map count, so "Built here" searches and sorts run on indexes as past pools' do. A row
 *       written before they were stored (the connect-time backfill fills those in) gets them
 *       computed when it's read. Pure.
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

/** A built pool row as read, maybe without its search fields. */
type BuiltRowFields = {
  name: string;
  tournament: string;
  round: string;
  slots?: readonly unknown[] | undefined;
} & Partial<BuiltSearchFields>;

/**
 * @function builtSearchFieldsOf
 * @param row {BuiltRowFields} a built pool row as read
 * @returns {BuiltSearchFields} the search fields it stores, each computed when it has none
 */
export const builtSearchFieldsOf = (row: BuiltRowFields): BuiltSearchFields => {
  const computed = builtSearchFields({ ...row, slots: row.slots ?? [] });
  return {
    searchText: row.searchText ?? computed.searchText,
    sortName: row.sortName ?? computed.sortName,
    mapCount: row.mapCount ?? computed.mapCount,
  };
};
