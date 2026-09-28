/**
 * @file tests/unit/utils/built-record.test.ts
 * @desc A built pool's search fields: folded name, tournament and round as search text, the
 *       folded name to sort by, and its map count.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { builtSearchFields } from "@/utils/built-record";

describe("builtSearchFields", () => {
  it("folds the text and counts the maps", () => {
    expect(
      builtSearchFields({ name: "Café Cup", tournament: "ＯＷＣ", round: "", slots: [1, 2] }),
    ).toEqual({ searchText: "cafe cup\nowc", sortName: "cafe cup", mapCount: 2 });
  });
});
