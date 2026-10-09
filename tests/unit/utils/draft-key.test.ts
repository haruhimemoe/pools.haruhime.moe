/**
 * @file tests/unit/utils/draft-key.test.ts
 * @desc /new#<pack key>: a draft read from the hash (with or without "#", or a whole /k link),
 *       and null for anything that isn't a readable key.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { draftFromHash } from "@/utils/draft-key";

const slots = [
  { mod: "NM", index: 1, beatmapId: 129891 },
  { mod: "TB", index: 1, beatmapId: 75 },
];
const key = encodePackKey({ name: "peppy's draft pool", slots });

describe("draftFromHash", () => {
  it("reads a key with or without the hash mark", () => {
    const draft = { key, name: "peppy's draft pool", slots };
    expect(draftFromHash(`#${key}`)).toEqual(draft);
    expect(draftFromHash(key)).toEqual(draft);
  });

  it.each(["", "#", "#nope", "#pk1.!!!"])("is null for %j", (hash) =>
    expect(draftFromHash(hash)).toBeNull(),
  );
});
