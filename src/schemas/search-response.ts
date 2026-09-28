/**
 * @file src/schemas/search-response.ts
 * @desc What GET /api/search answers: pool results (past and built), maps played in pools, and
 *       all-maps sets with their difficulties, with the page and counts. Types only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PlayedAsCode } from "@/constants/pools";

export type PoolResult = {
  kind: "past" | "built";
  /** A built pool's owner's osu! username (null when unknown); null for past pools. */
  builtBy: string | null;
  id: string;
  name: string;
  tournament: string;
  round: string | null;
  year: number | null;
  badged: boolean | null;
  stats: { srMin: number | null; srMax: number | null; count: number; complete: boolean };
};

export type MapResult = {
  id: number;
  artist: string | null;
  title: string | null;
  version: string | null;
  setHost: string | null;
  stars: number | null;
  length: number | null;
  bpm: number | null;
  usage: { count: number; lastYear: number | null; playedAs: PlayedAsCode[] };
};

export type AllMapDifficulty = {
  id: number;
  version: string;
  stars: number;
  length: number;
  bpm: number;
  /** Current pools that played it; null when that lookup failed. */
  playedIn: number | null;
};

export type AllMapSet = {
  setId: number;
  artist: string;
  title: string;
  creator: string;
  status: string;
  /** Graveyard, pending or WIP: it can change or disappear. */
  unranked: boolean;
  /** Null when nothing stands in its way; potential sets say why to check first. */
  check: { text: string } | null;
  maps: AllMapDifficulty[];
};

export type SearchResponse =
  | {
      tab: "pools";
      page: number;
      pageCount: number;
      total: number;
      hiddenMissing: number;
      badgedKnown: boolean;
      results: PoolResult[];
    }
  | {
      tab: "maps";
      scope: "played";
      page: number;
      pageCount: number;
      total: number;
      hiddenMissing: number;
      results: MapResult[];
    }
  | {
      tab: "maps";
      scope: "all";
      page: number;
      pageCount: number;
      /** The mirror's total, when it gives one. */
      total: number | null;
      /** Sets on this page left out as not allowed in officially supported tournaments. */
      hidden: number;
      results: AllMapSet[];
    };
