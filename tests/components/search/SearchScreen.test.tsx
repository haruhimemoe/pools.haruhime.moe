/**
 * @file tests/components/search/SearchScreen.test.tsx
 * @desc The search page: it fetches the URL's search and lists the results with the count and
 *       "hidden, data missing"; typing writes the URL (once the typing stops); the badged row
 *       shows only when some pool knows it; the route's message shows under "contains map"; the
 *       maps tab lists maps played in pools with their usage; the pages link through the URL.
 *       All maps (the maps tab's default): the scope switch, sets with their difficulties and
 *       how many pools played each, "Check first" and the unranked line, how many sets were
 *       hidden and why (both read out with the live count), one status chip at a time, the page
 *       as the count when there's no total, and the fixed failure sentence with a link to the
 *       same search in maps played in pools (only when the mirror is down, not for a 429 or a
 *       network error). A failed search's count says "Couldn't search", and a failed all-maps
 *       search drops the stale sets and their lines.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { render, screen, waitFor, within } from "@testing-library/react";
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
      kind: "past",
      builtBy: null,
      badged: true,
      stats: { srMin: 6.1, srMax: 7.4, count: 20, complete: true },
    },
  ],
};

const BUILT = {
  ...POOLS,
  total: 1,
  pageCount: 1,
  hiddenMissing: 0,
  badgedKnown: false,
  results: [
    {
      kind: "built",
      builtBy: "peppy",
      id: "b-a0000001",
      name: "My Cup Finals",
      tournament: "",
      round: null,
      year: null,
      badged: null,
      stats: { srMin: null, srMax: null, count: 3, complete: false },
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

  it("picks past pools by default, built here or both as radio chips, kept in the URL", async () => {
    current = new URLSearchParams("q=cup");
    fetchMock.mockImplementation(async () => Response.json(POOLS));
    const user = userEvent.setup();
    render(<SearchScreen />);
    const past = await screen.findByRole("radio", { name: "Past tournament pools" });
    expect(past).toBeChecked();
    expect(screen.getByRole("group", { name: "Pools" })).toBeInTheDocument();
    fetchMock.mockImplementation(async () => Response.json(BUILT));
    await user.click(screen.getByRole("radio", { name: "Built here" }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/search?type=built&q=cup", { scroll: false }),
    );
    expect(await screen.findByRole("link", { name: "My Cup Finals" })).toHaveAttribute(
      "href",
      "/pools/b-a0000001",
    );
    expect(screen.getByText("3 maps · Built by peppy")).toBeInTheDocument();
    // Built pools have no badged or star data to filter by.
    expect(screen.queryByRole("group", { name: "Stars (no mod)" })).toBeNull();
  });

  it("reads type=both from the URL", async () => {
    current = new URLSearchParams("type=both");
    fetchMock.mockImplementation(async () => Response.json(POOLS));
    render(<SearchScreen />);
    expect(await screen.findByRole("radio", { name: "Both" })).toBeChecked();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/search?type=both", expect.anything()),
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
    expect(screen.getByText(/the maps they played, and every osu! map/)).toBeInTheDocument();
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
    const card = (title: string) => screen.getByText(title).closest("li") as HTMLElement;
    expect(within(card("xi - FREEDOM DiVE")).getByText("Ranked")).toBeInTheDocument();
    expect(within(card("Frums - Credits")).getByText("Pending")).toBeInTheDocument();
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
    const ranked = await screen.findByRole("radio", { name: "Ranked" });
    expect(ranked).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.queryByRole("radio", { name: "Any" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Loved" }));
    expect(screen.getByRole("radio", { name: "Loved" })).toBeChecked();
    expect(ranked).not.toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Loved" }));
    expect(screen.getByRole("radio", { name: "Loved" })).toBeChecked();
    await user.click(screen.getByLabelText("Show explicit maps"));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/search?tab=maps&status=loved&explicit=show", {
        scroll: false,
      }),
    );
  });

  it("moves between statuses with the arrow keys, one tab stop for the group", async () => {
    current = new URLSearchParams("tab=maps");
    fetchMock.mockImplementation(async () => Response.json(ALL));
    const user = userEvent.setup();
    render(<SearchScreen />);
    const ranked = await screen.findByRole("radio", { name: "Ranked" });
    expect(screen.getByRole("group", { name: "Status" })).toContainElement(ranked);
    screen.getByLabelText("Title, artist or mapper").focus();
    await user.tab();
    expect(ranked).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const loved = screen.getByRole("radio", { name: "Loved" });
    expect(loved).toHaveFocus();
    expect(loved).toBeChecked();
    await user.tab();
    expect(screen.queryByRole("radio", { name: "Qualified" })).not.toHaveFocus();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/search?tab=maps&status=loved", { scroll: false }),
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

  it("reads the hidden count and the unranked line out with the live count", async () => {
    current = new URLSearchParams("tab=maps");
    fetchMock.mockImplementation(async () => Response.json(ALL));
    const { container } = render(<SearchScreen />);
    await screen.findByText("xi - FREEDOM DiVE");
    expect(container.querySelector("output")).toHaveTextContent(
      "60 sets. 2 hidden: not allowed in officially supported tournaments. Unranked maps can",
    );
  });

  it("says the page when the mirror gives no total", async () => {
    current = new URLSearchParams("tab=maps&page=3");
    fetchMock.mockImplementation(async () => Response.json({ ...ALL, page: 3, total: null }));
    const { container } = render(<SearchScreen />);
    await screen.findByText("xi - FREEDOM DiVE");
    expect(container.querySelector("output")).toHaveTextContent(/^Page 3\./);
  });

  it("drops the stale sets and says it couldn't search when a later search fails", async () => {
    current = new URLSearchParams("tab=maps&q=dive");
    fetchMock.mockImplementationOnce(async () => Response.json(ALL));
    fetchMock.mockImplementation(async () =>
      Response.json({ error: { code: "mirror_unavailable", message: "Down." } }, { status: 503 }),
    );
    const user = userEvent.setup();
    const { container } = render(<SearchScreen />);
    await screen.findByText("xi - FREEDOM DiVE");
    await user.type(screen.getByLabelText("Title, artist or mapper"), "x");
    expect(await screen.findByText("Down.")).toBeInTheDocument();
    expect(container.querySelector("output")).toHaveTextContent("Couldn't search");
    expect(screen.queryByText("xi - FREEDOM DiVE")).toBeNull();
    expect(screen.queryByText(/2 hidden/)).toBeNull();
    expect(screen.queryByText(/Unranked maps can change/)).toBeNull();
  });

  it.each([
    [
      "a 429",
      async () =>
        Response.json({ error: { code: "rate_limited", message: "Slow down." } }, { status: 429 }),
      "Slow down.",
    ],
    [
      "a network error",
      async (): Promise<Response> => {
        throw new TypeError("offline");
      },
      "Search didn't load. Check your connection and try again.",
    ],
  ])("links no played-maps search after %s", async (_label, answer, message) => {
    current = new URLSearchParams("tab=maps&q=dive");
    fetchMock.mockImplementation(answer);
    const { container } = render(<SearchScreen />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Search maps played in pools" })).toBeNull();
    expect(container.querySelector("output")).toHaveTextContent("Couldn't search");
  });
});
