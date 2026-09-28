/**
 * @file tests/unit/utils/pool-links.test.ts
 * @desc "Start from this pool" links to /new with the pool's id, escaped.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { startFromHref } from "@/utils/pool-links";

describe("startFromHref", () => {
  it("links /new with the pool to start from", () => {
    expect(startFromHref("otdb-12")).toBe("/new?from=otdb-12");
    expect(startFromHref("b-a0000001")).toBe("/new?from=b-a0000001");
    expect(startFromHref("a b")).toBe("/new?from=a%20b");
  });
});
