/**
 * @file tests/components/pools/PoolView.test.tsx
 * @desc A pool page: name, headline (year or "year unknown"), badged only when known, notes,
 *       the slots (source label, map link, no-mod stars, length, BPM, Copy ID), the sources with
 *       the otdb credit (earlier versions too), "Replaced by" for a superseded pool, Open in
 *       packs, and the hidden notice only in the admin preview.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
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
    },
  ],
]);

const view = (overrides = {}, preview = false) =>
  render(
    <PoolView
      pool={{ ...POOL, ...overrides }}
      maps={MAPS}
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

  it("lists each slot with its source label, map, no-mod stars, length, BPM and Copy ID", () => {
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
    expect(screen.getAllByRole("button", { name: /Copy beatmap ID/ })).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Stars (no mod)" })).toBeInTheDocument();
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
