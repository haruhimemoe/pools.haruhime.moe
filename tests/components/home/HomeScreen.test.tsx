/**
 * @file tests/components/home/HomeScreen.test.tsx
 * @desc The home page: what pools is (pools and every osu! map), its counts (or "No pools
 *       yet.") with a link to where pools come from instead of one source's name, a pools search
 *       that works without JavaScript, the maps search, the links to search, check and submit,
 *       and the pools added last.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/home/HomeScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("HomeScreen", () => {
  it("says what pools is, counts pools and maps, and links where they come from", () => {
    const { container } = render(
      <HomeScreen counts={{ pools: 633, maps: 7093, sources: ["otdb"] }} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Past osu! tournament mappools" }),
    ).toBeInTheDocument();
    const where = screen.getByRole("link", { name: "where they come from" });
    expect(where).toHaveAttribute("href", "/data#pools");
    expect(where.parentElement).toHaveTextContent("633 pools · 7093 maps · where they come from");
    expect(container).not.toHaveTextContent("otdb");
    expect(container).toHaveTextContent(/Search pools from past tournaments and every osu! map/);
  });

  it("says when there are no pools yet", () => {
    render(<HomeScreen counts={{ pools: 0, maps: 0, sources: [] }} />);
    expect(screen.getByText("No pools yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "where they come from" })).toBeNull();
  });

  it("searches pools with a plain form and links search and check", () => {
    render(<HomeScreen counts={{ pools: 1, maps: 1, sources: ["otdb"] }} />);
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
  });

  it("lists the pools added last, linking their pages", () => {
    render(
      <HomeScreen
        counts={{ pools: 2, maps: 3, sources: ["otdb", "host"] }}
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
    const recent = screen.getByRole("region", { name: "Recently added" });
    expect(
      within(recent).getByRole("link", { name: "Spring Cup 2026 Grand Finals" }),
    ).toHaveAttribute("href", "/pools/host-hz9y8x7w");
    expect(recent).toHaveTextContent("Spring Cup · Grand Finals · 2026");
    expect(screen.getByRole("link", { name: "Submit a pool" })).toHaveAttribute("href", "/submit");
  });

  it("leaves Recently added out when there's nothing to list", () => {
    render(<HomeScreen counts={{ pools: 0, maps: 0, sources: [] }} />);
    expect(screen.queryByRole("region", { name: "Recently added" })).toBeNull();
  });
});
