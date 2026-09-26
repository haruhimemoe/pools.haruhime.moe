/**
 * @file tests/helpers/mirror-search.ts
 * @desc A stand-in for the mirror's search (GET /v3/osu/beatmaps/search/v2): osu!-shaped
 *       beatmapsets built from tests/fixtures/osu/compliance-beatmaps.json (each set with its
 *       difficulties), a compact set, and an msw handler that answers what a test says and
 *       records each request's URL and User-Agent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpResponse, http } from "msw";
import { MIRROR_SEARCH_URL } from "@/constants/search";

type FixtureRow = Record<string, unknown> & { id: number; beatmapset: Record<string, unknown> };

const FIXTURE = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "fixtures", "osu", "compliance-beatmaps.json"),
    "utf8",
  ),
) as { beatmaps: FixtureRow[] };

/**
 * @function fixtureSet
 * @param setId {number} a set in the fixture (1 ranked, 101 Igorrr graveyard, 102 Frums
 *        pending, 103 ranked but taken down)
 * @returns {Record<string, unknown>} the set, osu!-shaped, with its difficulties as `beatmaps`
 *          (each an osu! standard map with stars, length and BPM)
 */
export const fixtureSet = (setId: number): Record<string, unknown> => {
  const rows = FIXTURE.beatmaps.filter((row) => row.beatmapset.id === setId);
  const [first] = rows;
  if (!first) throw new Error(`No set ${setId} in the fixture.`);
  return {
    ...first.beatmapset,
    creator: first.beatmapset.creator ?? "Mapper",
    beatmaps: rows.map(({ beatmapset: _set, ...row }, i) => ({
      mode: "osu",
      version: `Diff ${i + 1}`,
      difficulty_rating: 5 + i,
      total_length: 120,
      bpm: 180,
      ...row,
    })),
  };
};

/**
 * @function compactSet
 * @param setId {number} a set id
 * @param beatmapId {number} its one difficulty
 * @returns {Record<string, unknown>} a set without availability, track_id or tags (can't be judged)
 */
export const compactSet = (setId: number, beatmapId: number): Record<string, unknown> => ({
  id: setId,
  status: "ranked",
  artist: "Compact Artist",
  title: "Compact Title",
  creator: "Mapper",
  beatmaps: [
    {
      id: beatmapId,
      mode: "osu",
      version: "Hard",
      difficulty_rating: 4.5,
      total_length: 90,
      bpm: 150,
    },
  ],
});

export type SearchCall = { url: URL; userAgent: string | null };

/**
 * @function mirrorSearchHandler
 * @param answer {(url: URL) => Response} what the mirror says
 * @param calls {SearchCall[]} filled with every request
 * @returns the msw handler for the search endpoint
 */
export const mirrorSearchHandler = (answer: (url: URL) => Response, calls: SearchCall[] = []) =>
  http.get(MIRROR_SEARCH_URL, ({ request }) => {
    const url = new URL(request.url);
    calls.push({ url, userAgent: request.headers.get("user-agent") });
    return answer(url);
  });

/**
 * @function searchAnswer
 * @param sets {unknown[]} the page's sets
 * @param extra {Record<string, unknown>} source and totals
 * @returns {Response} a 200 search answer
 */
export const searchAnswer = (sets: unknown[], extra: Record<string, unknown> = {}): Response =>
  HttpResponse.json({ beatmapsets: sets, source: "local", ...extra });
