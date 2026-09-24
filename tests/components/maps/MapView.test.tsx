/**
 * @file tests/components/maps/MapView.test.tsx
 * @desc A map page: label, usage summary, details (set host, no-mod stars), links to osu! and the
 *       mirror, history rows in order with "year unknown", the badged column only when some row
 *       knows it, and "no current pools" when there are none.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapView } from "@/components/maps/MapView";
import type { HistoryRow } from "@/utils/history";
import { makeMap } from "../../helpers/records";

const MAP = makeMap({
  _id: 129891,
  setId: 39804,
  artist: "xi",
  title: "FREEDOM DiVE",
  version: "FOUR DIMENSIONS",
  setHost: "Nakagawa-Kanon",
  stars: 7.81,
  usage: { count: 2, lastYear: 2023, playedAs: ["NM", "DT"], shown: true },
});

const ROWS: HistoryRow[] = [
  {
    poolId: "otdb-657",
    tournament: "osu! World Cup",
    round: "Grand Finals",
    year: 2023,
    badged: null,
    slot: "NM1",
  },
  {
    poolId: "otdb-58",
    tournament: "Spring Cup",
    round: null,
    year: null,
    badged: null,
    slot: "DT2",
  },
];

describe("MapView", () => {
  it("shows the map, its usage, details and links", () => {
    render(<MapView map={MAP} history={ROWS} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "xi - FREEDOM DiVE [FOUR DIMENSIONS]" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Used in 2 pools (latest 2023)")).toBeInTheDocument();
    expect(screen.getByText("Set host")).toBeInTheDocument();
    expect(screen.getByText("Nakagawa-Kanon")).toBeInTheDocument();
    expect(screen.getByText("Stars (no mod)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open on osu!" })).toHaveAttribute(
      "href",
      "https://osu.ppy.sh/beatmaps/129891",
    );
    expect(
      screen.getByRole("link", { name: "Download from the mirror" }).getAttribute("href"),
    ).toContain("mirror.hinamizawa.ai");
  });

  it("lists history newest first with year unknown last, without a badged column nobody knows", () => {
    render(<MapView map={MAP} history={ROWS} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("osu! World Cup · Grand Finals");
    expect(within(rows[0] as HTMLElement).getByRole("link")).toHaveAttribute(
      "href",
      "/pools/otdb-657",
    );
    expect(rows[1]).toHaveTextContent("year unknown");
    expect(screen.queryByRole("columnheader", { name: "Badged" })).not.toBeInTheDocument();
  });

  it("shows the badged column once a row knows it", () => {
    render(<MapView map={MAP} history={[{ ...(ROWS[0] as HistoryRow), badged: true }]} />);
    expect(screen.getByRole("columnheader", { name: "Badged" })).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("says when no current pool uses the map", () => {
    render(
      <MapView
        map={{ ...MAP, usage: { count: 0, lastYear: null, playedAs: [], shown: true } }}
        history={[]}
      />,
    );
    expect(screen.getByText("Not in any current pool")).toBeInTheDocument();
    expect(screen.getByText("No current pool uses this map.")).toBeInTheDocument();
  });
});
