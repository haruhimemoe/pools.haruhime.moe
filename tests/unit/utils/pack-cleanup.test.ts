/**
 * @file tests/unit/utils/pack-cleanup.test.ts
 * @desc When a pack removal packs couldn't do is tried again: 5 minutes after the first failure,
 *       doubling with each one, never more than 6 hours apart; and what the retry summary says.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { cleanupSummaryText, nextCleanupAt } from "@/utils/pack-cleanup";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const minutesAfter = (attempts: number) =>
  (nextCleanupAt(attempts, NOW).getTime() - NOW.getTime()) / 60_000;

describe("nextCleanupAt", () => {
  it("waits 5 minutes after the first failure, doubling after each", () => {
    expect([1, 2, 3, 4].map(minutesAfter)).toEqual([5, 10, 20, 40]);
  });

  it("never waits more than 6 hours, however many failures", () => {
    expect(minutesAfter(8)).toBe(360);
    expect(minutesAfter(500)).toBe(360);
  });

  it("reads 0 or less as the first failure", () => {
    expect(minutesAfter(0)).toBe(5);
    expect(minutesAfter(-3)).toBe(5);
  });
});

describe("cleanupSummaryText", () => {
  const base = { due: 0, removed: 0, failed: 0, kept: 0, remaining: 0, configError: null };

  it("says when nothing was waiting", () => {
    expect(cleanupSummaryText(base)).toBe("No pack removals were waiting.");
  });

  it("counts what was removed, kept and still failing", () => {
    expect(
      cleanupSummaryText({ ...base, due: 4, removed: 2, failed: 1, kept: 1, remaining: 1 }),
    ).toBe(
      "Removed 2 packs. 1 pool wanted its pack again, so it stays. 1 removal still fails; 1 waiting.",
    );
    expect(cleanupSummaryText({ ...base, due: 1, removed: 1 })).toBe("Removed 1 pack.");
    expect(cleanupSummaryText({ ...base, due: 2, kept: 2 })).toBe(
      "2 pools wanted their packs again, so they stay.",
    );
  });

  it("says why nothing was tried when packs isn't set up", () => {
    expect(cleanupSummaryText({ ...base, due: 2, remaining: 2, configError: "no token." })).toBe(
      "Nothing tried: no token. 2 waiting.",
    );
  });
});
