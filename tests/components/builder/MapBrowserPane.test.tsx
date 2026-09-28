/**
 * @file tests/components/builder/MapBrowserPane.test.tsx
 * @desc The map browser in the editor: each set with its tags and each difficulty with values
 *       under the lens, played-in links and what the page left out; the failure (with Retry,
 *       which puts focus on the pane's heading),
 *       empty and loading states; Qualified and Pending forcing the lens to NM (and taking the
 *       explicit checkbox, which the other statuses replace with a line); the lens of the page on
 *       screen naming the ranges and Add (snapping to the answer's lens, kept while a new lens
 *       loads) and "no mod data" on values worked out without the mirror's; the filters in the
 *       editor URL's browse param. Add, the picker and the keyboard are in
 *       MapBrowserAdd.test.tsx. A fake fetch answers; nothing reaches the network.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPLICIT_LINE, MOD_VALUES_NOTE, NO_MOD_VALUES } from "@/constants/browse";
import { UNRANKED_WARNING } from "@/constants/search";
import { diff, lensAsked, renderPane, set } from "../../helpers/browse-pane";
import { browsePage } from "../../helpers/pool-editor";

const home = () => window.history.replaceState(null, "", "/pools/b-a0000001/edit");
beforeEach(home);
afterEach(home);

const page =
  (over = {}) =>
  () =>
    Response.json(browsePage(over));

describe("MapBrowserPane results", () => {
  it("shows each set and its difficulties with values under the lens", async () => {
    const played = diff(12, { playedIn: 2, starsNoMod: 6.42 });
    const graveyard = set(2, [diff(21)], {
      status: "graveyard",
      unranked: true,
      check: { text: "Its takedown notice needs a look." },
    });
    renderPane({
      answer: page({
        lens: "HR",
        sets: [set(1, [diff(11), played]), graveyard],
        hidden: 3,
        filteredOnPage: 2,
      }),
    });
    const first = await screen.findByText("xi - Song 1");
    expect(first).toHaveAttribute("href", "https://osu.ppy.sh/beatmapsets/1");
    const card = first.closest("li") as HTMLElement;
    expect(within(card).getByText("Ranked")).toBeInTheDocument();
    expect(within(card).getByText("Mapped by Mapper")).toBeInTheDocument();
    const row = card.querySelector('[data-diff="11"]') as HTMLElement;
    expect(row).toHaveTextContent("6.42 starsHR (5.80★ no mod)");
    expect(row).toHaveTextContent("CS4.5AR10OD9.5BPM240Length2:00");
    expect(row).toHaveTextContent("Not played in a past pool");
    const link = within(card).getByRole("link", { name: "Played in 2 past pools" });
    expect(link).toHaveAttribute("href", "/maps/12");
    expect(card.querySelector('[data-diff="12"]')).not.toHaveTextContent("no mod");
    const other = screen.getByText("xi - Song 2").closest("li") as HTMLElement;
    expect(within(other).getByText("Unranked")).toBeInTheDocument();
    expect(within(other).getByText("Check first")).toBeInTheDocument();
    expect(within(other).getByText("Its takedown notice needs a look.")).toBeInTheDocument();
    expect(
      screen.getByText("3 hidden: not allowed in officially supported tournaments."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 difficulties on this page didn't match the filters under HR."),
    ).toBeInTheDocument();
    expect(screen.getByText(UNRANKED_WARNING)).toBeInTheDocument();
    expect(screen.getByText(MOD_VALUES_NOTE)).toBeInTheDocument();
    expect(screen.getByText("2 sets on this page")).toBeInTheDocument();
  });

  it("marks values worked out without the mirror's mod data, under a mod lens only", async () => {
    const sets = [set(1, [diff(11, { source: "math" }), diff(12)])];
    const { user } = renderPane({
      answer: (url) => Response.json(browsePage({ lens: lensAsked(url), sets })),
    });
    const row = async (id: number) =>
      (await screen.findByText("xi - Song 1")).closest("li")?.querySelector(`[data-diff="${id}"]`);
    expect(await row(11)).not.toHaveTextContent("no mod data");
    await user.selectOptions(screen.getByRole("combobox", { name: /Values under/ }), "HR");
    await screen.findByRole("group", { name: "Stars (HR)" });
    expect(await row(11)).toHaveTextContent("Length2:00(no mod data)");
    expect(await row(12)).not.toHaveTextContent("no mod data");
  });

  it("says when nothing on the page matches", async () => {
    renderPane({ answer: page({ sets: [] }) });
    expect(await screen.findByText(/No maps on this page match/)).toBeInTheDocument();
  });

  it("says so when map search fails, shows no stale sets, and retries", async () => {
    let fail = false;
    const { user, urls } = renderPane({
      answer: () =>
        fail
          ? Response.json(
              {
                error: {
                  code: "browse_unavailable",
                  message: "Map search isn't working right now.",
                },
              },
              { status: 503 },
            )
          : Response.json(browsePage({ sets: [set(1, [diff(11)])] })),
    });
    await screen.findByText("xi - Song 1");
    fail = true;
    await user.click(screen.getByRole("radio", { name: "Loved" }));
    expect(await screen.findByText("Map search isn't working right now.")).toBeInTheDocument();
    expect(screen.queryByText("xi - Song 1")).not.toBeInTheDocument();
    expect(screen.getByText("Couldn't search")).toBeInTheDocument();
    fail = false;
    const asked = urls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    // Retry goes while the search runs: focus waits on the pane's heading, not the page.
    expect(screen.getByRole("heading", { name: "Find maps" })).toHaveFocus();
    expect(await screen.findByText("xi - Song 1")).toBeInTheDocument();
    expect(urls.length).toBe(asked + 1);
  });

  it("says so when pools can't be reached at all", async () => {
    renderPane({
      answer: () => {
        throw new TypeError("offline");
      },
    });
    expect(await screen.findByText("Map search isn't working right now.")).toBeInTheDocument();
  });
});

describe("MapBrowserPane lens and statuses", () => {
  it("forces NM for Qualified and Pending, says why, and sends no lens or sort", async () => {
    const { user, urls } = renderPane();
    const lens = await screen.findByRole("combobox", { name: /Values under/ });
    await user.selectOptions(lens, "HR");
    await user.selectOptions(screen.getByRole("combobox", { name: "Order" }), "pp");
    expect(screen.getByText(EXPLICIT_LINE)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Show explicit maps" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Qualified" }));
    expect(lens).toBeDisabled();
    expect(lens).toHaveValue("NM");
    expect(screen.getByText(NO_MOD_VALUES)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Order" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Show explicit maps" }));
    await screen.findByText("xi - Song 1");
    await vi.waitFor(() => expect(urls.at(-1)?.search).toBe("?status=qualified&explicit=show"));
    expect(screen.getByRole("group", { name: "Mod lens" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Ranked" }));
    expect(lens).toBeEnabled();
    expect(lens).toHaveValue("HR");
  });

  it("names the ranges with the lens they're under", async () => {
    const { user } = renderPane();
    await user.selectOptions(await screen.findByRole("combobox", { name: /Values under/ }), "DT");
    await screen.findByRole("group", { name: "Stars (DT)" });
    for (const name of ["BPM", "Length", "AR", "OD"]) {
      expect(screen.getByRole("group", { name: `${name} (DT)` })).toBeInTheDocument();
    }
  });

  it("snaps to the lens the answer is under when the mirror doesn't offer the one asked", async () => {
    window.history.replaceState(null, "", "/pools/b-a0000001/edit?browse=lens%3DEZHT");
    renderPane({
      answer: () =>
        Response.json(
          browsePage({ lens: "NM", lenses: ["NM", "HD", "HR", "DT"], sets: [set(1, [diff(11)])] }),
        ),
    });
    expect(await screen.findByRole("button", { name: "Add to NM: Diff 11" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Stars (NM)" })).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Values under/ })).toHaveValue("NM"),
    );
    await vi.waitFor(() => expect(window.location.search).toBe(""));
  });

  it("keeps the page on screen under its own lens while a new lens loads", async () => {
    let release = () => {};
    const answer = (url: URL) => {
      const reply = () =>
        Response.json(browsePage({ lens: lensAsked(url), sets: [set(1, [diff(11)])] }));
      if (lensAsked(url) !== "HR") return reply();
      return new Promise<Response>((resolve) => {
        release = () => resolve(reply());
      });
    };
    const { user, urls } = renderPane({ answer });
    const lens = await screen.findByRole("combobox", { name: /Values under/ });
    await screen.findByRole("button", { name: "Add to NM: Diff 11" });
    await user.selectOptions(lens, "HR");
    await vi.waitFor(() => expect(urls.at(-1)?.search).toBe("?lens=HR"));
    expect(screen.getByRole("button", { name: "Add to NM: Diff 11" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Stars (NM)" })).toBeInTheDocument();
    expect(lens).toHaveValue("HR");
    release();
    expect(await screen.findByRole("button", { name: "Add to HR: Diff 11" })).toBeInTheDocument();
    expect(lens).toHaveValue("HR");
  });
});

describe("MapBrowserPane and the editor's URL", () => {
  it("opens with the filters the browse param holds", async () => {
    window.history.replaceState(null, "", "/pools/b-a0000001/edit?browse=lens%3DDT%26page%3D2");
    const { urls } = renderPane();
    await screen.findByText("xi - Song 1");
    expect(urls[0]?.search).toBe("?lens=DT&page=2");
    expect(screen.getByRole("combobox", { name: /Values under/ })).toHaveValue("DT");
  });

  it("writes each change back without reloading, going back to page 1", async () => {
    window.history.replaceState(null, "", "/pools/b-a0000001/edit?browse=page%3D3#maps");
    const { user } = renderPane();
    await user.click(await screen.findByRole("checkbox", { name: "Hide maps in this pool" }));
    expect(window.location.pathname).toBe("/pools/b-a0000001/edit");
    expect(window.location.hash).toBe("#maps");
    expect(new URLSearchParams(window.location.search).get("browse")).toBe("inPool=hide");
    await user.click(screen.getByRole("checkbox", { name: "Hide maps in this pool" }));
    expect(window.location.search).toBe("");
  });

  it("pages with buttons, keeping the filters", async () => {
    const { user, urls } = renderPane({
      answer: (url) =>
        Response.json(
          browsePage({
            page: Number(url.searchParams.get("page") ?? 1),
            pageCount: 3,
            sets: [set(Number(url.searchParams.get("page") ?? 1), [diff(11)])],
          }),
        ),
    });
    await screen.findByText("Page 1 of 3");
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    await user.click(previous);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(urls.map((url) => url.search)).toEqual(["", "?page=2"]);
    expect(window.location.search).toBe(`?browse=${encodeURIComponent("page=2")}`);
  });
});
