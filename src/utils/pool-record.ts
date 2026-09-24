/**
 * @file src/utils/pool-record.ts
 * @desc A pool record's derived fields: the effective tournament, round and year (an admin's
 *       edit wins over what the name says, null included), the tournament key, the folded
 *       search text (name, tournament, round) and name sort key, visibility (not hidden, not
 *       superseded), the notes shown, and an admin form turned into the edits worth storing
 *       (only what differs from the name and the source notes). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { PoolEdits } from "@/schemas/pool";
import { foldForSearch, searchTextOf } from "@/utils/fold";
import { namePartsOf, tournamentKey } from "@/utils/pool-names";

export type EffectiveFields = { tournament: string; round: string | null; year: number | null };

export type DerivedFields = { tournamentKey: string; searchText: string; sortName: string };

/**
 * @function effectiveFields
 * @param name {string} the pool's name
 * @param edited {PoolEdits} admin overrides
 * @returns {EffectiveFields} each override that's there, else what the name says
 */
export const effectiveFields = (name: string, edited: PoolEdits): EffectiveFields => {
  const parsed = namePartsOf(name);
  return {
    tournament: edited.tournament ?? parsed.tournament,
    round: edited.round === undefined ? parsed.round : edited.round,
    year: edited.year === undefined ? parsed.year : edited.year,
  };
};

/**
 * @function derivedFields
 * @param name {string} the pool's name
 * @param fields {EffectiveFields} its effective tournament, round and year
 * @returns {DerivedFields} the tournament key, the folded search text and the name sort key
 */
export const derivedFields = (name: string, fields: EffectiveFields): DerivedFields => ({
  tournamentKey: tournamentKey(fields.tournament, fields.year),
  searchText: searchTextOf(name, fields.tournament, fields.round),
  sortName: foldForSearch(name),
});

/**
 * @function isVisible
 * @param pool {{ hidden: boolean; supersededBy: string | null }} a pool
 * @returns {boolean} true when it's on public surfaces: not hidden and not superseded
 */
export const isVisible = (pool: { hidden: boolean; supersededBy: string | null }): boolean =>
  !pool.hidden && pool.supersededBy === null;

/**
 * @function shownNotes
 * @param notes {string} the source's notes
 * @param edited {PoolEdits} admin overrides
 * @returns {string} the admin's notes when set (even empty), else the source's
 */
export const shownNotes = (notes: string, edited: PoolEdits): string => edited.notes ?? notes;

/** What the admin form sends for the fields that can be overridden. */
export type EditForm = {
  tournament: string;
  round: string | null;
  year: number | null;
  notes: string;
};

/**
 * @function editsFrom
 * @param name {string} the pool's name
 * @param sourceNotes {string} the source's notes
 * @param form {EditForm} what the admin saved
 * @returns {PoolEdits} only the fields that differ from the name's values and the source notes
 */
export const editsFrom = (name: string, sourceNotes: string, form: EditForm): PoolEdits => {
  const parsed = namePartsOf(name);
  const edits: PoolEdits = {};
  if (form.tournament !== parsed.tournament) edits.tournament = form.tournament;
  if (form.round !== parsed.round) edits.round = form.round;
  if (form.year !== parsed.year) edits.year = form.year;
  if (form.notes !== sourceNotes) edits.notes = form.notes;
  return edits;
};
