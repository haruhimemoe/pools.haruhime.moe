/**
 * @file tests/unit/utils/pool-export.test.ts
 * @desc Exporting a pool from what the page already has: beatmap IDs with their slot labels,
 *       !mp lines (map with ruleset 0, then mods: None for no mods, the forced acronyms, or
 *       Freemod), and a CSV with values under each slot's mods (quoted where needed, and never
 *       read as a spreadsheet formula), in slot order, with a file name from the pool's name.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { csvFileName, csvOf, exportRows, idLines, mpLines } from "@/utils/pool-export";
import { builtMap } from "../../helpers/pool-editor";

const HDHR = { code: "HDHR", color: 0, mods: { kind: "forced", set: ["HD", "HR"] } };
const BUCKETS = [
  ...["NM", "HD", "HR", "DT", "FM"].map((code) => ({ code })),
  HDHR,
  { code: "TB" },
] as BucketEntry[];
const POOL = {
  buckets: BUCKETS,
  slots: [
    { mod: "TB", index: 1, beatmapId: 6 },
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "HD", index: 1, beatmapId: 2 },
    { mod: "FM", index: 1, beatmapId: 4 },
    { mod: "HDHR", index: 1, beatmapId: 5 },
  ],
};
const MAPS = Object.fromEntries([1, 2, 4, 5, 6].map((id) => [id, builtMap(id)]));
const VALUES = {
  "2:HD": { stars: 5.61, ar: 9, od: 8, cs: 4, bpm: 180, length: 120, mods: "HD", source: "mirror" },
} as const;

describe("pool export", () => {
  it("lists beatmap IDs with their slot labels, in slot order", () => {
    expect(idLines(POOL)).toBe("NM1 1\nHD1 2\nFM1 4\nHDHR1 5\nTB1 6");
  });

  it("writes !mp map and !mp mods for each slot", () => {
    expect(mpLines(POOL)).toBe(
      [
        "!mp map 1 0\n!mp mods None",
        "!mp map 2 0\n!mp mods HD",
        "!mp map 4 0\n!mp mods Freemod",
        "!mp map 5 0\n!mp mods HD HR",
        "!mp map 6 0\n!mp mods Freemod",
      ].join("\n\n"),
    );
  });

  it("makes a CSV with values under each slot's mods", () => {
    const rows = exportRows(
      POOL,
      { ...MAPS, 4: builtMap(4, { artist: 'Say "hi", x', title: "=1+1" }) },
      VALUES,
    );
    const lines = csvOf(rows).split("\r\n");
    expect(lines[0]).toBe(
      "Slot,Beatmap ID,Set ID,Artist,Title,Version,Mapper,Stars (with mods),Length (s),BPM,AR,OD,CS",
    );
    expect(lines[1]).toBe("NM1,1,10,xi,Song 1,Hard,Mapper,5.00,120,180,9,8,4");
    expect(lines[2]).toBe("HD1,2,20,xi,Song 2,Hard,Mapper,5.61,120,180,9,8,4");
    expect(lines[3]).toBe(`FM1,4,40,"Say ""hi"", x",'=1+1,Hard,Mapper,5.00,120,180,9,8,4`);
    expect(lines[4]).toBe("HDHR1,5,50,xi,Song 5,Hard,Mapper,,,,,,");
    expect(lines.slice(5)).toEqual(["TB1,6,60,xi,Song 6,Hard,Mapper,5.00,120,180,9,8,4", ""]);
  });

  it("keeps every text cell from starting a formula, full-width and leading-space ones too", () => {
    const risky = [
      "=1+1",
      "+1",
      "-1",
      "@SUM(A1)",
      "|calc",
      "\t=1",
      "\r=1",
      "\n=1",
      " =1",
      "＝1+1",
      "＋1",
      "－1",
      "＠SUM",
      "﹦1",
      "﹢1",
      "﹣1",
    ];
    const cells = csvOf([risky]).split("\r\n").slice(1).join("\r\n");
    // Each cell starts with an apostrophe, inside its quotes when it has to be quoted.
    const firsts = cells.match(/(^|,)"?./g)?.map((m) => m.replace(/^,/, "").replace(/^"/, ""));
    expect(firsts).toEqual(risky.map(() => "'"));
  });

  it("quotes cells with commas, quotes and line breaks, and leaves plain text and numbers", () => {
    const line = csvOf([["a,b", 'say "hi"', "two\nlines", "Normal", -1, 5.5, null]]);
    expect(line).toContain(`\r\n"a,b","say ""hi""","two\nlines",Normal,-1,5.5,\r\n`);
  });

  it("names the file after the pool", () => {
    expect(csvFileName("Spring Cup 2026: Finals!")).toBe("spring-cup-2026-finals.csv");
    expect(csvFileName("春")).toBe("pool.csv");
  });
});
