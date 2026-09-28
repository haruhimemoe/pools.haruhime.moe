/**
 * @file tests/unit/config/rewrites.test.ts
 * @desc /pools/<b- id> is served by the built pool page (it reads the session), before the
 *       cookie-free ISR page for past pools could take it; nothing else is rewritten, so
 *       /pools/<b- id>/edit and past pools keep their own routes (checked with Next's own path
 *       matcher).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("rewrites", () => {
  it("sends built pools' pages to /pools/built/[id], ahead of the file routes", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual({
      beforeFiles: [{ source: "/pools/:id(b-[^/]+)", destination: "/pools/built/:id" }],
      afterFiles: [],
      fallback: [],
    });
  });

  it("matches a built pool's page, and not past pools, the editor or the target itself", () => {
    const match = getPathMatch("/pools/:id(b-[^/]+)");
    expect(match("/pools/b-a0000001")).toEqual({ id: "b-a0000001" });
    for (const path of [
      "/pools/otdb-657",
      "/pools/host-a1b2c3d4",
      "/pools/b-a0000001/edit",
      "/pools/built/b-a0000001",
    ]) {
      expect(match(path)).toBe(false);
    }
  });
});
