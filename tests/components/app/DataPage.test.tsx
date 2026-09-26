/**
 * @file tests/components/app/DataPage.test.tsx
 * @desc /data: one h1, then the Pools, Maps, Content rules and Corrections sections at the
 *       #pools, #maps, #rules and #corrections anchors the footer links. Pools come from otdb
 *       (credited to Sheppsu), hosts and community members, merge by map list and name their
 *       sources; map details are JSON from the osu! API and the hinai mirror, never files, and
 *       stars are without mods; the check is guidance; corrections go to Discord or email.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
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

  it("says where map details come from, that no files are hosted and stars are without mods", () => {
    render(<DataPage />);
    const maps = section("Maps");
    expect(maps).toHaveTextContent("osu! API v2");
    expect(within(maps).getByRole("link", { name: "hinai mirror" })).toHaveAttribute(
      "href",
      "https://mirror.hinamizawa.ai",
    );
    expect(maps).toHaveTextContent(".osz");
    expect(maps).toHaveTextContent("without mods");
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
    expect(metadata.title).toBe("Data");
    expect(metadata.description).toMatch(/pools/);
    expect(String(metadata.description)).not.toContain("otdb");
  });

  it("uses no em dashes", () => {
    const { container } = render(<DataPage />);
    expect(container.textContent).not.toContain("—");
  });
});
