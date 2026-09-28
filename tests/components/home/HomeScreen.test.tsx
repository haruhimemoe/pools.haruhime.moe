/**
 * @file tests/components/home/HomeScreen.test.tsx
 * @desc The home page leads with building: "Build an osu! tournament mappool", Make a pool (to
 *       /new, which handles sign-in) and a line on what the builder does. Then the maps search
 *       and past pools: their counts (or "No pools yet.") with a link to where they come from
 *       instead of one source's name, a pools search that works without JavaScript, the links to
 *       search, check and submit, the pools built here lately (public ones, with who built them)
 *       and the past pools added last, each left out when there are none.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/home/HomeScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const COUNTS = { pools: 633, maps: 7093, sources: ["otdb" as const] };

describe("HomeScreen", () => {
  it("leads with building a pool", () => {
    render(<HomeScreen counts={COUNTS} />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Build an osu! tournament mappool",
    });
    const header = heading.parentElement?.parentElement as HTMLElement;
    expect(within(header).getByRole("link", { name: "Make a pool" })).toHaveAttribute(
      "href",
      "/new",
    );
    for (const feature of [
      /under a mod/,
      /content rules/,
      /played before/,
      /co-editors/,
      /packs/,
    ]) {
      expect(header).toHaveTextContent(feature);
    }
  });

  it("counts past pools and maps, and links where they come from", () => {
    const { container } = render(<HomeScreen counts={COUNTS} />);
    const where = screen.getByRole("link", { name: "where they come from" });
    expect(where).toHaveAttribute("href", "/data#pools");
    expect(where.parentElement).toHaveTextContent("633 pools · 7093 maps · where they come from");
    expect(container).not.toHaveTextContent("otdb");
  });

  it("says when there are no past pools yet", () => {
    render(<HomeScreen counts={{ pools: 0, maps: 0, sources: [] }} />);
    expect(screen.getByText("No pools yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "where they come from" })).toBeNull();
  });

  it("searches maps and past pools with plain forms, and links search and check", () => {
    render(<HomeScreen counts={COUNTS} />);
    const form = screen.getByRole("search", { name: "Pools" });
    expect(form).toHaveAttribute("action", "/search");
    expect(within(form).getByLabelText("Tournament, round or pool name")).toHaveAttribute(
      "name",
      "q",
    );
    expect(form.querySelector('input[type="hidden"][name="tab"]')).toHaveAttribute(
      "value",
      "pools",
    );
    expect(screen.getByRole("search", { name: "Maps" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse and filter" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.getByRole("link", { name: "Check a pool" })).toHaveAttribute("href", "/check");
    expect(screen.getByRole("link", { name: "Submit a pool" })).toHaveAttribute("href", "/submit");
  });

  it("lists pools built here lately and the past pools added last", () => {
    render(
      <HomeScreen
        counts={COUNTS}
        built={[
          {
            id: "b-a0000001",
            name: "My Cup Finals",
            tournament: "My Cup",
            round: "",
            year: null,
            maps: 3,
            builtBy: "peppy",
            updatedAt: new Date("2026-09-27T12:00:00.000Z"),
          },
        ]}
        recent={[
          {
            _id: "host-hz9y8x7w",
            name: "Spring Cup 2026 Grand Finals",
            tournament: "Spring Cup",
            round: "Grand Finals",
            year: 2026,
            createdAt: new Date("2026-09-25T12:00:00.000Z"),
          },
        ]}
      />,
    );
    const built = screen.getByRole("region", { name: "Recently built" });
    expect(within(built).getByRole("link", { name: "My Cup Finals" })).toHaveAttribute(
      "href",
      "/pools/b-a0000001",
    );
    expect(built).toHaveTextContent("My Cup · 3 maps · Built by peppy");
    const recent = screen.getByRole("region", { name: "Recently added" });
    expect(
      within(recent).getByRole("link", { name: "Spring Cup 2026 Grand Finals" }),
    ).toHaveAttribute("href", "/pools/host-hz9y8x7w");
    expect(recent).toHaveTextContent("Spring Cup · Grand Finals · 2026");
  });

  it("leaves both lists out when there's nothing to list", () => {
    render(<HomeScreen counts={{ pools: 0, maps: 0, sources: [] }} />);
    expect(screen.queryByRole("region", { name: "Recently added" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Recently built" })).toBeNull();
  });
});
