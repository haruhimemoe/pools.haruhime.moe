/**
 * @file tests/unit/config/rewrites.test.ts
 * @desc /pools/<b- id> is served by the built pool page (it reads the session), before the
 *       cookie-free ISR page for past pools could take it; nothing else is rewritten, so
 *       /pools/<b- id>/edit and past pools keep their own routes (checked with Next's own path
 *       matcher). The internal path /pools/built/<id> isn't reachable directly: a request for it
 *       is redirected (308) to /pools/<id>. Redirects match the incoming path before any rewrite,
 *       and the rewrite's source never matches the internal path, so there's no loop.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

import { contentRewrites } from "@haruhimemoe/next-kit/docs";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("redirects", () => {
  it("sends the internal /pools/built/<id> to /pools/<id> for good (308)", async () => {
    expect(await nextConfig.redirects?.()).toEqual([
      { source: "/pools/built/:id", destination: "/pools/:id", permanent: true },
    ]);
  });

  it("matches only the internal path, never a pool's own page or the editor", () => {
    const match = getPathMatch("/pools/built/:id");
    expect(match("/pools/built/b-a0000001")).toEqual({ id: "b-a0000001" });
    for (const path of ["/pools/b-a0000001", "/pools/otdb-657", "/pools/b-a0000001/edit"]) {
      expect(match(path)).toBe(false);
    }
    // What the redirect sends people to is a built pool's page, which the rewrite then serves.
    expect(getPathMatch("/pools/:id(b-[^/]+)")("/pools/b-a0000001")).toEqual({ id: "b-a0000001" });
  });
});

describe("rewrites", () => {
  it("sends built pools' pages to /pools/built/[id], ahead of the file routes", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual({
      beforeFiles: [{ source: "/pools/:id(b-[^/]+)", destination: "/pools/built/:id" }],
      afterFiles: contentRewrites(),
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
