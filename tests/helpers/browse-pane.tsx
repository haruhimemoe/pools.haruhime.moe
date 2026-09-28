/**
 * @file tests/helpers/browse-pane.tsx
 * @desc For the map browser's component tests: a set and a difficulty as the route sends them,
 *       and the pane rendered over a fake fetch (no network) that answers every search from the
 *       test's function (by default one set under the lens asked for) and records each URL, with
 *       the Add calls and a user-event session.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MapBrowserPane } from "@/components/builder/MapBrowserPane";
import type { BrowseLens } from "@/constants/browse";
import type { BrowseDiff, BrowseSet } from "@/utils/browse-params";
import { browsePage, DEFAULT_BUCKETS } from "./pool-editor";

export const diff = (id: number, over: Partial<BrowseDiff> = {}): BrowseDiff => ({
  id,
  version: `Diff ${id}`,
  stars: 6.42,
  starsNoMod: 5.8,
  ar: 10,
  od: 9.5,
  cs: 4.5,
  bpm: 240,
  length: 120,
  playedIn: 0,
  source: "mirror",
  ...over,
});

export const set = (
  setId: number,
  diffs: BrowseDiff[],
  over: Partial<BrowseSet> = {},
): BrowseSet => ({
  setId,
  artist: "xi",
  title: `Song ${setId}`,
  creator: "Mapper",
  status: "ranked",
  unranked: false,
  check: null,
  diffs,
  ...over,
});

/**
 * @function lensAsked
 * @param url {URL} a search's URL
 * @returns {BrowseLens} the lens it asks for (NM without one), as a route that offers it answers
 */
export const lensAsked = (url: URL): BrowseLens =>
  (url.searchParams.get("lens") ?? "NM") as BrowseLens;

type PaneOptions = {
  buckets?: readonly BucketEntry[];
  poolIds?: readonly number[];
  answer?: (url: URL) => Response | Promise<Response>;
};

/**
 * @function renderPane
 * @param options {PaneOptions} the pool's buckets and ids, and how searches are answered
 *        (default: one set with two difficulties)
 * @returns user-event, the searches' URLs, the onAdd mock, render's result and rerender with
 *          new props
 */
export const renderPane = ({
  buckets = DEFAULT_BUCKETS,
  poolIds = [],
  answer = (url) =>
    Response.json(browsePage({ lens: lensAsked(url), sets: [set(1, [diff(11), diff(12)])] })),
}: PaneOptions = {}) => {
  const urls: URL[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    urls.push(url);
    return answer(url);
  });
  const onAdd = vi.fn();
  const props = { buckets, poolIds, openedFor: null as string | null, openCount: 0, onAdd };
  const user = userEvent.setup();
  const view = render(<MapBrowserPane {...props} fetcher={fetcher as unknown as typeof fetch} />);
  const rerender = (over: Partial<typeof props>) =>
    view.rerender(
      <MapBrowserPane {...props} {...over} fetcher={fetcher as unknown as typeof fetch} />,
    );
  return { ...view, user, urls, onAdd, fetcher, rerender };
};
