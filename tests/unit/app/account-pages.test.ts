/**
 * @file tests/unit/app/account-pages.test.ts
 * @desc /signin says signing in is for making pools (anyone with an osu! account), explains an
 *       error code, and sends a signed-in visitor on to `next` through the browser; /account
 *       asks for sign-in, then shows the osu! name and avatar, how many pools they own and edit
 *       with each one listed under Your pools (#pools, each linking its page and editor, and
 *       Make a pool), and the delete form; /new asks a visitor to sign in and come back (with
 *       the pool to start from), shows a signed-in user the form, filled in from ?from=<id>
 *       when that pool is there to copy. None is indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, requireUser, listBuiltPoolsFor, startPreview } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireUser: vi.fn(),
  listBuiltPoolsFor: vi.fn(),
  startPreview: vi.fn(),
}));
vi.mock("@/lib/auth-session", () => ({ getCurrentUser, requireUser }));
vi.mock("@/services/built-pools", () => ({ listBuiltPoolsFor }));
vi.mock("@/services/built-pool-create", () => ({ startPreview }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const USER = {
  id: "u1",
  osuId: 2,
  username: "peppy",
  avatarUrl: "https://a.ppy.sh/2",
  isAdmin: false,
};

const signInHtml = async (params: Record<string, string>) => {
  const page = await import("@/app/signin/page");
  const element = await page.default({
    searchParams: Promise.resolve(params),
  } as unknown as PageProps<"/signin">);
  return renderToStaticMarkup(element);
};

beforeEach(() => {
  getCurrentUser.mockReset();
  startPreview.mockReset();
  requireUser.mockReset();
});

describe("/signin", () => {
  it("says signing in is for making pools, and isn't indexed", async () => {
    getCurrentUser.mockResolvedValue(null);
    const html = await signInHtml({ next: "/account" });
    expect(html).toContain("Sign in with your osu! account to make pools.");
    expect(html).toContain("Sign in with osu!");
    expect(html).not.toContain("admin");
    expect((await import("@/app/signin/page")).metadata.robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it("explains an error code", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await signInHtml({ error: "access_denied" })).toContain(
      "Sign-in was cancelled on osu!. Try again when you&#x27;re ready.",
    );
  });

  it("sends a signed-in visitor on through the browser", async () => {
    getCurrentUser.mockResolvedValue(USER);
    expect(await signInHtml({ next: "/account" })).toContain("Signing you in…");
  });
});

describe("/account", () => {
  it("asks for sign-in, then shows the osu! name, avatar and the delete form", async () => {
    requireUser.mockResolvedValue(USER);
    listBuiltPoolsFor.mockResolvedValue({ owned: [], editing: [] });
    const page = await import("@/app/account/page");
    const html = renderToStaticMarkup(await page.default());
    expect(requireUser).toHaveBeenCalledWith("/account");
    expect(html).toContain("peppy");
    expect(html).toMatch(/src="[^"]*a\.ppy\.sh(%2F|\/)2/);
    expect(html).toContain("Delete my account");
    expect(page.metadata.robots).toEqual({ index: false, follow: true });
    expect(html).toContain('id="pools"');
    expect(html).toContain("You haven&#x27;t made a pool yet.");
  });

  it("counts and lists the pools they own and edit", async () => {
    requireUser.mockResolvedValue(USER);
    const item = (id: string, name: string, visibility: string, maps: number) => ({
      id,
      name,
      visibility,
      maps,
      updatedAt: new Date("2026-09-27T12:00:00Z"),
    });
    listBuiltPoolsFor.mockResolvedValue({
      owned: [
        item("b-a0000001", "Spring Cup", "public", 12),
        item("b-a0000002", "Draft", "private", 0),
      ],
      editing: [item("b-a0000003", "Their Cup", "unlisted", 1)],
    });
    const page = await import("@/app/account/page");
    const html = renderToStaticMarkup(await page.default());
    expect(listBuiltPoolsFor).toHaveBeenCalledWith(USER);
    expect(html).toContain("You own 2 pools and edit 1.");
    expect(html).toContain("Spring Cup");
    expect(html).toContain("public · 12 maps");
    expect(html).toContain("private · 0 maps");
    expect(html).toContain("Their Cup");
    expect(html).toContain("unlisted · 1 map");
    expect(html).toContain('href="/pools/b-a0000001"');
    expect(html).toContain('href="/pools/b-a0000003/edit"');
    expect(html).toContain('aria-label="Edit Their Cup"');
    expect(html).toContain('href="/new"');
  });
});

/** The first element in a rendered tree whose props match. */
const findProps = (node: unknown, match: (props: Record<string, unknown>) => boolean): unknown => {
  if (Array.isArray(node)) return node.map((child) => findProps(child, match)).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return undefined;
  const props = (node as { props: Record<string, unknown> }).props;
  return match(props) ? props : findProps(props.children, match);
};

describe("/new", () => {
  const newPage = async (params: Record<string, string> = {}) => {
    const page = await import("@/app/new/page");
    return page.default({ searchParams: Promise.resolve(params) } as PageProps<"/new">);
  };

  it("asks a visitor to sign in and come back to /new, keeping the pool to start from", async () => {
    getCurrentUser.mockResolvedValue(null);
    const element = await newPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Sign in first");
    expect(html).toContain("Sign in with osu!");
    expect(html).not.toContain("Make the pool");
    expect(findProps(element, (props) => props.next === "/new")).toBeDefined();
    const from = await newPage({ from: "otdb-9" });
    expect(findProps(from, (props) => props.next === "/new?from=otdb-9")).toBeDefined();
    expect(startPreview).not.toHaveBeenCalled();
    expect((await import("@/app/new/page")).metadata.robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it("shows a signed-in user the form", async () => {
    getCurrentUser.mockResolvedValue(USER);
    const html = renderToStaticMarkup(await newPage());
    expect(html).toContain("Make the pool");
    expect(html).toContain('id="new-name"');
    expect(html).not.toContain("Sign in with osu!");
  });

  it("fills the form from the pool to start from, or says it isn't there", async () => {
    getCurrentUser.mockResolvedValue(USER);
    startPreview.mockResolvedValueOnce({
      id: "otdb-9",
      name: "OWC 2023 Finals",
      tournament: "osu! World Cup",
      round: "Finals",
      year: 2023,
      maps: 12,
    });
    const html = renderToStaticMarkup(await newPage({ from: "otdb-9" }));
    expect(startPreview).toHaveBeenCalledWith("otdb-9", USER);
    expect(html).toContain("Start from a pool");
    expect(html).toContain("It starts with the 12 maps of OWC 2023 Finals.");
    expect(html).toContain('value="OWC 2023 Finals"');
    startPreview.mockResolvedValueOnce(null);
    const missing = renderToStaticMarkup(await newPage({ from: "otdb-404" }));
    expect(missing).toContain("That pool isn&#x27;t there to start from.");
    expect(missing).toContain('id="new-name"');
  });
});
