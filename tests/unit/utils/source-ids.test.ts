/**
 * @file tests/unit/utils/source-ids.test.ts
 * @desc Generated source ids (host and community pools): 8 base36 characters starting with a
 *       letter, so they never sort among otdb's numeric ids; uniform over the alphabet from
 *       random bytes (bytes past the last whole alphabet are drawn again); a new id skips any
 *       taken one (stored or former source, or its pool id) and gives up after too many tries.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { describe, expect, it } from "vitest";
import { isSourceId, newSourceId, SOURCE_ID_PATTERN, uniqueSourceId } from "@/utils/source-ids";

/** Random bytes that come from a list, in order, then repeat it. */
const bytesFrom = (values: readonly number[]) => {
  let at = 0;
  return (length: number): Uint8Array =>
    Uint8Array.from({ length }, () => values[at++ % values.length] ?? 0);
};

describe("SOURCE_ID_PATTERN", () => {
  it.each(["a0000000", "hz9y8x7w", "zzzzzzzz"])("takes %s", (id) => {
    expect(isSourceId(id)).toBe(true);
  });

  it.each(["12345678", "0abcdefg", "Habcdefg", "habcdef", "habcdefgh", "h-bcdefg", ""])(
    "refuses %j",
    (id) => {
      expect(SOURCE_ID_PATTERN.test(id)).toBe(false);
    },
  );
});

describe("newSourceId", () => {
  it("starts with a letter and uses base36 after it", () => {
    // 0 is "a" as a first letter, then "0"; 35 is "z".
    expect(newSourceId(bytesFrom([0, 0, 35, 1, 10, 2, 3, 4]))).toBe("a0z1a234");
  });

  it("draws again for bytes past the last whole alphabet", () => {
    // 26 * 9 = 234 and 36 * 7 = 252: bytes at or past those are dropped.
    expect(newSourceId(bytesFrom([234, 255, 25, 252, 253, 7, 7, 7, 7, 7, 7, 7]))).toBe("z7777777");
  });

  it("makes ids that match the pattern from real random bytes", () => {
    for (let i = 0; i < 200; i++) expect(isSourceId(newSourceId())).toBe(true);
  });
});

describe("uniqueSourceId", () => {
  it("skips ids that are taken", () => {
    const random = bytesFrom([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    const taken = new Set(["a0000000"]);
    expect(uniqueSourceId((id) => taken.has(id), random)).toBe("b0000000");
  });

  it("gives up when every try is taken", () => {
    expect(() => uniqueSourceId(() => true, bytesFrom([0]))).toThrow(/free source id/);
  });
});
