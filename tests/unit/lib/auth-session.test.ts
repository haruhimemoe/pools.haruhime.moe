/**
 * @file tests/unit/lib/auth-session.test.ts
 * @desc Session helpers for server pages: requireUser sends a signed-out visitor to sign in and
 *       back; requireAdmin does the same for a signed-out visitor, and 404s a signed-in user who
 *       isn't an admin (admin pages never admit they exist to them).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
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

const { requireAdmin, requireUser, getCurrentUser } = await import("@/lib/auth-session");

const USER = { id: "u1", osuId: 2, username: "peppy", avatarUrl: null, isAdmin: false };

beforeEach(() => {
  getUserFromHeaders.mockReset();
});

describe("auth-session", () => {
  it("reads the current user", async () => {
    getUserFromHeaders.mockResolvedValue(USER);
    expect(await getCurrentUser()).toEqual(USER);
  });

  it("requireUser sends a visitor to sign in, and hands back a user", async () => {
    getUserFromHeaders.mockResolvedValue(null);
    await expect(requireUser("/account")).rejects.toThrow("redirect /signin?next=%2Faccount");
    getUserFromHeaders.mockResolvedValue(USER);
    expect(await requireUser("/account")).toEqual(USER);
  });

  it("requireAdmin sends a visitor to sign in and 404s a user who isn't an admin", async () => {
    getUserFromHeaders.mockResolvedValue(null);
    await expect(requireAdmin("/admin")).rejects.toThrow("redirect /signin?next=%2Fadmin");
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
