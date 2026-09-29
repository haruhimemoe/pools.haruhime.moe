/**
 * @file tests/components/app/DataPage.test.tsx
 * @desc /data: one h1, then the Pools, Maps, Content rules and Corrections sections at the
 *       #pools, #maps, #rules and #corrections anchors the footer links. Pools come from otdb
 *       (credited to Sheppsu), hosts and community members, merge by map list and name their
 *       sources; map details are JSON from the hinai mirror (osu! API data; a map it doesn't have
 *       keeps its source's), never files, and
 *       values with mods come from the mirror and can differ slightly; the check is guidance, and the all-maps search can't see
 *       takedowns on ranked and loved maps; corrections go to Discord or email.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DataPage, { metadata } from "@/app/data/page";

const section = (name: string) => screen.getByRole("region", { name });

describe("/data", () => {
  it("has one h1 and a titled section at each anchor, in order", () => {
    const { container } = render(<DataPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const ids = [...container.querySelectorAll("section[id]")].map((node) => node.id);
    expect(ids).toEqual(["pools", "maps", "rules", "corrections"]);
    for (const [id, name] of [
      ["pools", "Pools"],
      ["maps", "Maps"],
      ["rules", "Content rules"],
      ["corrections", "Corrections"],
    ] as const) {
      const region = section(name);
      expect(region).toHaveAttribute("id", id);
      expect(within(region).getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("names every place pools come from, credits otdb and links sending one", () => {
    render(<DataPage />);
    const pools = section("Pools");
    expect(within(pools).getByRole("link", { name: "otdb" })).toHaveAttribute(
      "href",
      "https://otdb.sheppsu.me",
    );
    expect(pools).toHaveTextContent("Sheppsu");
    expect(pools).toHaveTextContent(/tournament hosts/i);
    expect(pools).toHaveTextContent(/community members/i);
    expect(pools).toHaveTextContent(/same maps/i);
    expect(pools).toHaveTextContent(/names its sources/i);
    expect(pools).not.toHaveTextContent(/every pool comes from otdb/i);
    expect(within(pools).getByRole("link", { name: "Submit a pool" })).toHaveAttribute(
      "href",
      "/submit",
    );
  });

  it("says pools built here get a pack on packs and never count as played before", () => {
    render(<DataPage />);
    const pools = section("Pools");
    expect(pools).toHaveTextContent(/Pools built here/);
    expect(pools).toHaveTextContent(/unlisted or public and has maps gets a pack on packs/);
    expect(pools).toHaveTextContent(/never count toward where a map was played before/);
  });

  it("says where map details and values with mods come from, and that no files are hosted", () => {
    render(<DataPage />);
    const maps = section("Maps");
    expect(maps).toHaveTextContent("which serves osu! API data");
    expect(maps).toHaveTextContent("A map the mirror doesn't have keeps what its source gave.");
    expect(within(maps).getByRole("link", { name: "hinai mirror" })).toHaveAttribute(
      "href",
      "https://mirror.hinamizawa.ai",
    );
    expect(maps).toHaveTextContent(".osz");
    expect(maps).toHaveTextContent("under the slot's mods");
    expect(maps).toHaveTextContent("can differ slightly from osu!'s");
    expect(maps).toHaveTextContent("no mod data");
  });

  it("says the check follows the published rules and the Tournament Committee decides", () => {
    render(<DataPage />);
    const rules = section("Content rules");
    expect(within(rules).getByRole("link", { name: "@haruhimemoe/compliance" })).toHaveAttribute(
      "href",
      "https://github.com/haruhimemoe/compliance",
    );
    expect(rules).toHaveTextContent("officially supported tournaments");
    expect(rules).toHaveTextContent("can be wrong");
    expect(rules).toHaveTextContent("the osu! Tournament Committee decides");
  });

  it("says the all-maps search can't see takedowns on ranked and loved maps", () => {
    render(<DataPage />);
    const rules = section("Content rules");
    expect(rules).toHaveTextContent(/for ranked and loved maps, that search can't see takedown/i);
    expect(within(rules).getByRole("link", { name: "Check a pool" })).toHaveAttribute(
      "href",
      "/check",
    );
  });

  it("takes corrections on Discord or by email", () => {
    render(<DataPage />);
    const corrections = section("Corrections");
    expect(within(corrections).getByRole("link", { name: "Discord server" })).toHaveAttribute(
      "href",
      "https://discord.gg/bKy9kjMV4y",
    );
    expect(within(corrections).getByRole("link", { name: "contact@haruhime.moe" })).toHaveAttribute(
      "href",
      "mailto:contact@haruhime.moe",
    );
  });

  it("has a title and a description that don't pin every pool on otdb", () => {
    expect(metadata.title).toEqual({
      absolute: "Where pool and map data comes from · pools.haruhime.moe",
    });
    expect(metadata.alternates?.canonical).toBe("https://pools.haruhime.moe/data");
    expect(metadata.description).toMatch(/pools/);
    expect(String(metadata.description)).not.toContain("otdb");
  });

  it("uses no em dashes", () => {
    const { container } = render(<DataPage />);
    expect(container.textContent).not.toContain("—");
  });
});
