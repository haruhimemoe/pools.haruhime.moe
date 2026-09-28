/**
 * @file tests/integration/e2e/otdb-import.test.ts
 * @desc The importer over the real otdb export (POOLS_E2E_EXPORT names the file; skipped without
 *       it) into the in-memory database, with the mirror and packs stood in by msw: a dry run that
 *       writes nothing; a real run (counts, every skip reason, merges, notes, years, usage, filled
 *       maps and stats, sync states for 201/422/410/429, the stats backfill); a second run that
 *       changes nothing and sends only the failed pool; a pool changed at the source (superseded,
 *       its successor public, the old pack unlisted); --resync rejected; and a 401 that stops the
 *       run with exit code 1.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { runImport } from "@/lib/import-runner";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { listImportReports } from "@/services/imports";
import { readOtdbExport } from "@/utils/otdb";
import { setupTestDb } from "../../helpers/db";
import { mirrorHandler, mirrorRow } from "../../helpers/hinai-server";
import {
  createdAnswer,
  type PutCall,
  packsPutHandler,
  packsStatsHandler,
  TEST_SERVICE,
} from "../../helpers/packs-server";

const EXPORT = process.env.POOLS_E2E_EXPORT;

type RawPool = {
  id: number;
  beatmap_connections: { beatmap: { beatmap_metadata: { id: number } } }[];
};

setupTestDb();
const server = setupMsw();

describe.skipIf(!EXPORT)("the importer over the real otdb export", () => {
  it("dry-runs, imports, reruns, follows a changed pool and stops on a bad token", async () => {
    const text = readFileSync(EXPORT ?? "", "utf8");
    const seeds = readOtdbExport(JSON.parse(text)).maps;
    const rows = new Map(
      [...seeds].filter(([id]) => id % 97 !== 0).map(([id, seed]) => [id, mirrorRow(id, seed)]),
    );
    const changed = (poolId: number) => {
      const raw = JSON.parse(text) as RawPool[];
      const map = raw.find((pool) => pool.id === poolId)?.beatmap_connections[0]?.beatmap
        .beatmap_metadata;
      if (!map) throw new Error(`no otdb #${poolId}`);
      map.id = 75;
      return JSON.stringify(raw);
    };
    const files = new Map([
      ["export.json", text],
      ["changed-58.json", changed(58)],
    ]);
    const calls: PutCall[] = [];
    let throttled = false;
    server.use(
      mirrorHandler(rows),
      packsStatsHandler([
        () => HttpResponse.json({ updated: 40, remaining: 20 }),
        () => HttpResponse.json({ updated: 20, remaining: 0 }),
      ]),
      packsPutHandler((id) => {
        if (id === "otdb-36")
          return HttpResponse.json(
            { error: { message: "Please keep the name free of slurs." } },
            { status: 422 },
          );
        if (id === "otdb-37") return HttpResponse.json({ code: "gone" }, { status: 410 });
        if (id === "otdb-38" && !throttled) {
          throttled = true;
          return HttpResponse.json({}, { status: 429, headers: { "Retry-After": "1" } });
        }
        return createdAnswer(id);
      }, calls),
    );
    const out: string[] = [];
    const run = (argv: string[]) =>
      runImport(argv, {
        readFile: async (file) => files.get(file) ?? Promise.reject(new Error(`no ${file}`)),
        log: (line) => out.push(line),
        warn: (line) => out.push(line),
        packsService: () => TEST_SERVICE,
        sleep: async () => {},
      });
    const pools = await poolsCollection();
    const maps = await mapsCollection();

    // Dry run: the plan, nothing written.
    expect(await run(["otdb", "--dry-run", "--file", "export.json"])).toBe(0);
    const dry = out.join("\n");
    expect(dry).toContain("otdb: 643 pools read. Dry run: nothing was written.");
    expect(dry).toMatch(/ {2}New pools +633$/m);
    expect(dry).toMatch(/ {2}Same pool twice +2$/m);
    expect(dry).toMatch(/ {2}Skipped +8$/m);
    expect(await pools.countDocuments()).toBe(0);

    // Real run.
    expect(await run(["otdb", "--file", "export.json"])).toBe(0);
    expect(await pools.countDocuments({ visible: true })).toBe(633);
    expect((await pools.findOne({ _id: "otdb-71" }))?.sources.map((source) => source.id)).toEqual([
      "71",
      "418",
    ]);
    expect((await pools.findOne({ _id: "otdb-283" }))?.sources.map((source) => source.id)).toEqual([
      "283",
      "445",
    ]);
    expect(await pools.countDocuments({ notes: { $ne: "" } })).toBe(9);
    expect(await pools.countDocuments({ year: { $ne: null } })).toBe(219);
    expect(await pools.findOne({ _id: "otdb-657" })).toMatchObject({
      tournament: "osu! World Cup",
      round: "Grand Finals",
      year: 2023,
      tournamentKey: "osu-world-cup",
    });
    expect(await maps.countDocuments()).toBe(7093);
    expect(await maps.countDocuments({ metaSource: "mirror" })).toBe(7093 - 63);
    expect(await pools.countDocuments({ "stats.complete": true })).toBe(533);
    const top = await maps.find({ "usage.count": 11 }, { projection: { _id: 1 } }).toArray();
    expect(top.map((map) => map._id).sort((a, b) => a - b)).toEqual([59892, 1034570]);
    expect((await maps.findOne({ _id: 989603 }))?.usage.count).toBe(2);
    const states = async (state: string) => pools.countDocuments({ "pack.state": state });
    expect([
      await states("created"),
      await states("rejected"),
      await states("gone"),
      await states("error"),
    ]).toEqual([630, 1, 1, 1]);
    const [first] = await listImportReports();
    expect(first).toMatchObject({
      ok: true,
      read: 643,
      counts: { created: 633, merged: 2, skipped: 8 },
      stats: { stopped: "done", calls: 2 },
    });
    expect(first?.skipped.map((pool) => pool.id)).toEqual([
      "481",
      "665",
      "666",
      "667",
      "668",
      "669",
      "670",
      "671",
    ]);
    expect(first?.skipped[0]?.reason).toBe("Slot DT1: DT1 appears more than once.");
    for (const pool of first?.skipped.slice(1) ?? [])
      expect(pool.reason).toMatch(/^(Maps without a slot are played with mods|Slot S:) /);

    // Second run: nothing changes; only the failed pool goes to packs again.
    calls.length = 0;
    out.length = 0;
    expect(await run(["otdb", "--file", "export.json"])).toBe(0);
    expect(out.join("\n")).toMatch(/ {2}Unchanged +633$/m);
    expect(calls.map((call) => call.id)).toEqual(["otdb-38"]);
    expect(await states("error")).toBe(0);

    // otdb #58 changes at the source.
    calls.length = 0;
    expect(await run(["otdb", "--file", "changed-58.json"])).toBe(0);
    expect(await pools.findOne({ _id: "otdb-58" })).toMatchObject({
      supersededBy: "otdb-58-2",
      visible: false,
    });
    expect(await pools.findOne({ _id: "otdb-58-2" })).toMatchObject({
      supersededBy: null,
      visible: true,
    });
    expect(calls.map((call) => [call.id, call.body.visibility]).sort()).toEqual([
      ["otdb-58", "unlisted"],
      ["otdb-58-2", "public"],
    ]);
    expect((await maps.findOne({ _id: 989603 }))?.usage.count).toBe(1);
    expect((await maps.findOne({ _id: 75 }))?.usage.count).toBe(1);

    // --resync rejected sends the rejected pool again.
    calls.length = 0;
    expect(await run(["otdb", "--file", "changed-58.json", "--resync", "rejected"])).toBe(0);
    expect(calls.map((call) => call.id)).toEqual(["otdb-36"]);

    // A bad token stops the run with exit code 1.
    files.set(
      "changed-59.json",
      (() => {
        const raw = JSON.parse(files.get("changed-58.json") ?? "[]") as RawPool[];
        const map = raw.find((pool) => pool.id === 59)?.beatmap_connections[0]?.beatmap
          .beatmap_metadata;
        if (map) map.id = 76;
        return JSON.stringify(raw);
      })(),
    );
    server.use(packsPutHandler(() => HttpResponse.json({}, { status: 401 })));
    out.length = 0;
    expect(await run(["otdb", "--file", "changed-59.json"])).toBe(1);
    expect(out.join("\n")).toContain("Stopped: packs refused the service token (401).");
    expect((await listImportReports())[0]?.ok).toBe(false);
  }, 600_000);
});
