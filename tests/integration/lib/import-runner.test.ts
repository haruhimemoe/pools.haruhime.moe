/**
 * @file tests/integration/lib/import-runner.test.ts
 * @desc The whole import run on the sample export with otdb, the mirror and packs stood in by
 *       msw: bad arguments, a dry run that writes nothing, a real run (pools, filled maps,
 *       stats, usage, packs synced, a stored report), a second run that sends packs nothing,
 *       --no-sync, a missing token and a 401 (both exit 1 after writing the pools), a run that
 *       throws after writing (a report stored, exit 1), a run that throws before writing (no
 *       report), and the download when --file isn't given.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { OTDB_EXPORT_URL } from "@/constants/pools";
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
import { T0 } from "../../helpers/records";

const SAMPLE_PATH = path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json");
const SAMPLE_TEXT = readFileSync(SAMPLE_PATH, "utf8");
const SEEDS = readOtdbExport(JSON.parse(SAMPLE_TEXT)).maps;
const ROWS = new Map([...SEEDS].map(([id, seed]) => [id, mirrorRow(id, seed)]));

setupTestDb();
const server = setupMsw(
  mirrorHandler(ROWS),
  packsStatsHandler([() => HttpResponse.json({ updated: 0, remaining: 0 })]),
  http.get(OTDB_EXPORT_URL, () =>
    HttpResponse.text(SAMPLE_TEXT, { headers: { "Content-Type": "application/json" } }),
  ),
);

const run = async (
  argv: string[],
  packsService: () => typeof TEST_SERVICE | null = () => TEST_SERVICE,
) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runImport(argv, {
    readFile: async (file) =>
      file === "sample.json" ? SAMPLE_TEXT : Promise.reject(new Error(`no ${file}`)),
    log: (text) => out.push(text),
    warn: (text) => err.push(text),
    now: () => T0,
    packsService,
    sleep: async () => {},
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
};

describe("runImport", () => {
  it("answers 2 and the usage for bad arguments", async () => {
    const result = await run(["otdb", "--force"]);
    expect(result.code).toBe(2);
    expect(result.err).toContain("Unknown option --force.");
    expect(result.err).toContain("Usage: bun run import otdb");
  });

  it("plans and prints on a dry run, writing nothing", async () => {
    const result = await run(["otdb", "--dry-run", "--file", "sample.json"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("otdb: 22 pools read. Dry run: nothing was written.");
    expect(result.out).toMatch(/ {2}New pools +17$/m);
    expect(await (await poolsCollection()).countDocuments()).toBe(0);
    expect(await listImportReports()).toEqual([]);
  });

  it("writes, fills, syncs, reports, and sends nothing on a second run", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    const first = await run(["otdb", "--file", "sample.json"]);
    expect(first.code).toBe(0);
    const pools = await poolsCollection();
    expect(await pools.countDocuments()).toBe(17);
    expect(await pools.countDocuments({ "stats.complete": true })).toBe(17);
    expect(await pools.countDocuments({ "pack.state": "created" })).toBe(17);
    expect(calls).toHaveLength(17);
    expect(calls.every((call) => call.authorization === `Bearer ${TEST_SERVICE.token}`)).toBe(true);
    const maps = await mapsCollection();
    expect(await maps.countDocuments({ metaSource: "mirror" })).toBe(await maps.countDocuments());
    expect((await maps.findOne({ _id: 989603 }))?.usage).toMatchObject({ count: 1, shown: true });
    const [report] = await listImportReports();
    expect(report).toMatchObject({
      ok: true,
      read: 22,
      counts: { created: 17, merged: 2, skipped: 3 },
    });
    expect(first.out).toContain("Packs: 17 of 17 due sent. 17 created");
    expect(first.out).toContain("Press Refresh public pages on /admin");

    calls.length = 0;
    const second = await run(["otdb", "--file", "sample.json"]);
    expect(second.code).toBe(0);
    expect(calls).toEqual([]);
    expect(second.out).toMatch(/ {2}Unchanged +17$/m);
    expect(await listImportReports()).toHaveLength(2);
  });

  it("skips packs with --no-sync", async () => {
    const calls: PutCall[] = [];
    server.use(packsPutHandler((id) => createdAnswer(id), calls));
    const result = await run(["otdb", "--file", "sample.json", "--no-sync"]);
    expect(result.code).toBe(0);
    expect(calls).toEqual([]);
    expect(result.out).toContain("Packs: not synced (--no-sync).");
  });

  it("exits 1 without a token, after writing the pools", async () => {
    const result = await run(["otdb", "--file", "sample.json"], () => null);
    expect(result.code).toBe(1);
    expect(result.out).toContain("POOLS_SERVICE_TOKEN isn't set");
    expect(await (await poolsCollection()).countDocuments()).toBe(17);
    expect((await listImportReports())[0]?.ok).toBe(false);
  });

  it("exits 1 when packs refuses the token", async () => {
    server.use(packsPutHandler(() => HttpResponse.json({}, { status: 401 })));
    const result = await run(["otdb", "--file", "sample.json"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("Stopped: packs refused the service token (401).");
  });

  it("stores a report when a real run stops partway, and still exits 1", async () => {
    const result = await run(["otdb", "--file", "sample.json"], () => {
      throw new Error("the service settings couldn't be read");
    });
    expect(result.code).toBe(1);
    expect(result.err).toContain("import stopped: the service settings couldn't be read");
    expect(await (await poolsCollection()).countDocuments()).toBe(17);
    const reports = await listImportReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ ok: false, read: 22, counts: { created: 17 } });
    expect(reports[0]?.text).toContain("Stopped: the service settings couldn't be read");
  });

  it("stores no report when a run stops before it writes anything", async () => {
    const result = await run(["otdb", "--file", "missing.json"]);
    expect(result.code).toBe(1);
    expect(await listImportReports()).toEqual([]);
  });

  it("downloads the export when --file isn't given", async () => {
    const result = await run(["otdb", "--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("otdb: 22 pools read.");
  });
});
