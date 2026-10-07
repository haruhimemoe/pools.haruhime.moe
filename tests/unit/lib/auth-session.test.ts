/**
 * @file tests/unit/lib/auth-session.test.ts
 * @desc Session helpers for server pages: hubSignInHref builds the hub's osu! sign-in URL
 *       (HUB_URL, default www.haruhime.moe, /api/signin/osu) coming back to a safe absolute pools
 *       URL, never to another host; requireUser sends a signed-out visitor there and back; requireAdmin does the same for a signed-out visitor, and 404s a signed-in user who
 *       isn't an admin (admin pages never admit they exist to them).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserFromHeaders, redirect, notFound } = vi.hoisted(() => ({
  getUserFromHeaders: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect ${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/auth", () => ({ getUserFromHeaders }));

const { requireAdmin, requireUser, getCurrentUser, hubSignInHref } = await import(
  "@/lib/auth-session"
);

const HUB = "https://www.haruhime.moe/api/signin/osu?next=";
const back = (path: string) =>
  `redirect ${HUB}${encodeURIComponent(`https://pools.haruhime.moe${path}`)}`;

const USER = { id: "u1", osuId: 2, username: "peppy", avatarUrl: null, isAdmin: false };

beforeEach(() => {
  getUserFromHeaders.mockReset();
  vi.stubEnv("HUB_URL", undefined);
});

describe("hubSignInHref", () => {
  it("goes to the hub's osu! sign-in, back to the pools path", () => {
    expect(hubSignInHref("/pools/b-a0000001/edit?x=1")).toBe(
      `${HUB}${encodeURIComponent("https://pools.haruhime.moe/pools/b-a0000001/edit?x=1")}`,
    );
  });

  it("falls back to /account for a missing or unsafe next, never another host", () => {
    const fallback = `${HUB}${encodeURIComponent("https://pools.haruhime.moe/account")}`;
    expect(hubSignInHref(null)).toBe(fallback);
    expect(hubSignInHref("https://evil.test/x")).toBe(fallback);
    expect(hubSignInHref("//evil.test/x")).toBe(fallback);
  });

  it("uses HUB_URL", () => {
    vi.stubEnv("HUB_URL", "https://hub.example.com");
    expect(hubSignInHref("/new")).toMatch(/^https:\/\/hub\.example\.com\/api\/signin\/osu\?next=/);
  });
});

describe("auth-session", () => {
  it("reads the current user", async () => {
    getUserFromHeaders.mockResolvedValue(USER);
    expect(await getCurrentUser()).toEqual(USER);
  });

  it("requireUser sends a visitor to sign in, and hands back a user", async () => {
    getUserFromHeaders.mockResolvedValue(null);
    await expect(requireUser("/account")).rejects.toThrow(back("/account"));
    getUserFromHeaders.mockResolvedValue(USER);
    expect(await requireUser("/account")).toEqual(USER);
  });

  it("requireAdmin sends a visitor to sign in and 404s a user who isn't an admin", async () => {
    getUserFromHeaders.mockResolvedValue(null);
    await expect(requireAdmin("/admin")).rejects.toThrow(back("/admin"));
    getUserFromHeaders.mockResolvedValue(USER);
    await expect(requireAdmin("/admin")).rejects.toThrow("not found");
    getUserFromHeaders.mockResolvedValue({ ...USER, isAdmin: true });
    expect(await requireAdmin("/admin")).toEqual({
      id: "u1",
      osuId: 2,
      username: "peppy",
      avatarUrl: null,
    });
  });
});
