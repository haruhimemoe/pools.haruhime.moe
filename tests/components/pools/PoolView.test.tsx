/**
 * @file tests/components/pools/PoolView.test.tsx
 * @desc A pool page: name, headline (year or "year unknown"), badged only when known, notes,
 *       the slots (source label, map link, stars, AR, OD, length and BPM under the slot's mods,
 *       "no mod data" when the mirror had none, Copy ID), the sources with
 *       the otdb credit (earlier versions too), host and community credits (their link, when
 *       there is one, marked nofollow ugc noopener), "Replaced by" for a superseded pool, Open
 *       in packs, and the hidden notice only in the admin preview.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoolView } from "@/components/pools/PoolView";
import type { MapSummary } from "@/services/pools";
import { makePool, T0 } from "../../helpers/records";

const POOL = makePool({
  _id: "otdb-657",
  name: "osu! World Cup 2023 Grand Finals",
  notes: "FM3 is different version from OWC.",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "DT", index: 1, beatmapId: 75 },
  ],
});

const MAPS = new Map<number, MapSummary>([
  [
    129891,
    {
      _id: 129891,
      setId: 39804,
      artist: "xi",
      title: "FREEDOM DiVE",
      version: "FOUR DIMENSIONS",
      stars: 7.81,
      length: 258,
      bpm: 222.22,
      ar: 9,
      od: 8,
      cs: 4,
    },
  ],
]);

const VALUES = [
  { stars: 7.81, ar: 9, od: 8, cs: 4, bpm: 222.22, length: 258, mods: "NM", source: "none" },
  {
    stars: null,
    ar: null,
    od: null,
    cs: null,
    bpm: null,
    length: null,
    mods: "DT",
    source: "math",
  },
] as const;

const view = (overrides = {}, preview = false, values: readonly unknown[] = VALUES) =>
  render(
    <PoolView
      pool={{ ...POOL, ...overrides }}
      maps={MAPS}
      values={values as never}
      openInPacks="https://packs.haruhime.moe/k#pk1.x"
      preview={preview}
    />,
  );

describe("PoolView", () => {
  it("shows the name, headline and notes, and opens in packs", () => {
    view();
    expect(
      screen.getByRole("heading", { level: 1, name: "osu! World Cup 2023 Grand Finals" }),
    ).toBeInTheDocument();
    expect(screen.getByText("osu! World Cup · Grand Finals · 2023")).toBeInTheDocument();
    expect(screen.getByText("FM3 is different version from OWC.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in packs" })).toHaveAttribute(
      "href",
      "https://packs.haruhime.moe/k#pk1.x",
    );
    expect(screen.queryByText(/badged/i)).not.toBeInTheDocument();
  });

  it("shows year unknown, and badged once it's known", () => {
    view({ year: null, badged: false });
    expect(screen.getByText("osu! World Cup · Grand Finals · year unknown")).toBeInTheDocument();
    expect(screen.getByText(/Not badged/)).toBeInTheDocument();
  });

  it("shows a slot's values under its mods, and says which mods they're under", () => {
    const dt = { stars: 10.2, ar: 10.33, od: 9.78, cs: 4, bpm: 333, length: 172 };
    view({}, false, [VALUES[0], { ...dt, mods: "DT", source: "mirror" }]);
    const row = within(screen.getByRole("table")).getAllByRole("row")[2] as HTMLElement;
    expect(row).toHaveTextContent("10.20★DT");
    expect(row).toHaveTextContent("10.3");
    expect(row).toHaveTextContent("9.8");
    expect(row).toHaveTextContent("2:52");
    expect(row).toHaveTextContent("333");
  });

  it("lists each slot with its source label, map, values, Copy ID, and no mod data", () => {
    view();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(rows[0] as HTMLElement).getByRole("rowheader")).toHaveTextContent("NM1");
    expect(
      within(rows[0] as HTMLElement).getByRole("link", {
        name: "xi - FREEDOM DiVE [FOUR DIMENSIONS]",
      }),
    ).toHaveAttribute("href", "/maps/129891");
    expect(rows[0]).toHaveTextContent("7.81★");
    expect(rows[0]).toHaveTextContent("4:18");
    expect(rows[0]).toHaveTextContent("222");
    expect(
      within(rows[1] as HTMLElement).getByRole("link", { name: "Beatmap 75" }),
    ).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("–");
    expect(rows[1]).toHaveTextContent("no mod data");
    expect(screen.getAllByRole("button", { name: /Copy beatmap ID/ })).toHaveLength(2);
    for (const name of ["Stars", "AR", "OD", "Length", "BPM"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(rows[0]).toHaveTextContent("7.81★no mod");
  });

  it("credits otdb and links each source, earlier versions included", () => {
    view({
      formerSources: [
        {
          kind: "otdb",
          id: "656",
          url: "https://otdb.sheppsu.me/db/mappools/656/",
          importedAt: T0,
          leftAt: T0,
        },
      ],
    });
    expect(screen.getByRole("link", { name: "otdb pool #657" })).toHaveAttribute(
      "href",
      "https://otdb.sheppsu.me/db/mappools/657/",
    );
    expect(screen.getByRole("link", { name: "otdb pool #656" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sources" })).toHaveTextContent(
      "Pool data from otdb by Sheppsu.",
    );
  });

  it("credits the hosts and community members who sent it, linking only a link they gave", () => {
    view({
      sources: [
        ...POOL.sources,
        {
          kind: "host",
          id: "hz9y8x7w",
          credit: { name: "OWC 2023 staff", url: "https://osu.ppy.sh/wiki/Tournaments/OWC/2023" },
          importedAt: T0,
        },
        { kind: "community", id: "ca1b2c3d", credit: { name: "peppy" }, importedAt: T0 },
      ],
      formerSources: [
        {
          kind: "community",
          id: "cz0z0z0z",
          credit: { name: "Old sender", url: "https://example.com/pool" },
          importedAt: T0,
          leftAt: T0,
        },
      ],
    });
    const sources = screen.getByRole("region", { name: "Sources" });
    const hosts = within(sources).getByRole("link", { name: "OWC 2023 staff" });
    expect(hosts).toHaveAttribute("href", "https://osu.ppy.sh/wiki/Tournaments/OWC/2023");
    expect(hosts).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(hosts.closest("li")).toHaveTextContent("From the tournament's hosts: OWC 2023 staff");
    expect(within(sources).queryByRole("link", { name: "peppy" })).toBeNull();
    expect(within(sources).getByText("peppy").closest("li")).toHaveTextContent("Sent by peppy");
    expect(within(sources).getByRole("link", { name: "Old sender" })).toHaveAttribute(
      "rel",
      "nofollow ugc noopener",
    );
    expect(sources).toHaveTextContent("Pool data from otdb by Sheppsu.");
  });

  it("names no otdb credit on a pool only hosts sent", () => {
    view({
      sources: [
        {
          kind: "host",
          id: "hz9y8x7w",
          credit: { name: "OWC 2023 staff" },
          importedAt: T0,
        },
      ],
    });
    const sources = screen.getByRole("region", { name: "Sources" });
    expect(sources).toHaveTextContent("From the tournament's hosts: OWC 2023 staff");
    expect(sources).not.toHaveTextContent("otdb");
  });

  it("links the pool that replaced a superseded one", () => {
    view({ supersededBy: "otdb-657-2" });
    expect(screen.getByRole("link", { name: "Replaced by otdb-657-2" })).toHaveAttribute(
      "href",
      "/pools/otdb-657-2",
    );
  });

  it("marks a hidden pool only in the admin preview", () => {
    view({ hidden: true }, true);
    expect(
      screen.getByText("This pool is hidden. Only admins see this preview."),
    ).toBeInTheDocument();
  });
});
