/**
 * @file tests/unit/utils/sync.test.ts
 * @desc Which pools are due for packs (never gone; error always; rejected only when the input
 *       changed or on request; the rest when the hash differs), and the pack state after each
 *       kind of answer (the hash moves only on a definitive answer).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { emptyPackSync, type PackSync } from "@/schemas/pool";
import { emptySyncStates, needsSync, nextPackSync } from "@/utils/sync";

const OLD = "a".repeat(64);
const NEW = "b".repeat(64);
const NOW = new Date("2026-09-24T12:00:00.000Z");
const at = (state: PackSync["state"], inputHash: string | null = OLD): PackSync => ({
  ...emptyPackSync(),
  slug: state === null ? null : "Ab3_x-9QzP",
  state,
  inputHash,
});

describe("needsSync", () => {
  it.each<[PackSync, string, boolean, boolean]>([
    [at(null, null), NEW, false, true],
    [at("created"), OLD, false, false],
    [at("unchanged"), NEW, false, true],
    [at("error"), OLD, false, true],
    [at("rejected"), OLD, false, false],
    [at("rejected"), OLD, true, true],
    [at("rejected"), NEW, false, true],
    [at("gone"), NEW, true, false],
  ])("%j with hash %s (resync rejected %s) is %s", (pack, hash, resyncRejected, due) => {
    expect(needsSync(pack, hash, { resyncRejected })).toBe(due);
  });
});

describe("nextPackSync", () => {
  const previous = { ...at("created"), listed: true, syncedAt: new Date(0) };

  it("stores an ok answer with the new hash", () => {
    expect(
      nextPackSync(
        previous,
        { kind: "ok", slug: "Zz9_x-9QzP", state: "updated", listed: false },
        NEW,
        NOW,
      ),
    ).toEqual({
      slug: "Zz9_x-9QzP",
      state: "updated",
      listed: false,
      inputHash: NEW,
      syncedAt: NOW,
      error: null,
    });
  });

  it("stores a rejection with packs' message and the hash it was for", () => {
    expect(
      nextPackSync(previous, { kind: "rejected", status: 400, message: "Bad name." }, NEW, NOW),
    ).toEqual({
      ...previous,
      state: "rejected",
      inputHash: NEW,
      syncedAt: NOW,
      error: "packs refused it (400): Bad name.",
    });
  });

  it("marks gone unlisted and keeps the old hash", () => {
    expect(nextPackSync(previous, { kind: "gone" }, NEW, NOW)).toEqual({
      ...previous,
      state: "gone",
      listed: false,
      syncedAt: NOW,
      error: null,
    });
  });

  it("keeps the last definitive answer's hash and time on an error", () => {
    expect(
      nextPackSync(
        previous,
        { kind: "error", message: "packs answered 502.", retryAfterMs: null },
        NEW,
        NOW,
      ),
    ).toEqual({ ...previous, state: "error", error: "packs answered 502." });
  });

  it("counts nothing yet", () => {
    expect(emptySyncStates()).toEqual({
      created: 0,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      error: 0,
      gone: 0,
    });
  });
});
