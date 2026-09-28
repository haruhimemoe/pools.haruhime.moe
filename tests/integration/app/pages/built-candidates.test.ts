/**
 * @file tests/integration/app/pages/built-candidates.test.ts
 * @desc Candidates on the builder's pages, over a real (in-memory) database with the session from
 *       a mocked next/headers: the editor shows them to the owner and editors; a built pool's
 *       page never does, public or unlisted, whoever is looking (its owner included), and
 *       neither does its description.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMirrorCooldown } from "@/lib/map-search";
import { mapsCollection } from "@/models/Map";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { candidate } from "../../../helpers/candidates";
import { setupTestDb } from "../../../helpers/db";
import { type Cast, createCast, insertPool } from "../../../helpers/pool-requests";
import { makeMap } from "../../../helpers/records";

const { session } = vi.hoisted(() => ({ session: { cookie: null as string | null } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(session.cookie ? { cookie: session.cookie } : {}),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

setupTestDb();
setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  session.cookie = null;
});

const ID = "b-a0000001";
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 100 }];
const CANDIDATES = { "NM:1": [candidate(101, { note: "secret backup" })] };

type Who = keyof Cast | "visitor";
const as = (cast: Cast, who: Who) => {
  session.cookie = who === "visitor" ? null : cast[who].cookie;
};

const setup = async (visibility: "public" | "unlisted") => {
  const cast = await createCast();
  await insertPool(cast, { visibility, slots: SLOTS, candidates: CANDIDATES });
  await (await mapsCollection()).insertMany([
    makeMap({ _id: 100, title: "Picked Song" }),
    makeMap({ _id: 101, title: "Candidate Song" }),
  ]);
  return cast;
};

describe("candidates on the pages", () => {
  it("shows them in the editor to the owner and editors", async () => {
    const cast = await setup("public");
    const page = await import("@/app/pools/[id]/edit/page");
    for (const who of ["owner", "editor"] as const) {
      as(cast, who);
      const element = await page.default({ params: Promise.resolve({ id: ID }) } as never);
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Candidate Song");
      expect(html).toContain("secret backup");
    }
  });

  it.each(["public", "unlisted"] as const)(
    "never shows them on a %s pool's page, to anyone",
    async (visibility) => {
      const cast = await setup(visibility);
      const page = await import("@/app/pools/built/[id]/page");
      for (const who of ["owner", "editor", "admin", "other", "visitor"] as const) {
        as(cast, who);
        const props = { params: Promise.resolve({ id: ID }) } as never;
        const html = renderToStaticMarkup(await page.default(props));
        const metadata = await page.generateMetadata(props);
        expect(html).toContain("Picked Song");
        expect(html).not.toContain("Candidate Song");
        expect(html).not.toContain("secret backup");
        expect(html).not.toMatch(/candidate/i);
        expect(JSON.stringify(metadata)).not.toContain("101");
      }
    },
  );
});
