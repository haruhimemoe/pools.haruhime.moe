/**
 * @file tests/unit/utils/built-record.test.ts
 * @desc A built pool's search fields: folded name, tournament and round as search text, the
 *       folded name to sort by, and its map count; a row read without them (written before they
 *       were stored) gets them computed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { builtSearchFields, builtSearchFieldsOf } from "@/utils/built-record";

describe("builtSearchFields", () => {
  it("folds the text and counts the maps", () => {
    expect(
      builtSearchFields({ name: "Café Cup", tournament: "ＯＷＣ", round: "", slots: [1, 2] }),
    ).toEqual({ searchText: "cafe cup\nowc", sortName: "cafe cup", mapCount: 2 });
  });
});

describe("builtSearchFieldsOf", () => {
  const row = { name: "Café Cup", tournament: "", round: "", slots: [1, 2, 3] };

  it("keeps what the row stores", () => {
    const stored = { searchText: "kept", sortName: "kept", mapCount: 9 };
    expect(builtSearchFieldsOf({ ...row, ...stored })).toEqual(stored);
  });

  it("computes what a row written before the fields lacks", () => {
    expect(builtSearchFieldsOf(row)).toEqual({
      searchText: "cafe cup",
      sortName: "cafe cup",
      mapCount: 3,
    });
    expect(builtSearchFieldsOf({ ...row, slots: undefined }).mapCount).toBe(0);
  });
});
