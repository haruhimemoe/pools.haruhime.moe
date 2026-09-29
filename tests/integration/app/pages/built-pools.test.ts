/**
 * @file tests/integration/app/pages/built-pools.test.ts
 * @desc The builder's pages over a real (in-memory) database, with the session from a mocked
 *       next/headers: /pools/<id>/edit opens for the owner (with the owner's settings) and an
 *       editor (without), sends a visitor to sign in, and 404s everyone else, admins included;
 *       /pools/built/<id> (what /pools/<b- id> is rewritten to) shows a pool to whoever can see
 *       it, with Edit only for its owner and editors, 404s the rest, and keeps private, unlisted
 *       and hidden pools out of search engines. Both show each slot's values under its mods (the
 *       mirror stood in by msw; one it can't rate is asked for once, not on every load), and the
 *       summary's star range uses them. A pack shows "Download
 *       on packs" while there is one, a change waiting included; a waiting one syncs after
 *       either page loads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { setupMsw } from "@haruhimemoe/next-kit/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMirrorCooldown } from "@/lib/map-search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { mapsCollection } from "@/models/Map";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { afterTaskCount } from "../../../helpers/after";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { type Cast, createCast, insertPool } from "../../../helpers/pool-requests";
import { type BatchCall, ppBatchHandler, ppValues } from "../../../helpers/pp-batch";
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
const server = setupMsw();
beforeEach(() => {
  resetMirrorCooldown();
  vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
  session.cookie = null;
});

const ID = "b-a0000001";
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 100 }];

type Who = keyof Cast | "visitor";
const as = (cast: Cast, who: Who) => {
  session.cookie = who === "visitor" ? null : cast[who].cookie;
};

/** What a page threw: "404" for notFound(), the target for redirect(), or null. */
const thrown = async (render: () => Promise<unknown>): Promise<string | null> => {
  try {
    await render();
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.includes("404")) return "404";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "redirect";
    throw error;
  }
  return null;
};

const editPage = async (id = ID) => {
  const page = await import("@/app/pools/[id]/edit/page");
  const element = await page.default({ params: Promise.resolve({ id }) } as never);
  return renderToStaticMarkup(element);
};

const builtPage = async (id = ID) => {
  const page = await import("@/app/pools/built/[id]/page");
  const props = { params: Promise.resolve({ id }) } as never;
  const metadata = await page.generateMetadata(props);
  return { html: renderToStaticMarkup(await page.default(props)), metadata };
};

describe("/pools/<id>/edit", () => {
  it("opens for the owner with the owner's settings, and for an editor without them", async () => {
    const cast = await createCast();
    await insertPool(cast, { slots: SLOTS });
    as(cast, "owner");
    const owner = await editPage();
    expect(owner).toContain("You own this pool.");
    expect(owner).toContain("Owner settings");
    expect(owner).toContain("Spring Cup Finals");
    as(cast, "editor");
    const editor = await editPage();
    expect(editor).toContain("You edit this pool.");
    expect(editor).not.toContain("Owner settings");
    expect(editor).toContain("Leave this pool");
    expect((await import("@/app/pools/[id]/edit/page")).metadata.robots).toEqual({ index: false });
  });

  it("404s everyone else, admins included, and sends a visitor to sign in", async () => {
    const cast = await createCast();
    await insertPool(cast, { visibility: "public" });
    for (const who of ["other", "admin"] as const) {
      as(cast, who);
      expect(await thrown(() => editPage())).toBe("404");
    }
    as(cast, "owner");
    expect(await thrown(() => editPage("b-zzzzzzzz"))).toBe("404");
    expect(await thrown(() => editPage("otdb-1"))).toBe("404");
    as(cast, "visitor");
    expect(await thrown(() => editPage())).toBe("/signin?next=%2Fpools%2Fb-a0000001%2Fedit");
  });
});

describe("/pools/<b- id>", () => {
  it("shows a private pool only to its owner and editors, never indexed", async () => {
    const cast = await createCast();
    await insertPool(cast, { slots: SLOTS });
    for (const who of ["visitor", "other", "admin"] as const) {
      as(cast, who);
      expect(await thrown(() => builtPage())).toBe("404");
    }
    as(cast, "editor");
    const { html, metadata } = await builtPage();
    expect(html).toContain("Built by");
    expect(html).toContain('href="https://osu.ppy.sh/users/10"');
    expect(html).toContain('href="https://osu.ppy.sh/users/20"');
    expect(html).toContain(`href="/pools/${ID}/edit"`);
    expect(html).toContain("Beatmap 100");
    expect(html).toContain("Check against the content rules");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(`https://pools.haruhime.moe/pools/${ID}`);
    expect(html).not.toContain("application/ld+json");
  });

  it("shows unlisted and public pools to anyone, indexing only public ones", async () => {
    const cast = await createCast();
    await insertPool(cast, { visibility: "unlisted" });
    as(cast, "visitor");
    const unlisted = await builtPage();
    expect(unlisted.html).toContain("Spring Cup Finals");
    expect(unlisted.html).not.toContain(`/pools/${ID}/edit`);
    expect(unlisted.html).toContain(`href="/new?from=${ID}"`);
    expect(unlisted.metadata.robots).toEqual({ index: false, follow: true });
    expect(unlisted.html).not.toContain("application/ld+json");
    await (await builtPoolsCollection()).updateOne({ _id: ID }, { $set: { visibility: "public" } });
    const listed = await builtPage();
    expect(listed.metadata.robots).toBeUndefined();
    expect(listed.metadata.title).toEqual({ absolute: "Spring Cup Finals · pools.haruhime.moe" });
    expect(listed.html).toContain('"@type":"BreadcrumbList"');
  });

  it("404s a hidden pool for everyone but its owner, editors and admins", async () => {
    const cast = await createCast();
    await insertPool(cast, { visibility: "public", hidden: true });
    for (const who of ["visitor", "other"] as const) {
      as(cast, who);
      expect(await thrown(() => builtPage())).toBe("404");
    }
    as(cast, "admin");
    const { html, metadata } = await builtPage();
    expect(html).toContain("Hidden by moderation.");
    expect(html).not.toContain(`/pools/${ID}/edit`);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(html).not.toContain("application/ld+json");
    as(cast, "visitor");
    expect(await thrown(() => builtPage("b-zzzzzzzz"))).toBe("404");
    expect(await thrown(() => builtPage("otdb-1"))).toBe("404");
  });
});

describe("values under each slot's mods", () => {
  it("shows them on the pool's page and in its editor, and ranges the stars with them", async () => {
    const cast = await createCast();
    const slots = [
      { mod: "NM", index: 1, beatmapId: 100 },
      { mod: "DT", index: 1, beatmapId: 200 },
    ];
    await insertPool(cast, { _id: ID, visibility: "public", slots });
    await (await mapsCollection()).insertMany([makeMap({ _id: 100 }), makeMap({ _id: 200 })]);
    server.use(ppBatchHandler(() => ppValues({ stars: 7.25, ar: 10.33, od: 9.78 })));
    as(cast, "other");
    const { html } = await builtPage();
    expect(html).toContain("5.50★ no mod · AR 9 · OD 8 · 2:00 · 180 BPM");
    expect(html).toContain("7.25★ DT · AR 10.3 · OD 9.8 · 1:20 · 270 BPM");
    expect(html).toMatch(/DT<\/dt><dd[^>]*>7\.25★/);
    as(cast, "owner");
    expect(await editPage()).toContain("7.25★ DT");
  });

  it("asks the mirror once, not on every load, for a map it can't rate", async () => {
    const cast = await createCast();
    const slots = [{ mod: "DT", index: 1, beatmapId: 200 }];
    await insertPool(cast, { _id: ID, visibility: "public", slots });
    await (await mapsCollection()).insertOne(makeMap({ _id: 200 }));
    const calls: BatchCall[] = [];
    server.use(ppBatchHandler(() => undefined, calls));
    as(cast, "visitor");
    for (let load = 0; load < 3; load++) {
      expect((await builtPage()).html).toContain("no mod data");
    }
    expect(calls).toHaveLength(1);
  });
});

describe("the pool's pack on its pages", () => {
  const synced = { ...EMPTY_BUILT_PACK, state: "synced" as const, slug: "Abc123", listed: true };

  it("shows Download on packs while there's a pack, a waiting change too, never before", async () => {
    const cast = await createCast();
    await insertPool(cast, { visibility: "public", slots: SLOTS, pack: synced });
    as(cast, "visitor");
    const link = 'href="https://packs.haruhime.moe/p/Abc123"';
    expect((await builtPage()).html).toContain(link);
    expect(afterTaskCount()).toBe(0);
    const pools = await builtPoolsCollection();
    await pools.updateOne({ _id: ID }, { $set: { "pack.state": "pending" } });
    expect((await builtPage()).html).toContain(link);
    await pools.updateOne({ _id: ID }, { $set: { pack: EMPTY_BUILT_PACK } });
    expect((await builtPage()).html).not.toContain("Download on packs");
  });

  it("syncs a waiting pack after the pool's page or its editor loads", async () => {
    const cast = await createCast();
    const pending = { ...EMPTY_BUILT_PACK, state: "pending" as const };
    await insertPool(cast, { visibility: "public", slots: SLOTS, pack: pending });
    as(cast, "visitor");
    await builtPage();
    expect(afterTaskCount()).toBe(1);
    as(cast, "owner");
    await editPage();
    expect(afterTaskCount()).toBe(2);
  });
});
