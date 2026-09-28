/**
 * @file tests/unit/utils/add-pool-text.test.ts
 * @desc What the add-a-pool form says: added, joined (and revived), already credited, and each
 *       thing that can happen to the pack.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { type AddPoolAnswer, outcomeText, syncText } from "@/utils/add-pool-text";

const answer = (over: Partial<AddPoolAnswer> = {}): AddPoolAnswer => ({
  outcome: "created",
  revived: false,
  alreadyCredited: false,
  pool: { id: "host-a1234567", name: "Cup", href: "/pools/host-a1234567" },
  sync: { status: "not-needed" },
  ...over,
});

describe("syncText", () => {
  it.each([
    [{ status: "not-needed" } as const, "Its pack didn't need an update."],
    [{ status: "failed", message: "down" } as const, "The pack wasn't sent: down"],
    [
      { status: "sent", state: "error", error: null } as const,
      "packs didn't take the pack: no answer",
    ],
    [{ status: "sent", state: "rejected", error: "bad" } as const, "packs refused the pack: bad"],
    [{ status: "sent", state: "created", error: null } as const, "packs made its pack."],
    [{ status: "sent", state: "updated", error: null } as const, "packs updated its pack."],
  ])("says %j", (sync, text) => {
    expect(syncText(sync)).toBe(text);
  });
});

describe("outcomeText", () => {
  it("says a pool was added, with its pack", () => {
    expect(outcomeText(answer())).toEqual({
      before: "Added ",
      after: ". Its pack didn't need an update.",
    });
  });

  it("says the source joined a pool, back from superseded", () => {
    expect(outcomeText(answer({ outcome: "merged", revived: true })).after).toMatch(
      /^, so the source joined it and it's back from superseded\./,
    );
  });

  it("says nothing was added when the pool already credits the sender", () => {
    expect(outcomeText(answer({ outcome: "merged", alreadyCredited: true })).after).toContain(
      "so nothing was added",
    );
  });
});
