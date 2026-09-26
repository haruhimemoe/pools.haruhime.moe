/**
 * @file tests/components/search/SearchScreen.test.tsx
 * @desc The search page: it fetches the URL's search and lists the results with the count and
 *       "hidden, data missing"; typing writes the URL (once the typing stops); the badged row
 *       shows only when some pool knows it; the route's message shows under "contains map"; the
 *       maps tab lists maps played in pools with their usage; the pages link through the URL.
 *       All maps (the maps tab's default): the scope switch, sets with their difficulties and
 *       how many pools played each, "Check first" and the unranked line, how many sets were
 *       hidden and why, one status chip at a time, and the fixed failure sentence with a link
 *       to the same search in maps played in pools.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
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

  it("lists maps with their usage on the maps tab's played scope", async () => {
    current = new URLSearchParams("tab=maps&scope=played");
    fetchMock.mockImplementation(async () =>
      Response.json({
        tab: "maps",
        scope: "played",
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

const ALL = {
  tab: "maps",
  scope: "all",
  page: 1,
  pageCount: 2,
  total: 60,
  hidden: 2,
  results: [
    {
      setId: 39804,
      artist: "xi",
      title: "FREEDOM DiVE",
      creator: "Nakagawa-Kanon",
      status: "ranked",
      unranked: false,
      check: null,
      maps: [
        { id: 129891, version: "FOUR DIMENSIONS", stars: 7.81, length: 258, bpm: 222, playedIn: 3 },
        { id: 129892, version: "Another", stars: 5.2, length: 258, bpm: 222, playedIn: 0 },
      ],
    },
    {
      setId: 102,
      artist: "Frums",
      title: "Credits",
      creator: "Mapper",
      status: "pending",
      unranked: true,
      check: { text: "Needs a closer look" },
      maps: [{ id: 1002, version: "Insane", stars: 5, length: 120, bpm: 180, playedIn: null }],
    },
  ],
};

describe("SearchScreen, all maps", () => {
  it("searches every map by default and lists sets with their difficulties", async () => {
    current = new URLSearchParams("tab=maps&q=dive");
    fetchMock.mockImplementation(async () => Response.json(ALL));
    render(<SearchScreen />);
    expect(await screen.findByText("xi - FREEDOM DiVE")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/search?tab=maps&q=dive");
    expect(screen.getByRole("link", { name: "All osu! maps" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Played in pools" })).toHaveAttribute(
      "href",
      "/search?tab=maps&scope=played&q=dive",
    );
    expect(screen.getByRole("link", { name: "Played in 3 pools" })).toHaveAttribute(
      "href",
      "/maps/129891",
    );
    expect(screen.getByText("Not played in a pool yet")).toBeInTheDocument();
    expect(
      screen.getByText("2 hidden: not allowed in officially supported tournaments"),
    ).toBeInTheDocument();
    expect(screen.getByText("Check first")).toBeInTheDocument();
    expect(screen.getByText("Needs a closer look")).toBeInTheDocument();
    expect(screen.getByText("Unranked")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unranked maps can change or disappear after you pool them. Check the map before your round.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps one status chip at a time and writes it to the URL", async () => {
    current = new URLSearchParams("tab=maps");
    fetchMock.mockImplementation(async () => Response.json(ALL));
    const user = userEvent.setup();
    render(<SearchScreen />);
    const ranked = await screen.findByRole("button", { name: "Ranked" });
    expect(ranked).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Loved" }));
    expect(screen.getByRole("button", { name: "Loved" })).toHaveAttribute("aria-pressed", "true");
    expect(ranked).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Loved" }));
    expect(screen.getByRole("button", { name: "Loved" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByLabelText("Show explicit maps"));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/search?tab=maps&status=loved&explicit=show", {
        scroll: false,
      }),
    );
  });

  it("says when searching all maps fails and links the same search in played maps", async () => {
    current = new URLSearchParams("tab=maps&q=dive");
    fetchMock.mockImplementation(async () =>
      Response.json(
        {
          error: {
            code: "mirror_unavailable",
            message:
              "Searching all osu! maps isn't working right now. Maps played in pools still work.",
          },
        },
        { status: 503 },
      ),
    );
    render(<SearchScreen />);
    expect(
      await screen.findByText(
        "Searching all osu! maps isn't working right now. Maps played in pools still work.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search maps played in pools" })).toHaveAttribute(
      "href",
      "/search?tab=maps&scope=played&q=dive",
    );
    expect(screen.queryByText(/0 maps/)).toBeNull();
  });
});
