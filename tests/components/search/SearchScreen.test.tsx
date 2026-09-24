/**
 * @file tests/components/search/SearchScreen.test.tsx
 * @desc The search page: it fetches the URL's search and lists the results with the count and
 *       "hidden, data missing"; typing writes the URL (once the typing stops); the badged row
 *       shows only when some pool knows it; the route's message shows under "contains map"; the
 *       maps tab lists maps with their usage; the pages link through the URL.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchScreen } from "@/components/search/SearchScreen";

const replace = vi.fn();
let current = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => current,
  usePathname: () => "/search",
}));

const fetchMock = vi.fn<(input: string) => Promise<Response>>();

beforeEach(() => {
  replace.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const POOLS = {
  tab: "pools",
  page: 1,
  pageCount: 3,
  total: 120,
  hiddenMissing: 4,
  badgedKnown: true,
  results: [
    {
      id: "otdb-657",
      name: "osu! World Cup 2023 Grand Finals",
      tournament: "osu! World Cup",
      round: "Grand Finals",
      year: 2023,
      badged: true,
      stats: { srMin: 6.1, srMax: 7.4, count: 20, complete: true },
    },
  ],
};

describe("SearchScreen", () => {
  it("fetches the URL's search and lists pools", async () => {
    current = new URLSearchParams("q=owc");
    fetchMock.mockImplementation(async () => Response.json(POOLS));
    render(<SearchScreen />);
    expect(
      await screen.findByRole("link", { name: "osu! World Cup 2023 Grand Finals" }),
    ).toHaveAttribute("href", "/pools/otdb-657");
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=owc", expect.anything());
    expect(screen.getByText("120 pools")).toBeInTheDocument();
    expect(screen.getByText("4 more hidden: data missing for a filter.")).toBeInTheDocument();
    expect(screen.getByText(/6\.10–7\.40★ \(no mod\)/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Badged" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/search?page=2&q=owc",
    );
  });

  it("writes the URL once typing stops", async () => {
    current = new URLSearchParams();
    fetchMock.mockImplementation(async () => Response.json({ ...POOLS, badgedKnown: false }));
    const user = userEvent.setup();
    render(<SearchScreen />);
    await user.type(screen.getByLabelText("Tournament, round or pool name"), "owc finals");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/search?q=owc%20finals", { scroll: false }),
    );
    expect(screen.queryByRole("combobox", { name: "Badged" })).not.toBeInTheDocument();
  });

  it("shows the route's message under the contained map", async () => {
    current = new URLSearchParams("map=https%3A%2F%2Fosu.ppy.sh%2Fbeatmapsets%2F39804");
    fetchMock.mockImplementation(async () =>
      Response.json(
        { error: { code: "bad_request", message: "That link is a whole beatmapset." } },
        { status: 400 },
      ),
    );
    render(<SearchScreen />);
    expect(await screen.findByText("That link is a whole beatmapset.")).toBeInTheDocument();
  });

  it("lists maps with their usage on the maps tab", async () => {
    current = new URLSearchParams("tab=maps");
    fetchMock.mockImplementation(async () =>
      Response.json({
        tab: "maps",
        page: 1,
        pageCount: 1,
        total: 1,
        hiddenMissing: 0,
        results: [
          {
            id: 129891,
            artist: "xi",
            title: "FREEDOM DiVE",
            version: "FOUR DIMENSIONS",
            setHost: "Nakagawa-Kanon",
            stars: 7.81,
            length: 258,
            bpm: 222,
            usage: { count: 3, lastYear: 2023, playedAs: ["NM", "DT"] },
          },
        ],
      }),
    );
    render(<SearchScreen />);
    expect(
      await screen.findByRole("link", { name: "xi - FREEDOM DiVE [FOUR DIMENSIONS]" }),
    ).toHaveAttribute("href", "/maps/129891");
    expect(screen.getByText(/Used in 3 pools \(latest 2023\)/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Played as" })).toBeInTheDocument();
    expect(screen.getByText("1 map")).toBeInTheDocument();
  });
});
