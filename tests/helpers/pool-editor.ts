/**
 * @file tests/helpers/pool-editor.ts
 * @desc For the builder's component tests: a pool as the browser holds it, map details, a map
 *       browser page, and a fake pool API (no network) that applies ops with the builder's own
 *       rules, bumps the version, answers GETs with the current pool, records every call, and
 *       takes one-shot answers for a test's next calls (a 400, a 409, a request that never
 *       resolves). The map browser's searches are answered from `browse` (settable, or a
 *       function of the URL) and the slot values from `values` (a function of the server's
 *       pool) and the activity log from `activity`, each recorded apart (`browseCalls`,
 *       `valueCalls`, `activityCalls`).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { vi } from "vitest";
import type { BrowseLens } from "@/constants/browse";
import type { Fetcher } from "@/lib/pool-client";
import type { ClientActivity } from "@/schemas/activity";
import type { BuiltMap, ClientPack, ClientPool } from "@/schemas/built-pool-view";
import type { BrowseResponse } from "@/utils/browse-params";
import { applyLocal } from "@/utils/built-editor";
import type { SlotValueMap } from "@/utils/slot-values";

export const DEFAULT_BUCKETS = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({
  code,
})) as BucketEntry[];

const OWNER_ACCESS = {
  isOwner: true,
  isEditor: false,
  canEdit: true,
  canManage: true,
  canDelete: true,
};
/** A private pool's pack: none. */
export const NO_PACK: ClientPack = {
  state: "none",
  href: null,
  error: null,
  gone: false,
  retry: true,
};

export const EDITOR_ACCESS = {
  isOwner: false,
  isEditor: true,
  canEdit: true,
  canManage: false,
  canDelete: false,
};

/** The content rules' pages, as the server passes them. */
export const RULES = {
  contentUsage: "https://osu.ppy.sh/wiki/Rules/Content_usage_permissions",
  officialSupport: "https://osu.ppy.sh/wiki/Tournaments/Official_support",
  project: "https://github.com/example/compliance",
};

export const nm = (index: number, beatmapId: number): PoolSlot => ({ mod: "NM", index, beatmapId });

export const clientPool = (over: Partial<ClientPool> = {}): ClientPool => ({
  id: "b-a0000001",
  name: "Spring Cup Finals",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2026,
  notes: "",
  visibility: "private",
  hidden: false,
  owner: { osuId: 10, username: "owner" },
  editors: [{ osuId: 20, username: "editor" }],
  buckets: DEFAULT_BUCKETS,
  slots: [nm(1, 10), nm(2, 20), nm(3, 30)],
  targets: {},
  slotNotes: {},
  version: 1,
  pack: NO_PACK,
  access: OWNER_ACCESS,
  ...over,
});

export const builtMap = (id: number, over: Partial<BuiltMap> = {}): BuiltMap => ({
  id,
  setId: id * 10,
  artist: "xi",
  title: `Song ${id}`,
  version: "Hard",
  setHost: "Mapper",
  stars: 5,
  length: 120,
  bpm: 180,
  ar: 9,
  od: 8,
  cs: 4,
  usage: { count: 0, lastYear: null },
  ...over,
});

export const mapsFor = (ids: readonly number[]) =>
  Object.fromEntries(ids.map((id) => [id, builtMap(id)]));

/** A map browser answer with nothing on it (override what a test needs). */
export const browsePage = (over: Partial<BrowseResponse> = {}): BrowseResponse => ({
  lens: "NM",
  lenses: ["NM", "HD", "HR", "DT", "EZ", "HT", "FL", "HDHR", "HDDT"],
  status: "ranked",
  page: 1,
  pageCount: 1,
  total: 0,
  hidden: 0,
  filteredOnPage: 0,
  excluded: 0,
  playedHidden: 0,
  modValuesAvailable: true,
  sets: [],
  ...over,
});

export type Call = { method: string; path: string; body: unknown };
type Answer = (call: Call) => Response | Promise<Response>;

/**
 * @function fakePoolApi
 * @param initial {ClientPool} the pool the fake server starts with
 * @returns the fetcher, its calls, the server's pool (settable), the map details it answers
 *          with (settable), and `next` for one-shot answers
 */
export const fakePoolApi = (initial: ClientPool) => {
  let pool = initial;
  let details: BuiltMap[] = [];
  let browse: (url: URL) => Response = (url) =>
    Response.json(browsePage({ lens: (url.searchParams.get("lens") ?? "NM") as BrowseLens }));
  let values: (current: ClientPool) => SlotValueMap = () => ({});
  let activity: ClientActivity[] = [];
  const activityCalls: string[] = [];
  const browseCalls: URL[] = [];
  const valueCalls: string[] = [];
  const calls: Call[] = [];
  const overrides: Answer[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/activity")) {
      activityCalls.push(String(input));
      return Response.json({ activity });
    }
    if (String(input).endsWith("/values")) {
      valueCalls.push(String(input));
      return Response.json({ values: values(pool), complete: true });
    }
    if (String(input).startsWith("/api/maps/browse")) {
      const url = new URL(String(input), "http://localhost");
      browseCalls.push(url);
      return browse(url);
    }
    const call = {
      method: init?.method ?? "GET",
      path: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    // One-shot answers are for the pool's own routes, never the map details.
    const override = call.path.endsWith("/maps") ? undefined : overrides.shift();
    if (override) return override(call);
    if (call.path.endsWith("/ops")) {
      const result = applyLocal(pool, (call.body as { ops: never[] }).ops);
      if (!result.ok) {
        const { code, message, op, lines } = result;
        return Response.json({ error: { code, message, op, lines } }, { status: 400 });
      }
      pool = { ...result.pool, version: pool.version + 1 };
      return Response.json({ pool });
    }
    if (call.path.endsWith("/maps")) return Response.json({ maps: details, error: null });
    if (call.method === "GET") return Response.json({ pool });
    return new Response(null, { status: 204 });
  });
  return {
    fetcher: fetcher as unknown as Fetcher,
    calls,
    get pool() {
      return pool;
    },
    set pool(next: ClientPool) {
      pool = next;
    },
    /** What GET .../maps answers with. */
    set details(next: BuiltMap[]) {
      details = next;
    },
    /** What the map browser's searches get: a page, or an answer made from the URL. */
    set browse(next: BrowseResponse | ((url: URL) => Response)) {
      browse = typeof next === "function" ? next : () => Response.json(next);
    },
    browseCalls,
    valueCalls,
    activityCalls,
    /** What GET .../activity answers with. */
    set activity(next: ClientActivity[]) {
      activity = next;
    },
    /** What GET .../values answers with, from the server's pool. */
    set values(next: (current: ClientPool) => SlotValueMap) {
      values = next;
    },
    next: (answer: Answer) => overrides.push(answer),
  };
};
