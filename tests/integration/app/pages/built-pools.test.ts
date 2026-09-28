/**
 * @file tests/integration/app/pages/built-pools.test.ts
 * @desc The builder's pages over a real (in-memory) database, with the session from a mocked
 *       next/headers: /pools/<id>/edit opens for the owner (with the owner's settings) and an
 *       editor (without), sends a visitor to sign in, and 404s everyone else, admins included;
 *       /pools/built/<id> (what /pools/<b- id> is rewritten to) shows a pool to whoever can see
 *       it, with Edit only for its owner and editors, 404s the rest, and keeps private, unlisted
 *       and hidden pools out of search engines.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { ADMIN_OSU_ID } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { type Cast, createCast, insertPool } from "../../../helpers/pool-requests";

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
beforeEach(() => {
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
    expect(metadata.robots).toEqual({ index: false });
    expect(metadata.alternates?.canonical).toBe(`/pools/${ID}`);
  });

  it("shows unlisted and public pools to anyone, indexing only public ones", async () => {
    const cast = await createCast();
    await insertPool(cast, { visibility: "unlisted" });
    as(cast, "visitor");
    const unlisted = await builtPage();
    expect(unlisted.html).toContain("Spring Cup Finals");
    expect(unlisted.html).not.toContain(`/pools/${ID}/edit`);
    expect(unlisted.metadata.robots).toEqual({ index: false });
    await (await builtPoolsCollection()).updateOne({ _id: ID }, { $set: { visibility: "public" } });
    const listed = await builtPage();
    expect(listed.metadata.robots).toBeUndefined();
    expect(listed.metadata.title).toBe("Spring Cup Finals");
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
    expect(html).toContain("Moderators hid this pool.");
    expect(html).not.toContain(`/pools/${ID}/edit`);
    expect(metadata.robots).toEqual({ index: false });
    as(cast, "visitor");
    expect(await thrown(() => builtPage("b-zzzzzzzz"))).toBe("404");
    expect(await thrown(() => builtPage("otdb-1"))).toBe("404");
  });
});
