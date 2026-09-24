/**
 * @file tests/components/home/HomeScreen.test.tsx
 * @desc The home page: what pools is, its counts (or "No pools yet."), a pools search that
 *       works without JavaScript, the maps search, and the links to search and check.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/home/HomeScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("HomeScreen", () => {
  it("says what pools is and counts pools, maps and sources", () => {
    render(<HomeScreen counts={{ pools: 633, maps: 7093, sources: ["otdb"] }} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Past osu! tournament mappools" }),
    ).toBeInTheDocument();
    expect(screen.getByText("633 pools · 7093 maps · from otdb")).toBeInTheDocument();
  });

  it("says when there are no pools yet", () => {
    render(<HomeScreen counts={{ pools: 0, maps: 0, sources: [] }} />);
    expect(screen.getByText("No pools yet.")).toBeInTheDocument();
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
});
