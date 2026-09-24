/**
 * @file tests/unit/app/admin-pages.test.ts
 * @desc Admin pages ask for an admin (sign-in returns to the page asked for); /admin shows the
 *       sync-state counts and the import reports; /admin/pools lists every pool, reading a bad
 *       show or page as the defaults; the pool preview shows hidden pools (the public page 404s
 *       them) and 404s an unknown id; and nothing under /admin is indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makePool } from "../../helpers/records";

const {
  requireAdmin,
  getPoolById,
  getMapSummaries,
  listPoolsForAdmin,
  countSyncStates,
  listImportReports,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({
    id: "u1",
    osuId: 12231334,
    username: "admin",
    avatarUrl: null,
  })),
  getPoolById: vi.fn(),
  getMapSummaries: vi.fn(async () => new Map()),
  listPoolsForAdmin: vi.fn(),
  countSyncStates: vi.fn(),
  listImportReports: vi.fn(async () => []),
}));
vi.mock("@/lib/auth-session", () => ({ requireAdmin }));
vi.mock("@/services/pools", () => ({ getPoolById, getMapSummaries }));
vi.mock("@/services/admin", () => ({
  ADMIN_SHOWS: ["all", "hidden", "superseded", "failed"],
  listPoolsForAdmin,
  countSyncStates,
}));
vi.mock("@/services/imports", () => ({ listImportReports }));
// The sign-out button pulls in the better-auth browser client, which this page test doesn't need.
vi.mock("@/components/auth/SignOutButton", () => ({ SignOutButton: () => null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("admin pages", () => {
  it("shows the sync-state counts and the import reports on /admin", async () => {
    countSyncStates.mockResolvedValue({
      created: 3,
      updated: 0,
      unchanged: 0,
      rejected: 1,
      error: 2,
      gone: 0,
      never: 5,
    });
    const page = await import("@/app/admin/page");
    const html = renderToStaticMarkup(await page.default());
    expect(requireAdmin).toHaveBeenCalledWith("/admin");
    expect(html).toContain(
      "3 created · 0 updated · 0 unchanged · 1 rejected · 2 error · 0 gone · 5 never sent",
    );
    expect(html).toContain("No imports yet.");
    expect(page.metadata.robots).toEqual({ index: false });
  });

  it("lists every pool on /admin/pools, reading a bad show or page as the defaults", async () => {
    listPoolsForAdmin.mockResolvedValue({
      rows: [makePool({ _id: "otdb-7", name: "Hidden Cup 2021 Finals", hidden: true })],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    const page = await import("@/app/admin/pools/page");
    const element = await page.default({
      searchParams: Promise.resolve({ q: "  (20k ", show: "bogus", page: "abc" }),
    } as never);
    expect(requireAdmin).toHaveBeenCalledWith("/admin/pools");
    expect(listPoolsForAdmin).toHaveBeenCalledWith({ q: "(20k", show: "all", page: 1 });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("otdb-7");
    expect(html).toContain(">hidden</td>");
    expect(page.metadata.robots).toEqual({ index: false });
  });

  it("previews a hidden pool for an admin", async () => {
    getPoolById.mockResolvedValue(makePool({ _id: "otdb-1", hidden: true }));
    const page = await import("@/app/admin/pools/[id]/page");
    const element = await page.default({ params: Promise.resolve({ id: "otdb-1" }) } as never);
    expect(requireAdmin).toHaveBeenCalledWith("/admin/pools/otdb-1");
    expect(renderToStaticMarkup(element)).toContain(
      "This pool is hidden. Only admins see this preview.",
    );
    expect(page.metadata.robots).toEqual({ index: false });
  });

  it("404s an unknown pool", async () => {
    getPoolById.mockResolvedValue(null);
    const page = await import("@/app/admin/pools/[id]/page");
    await expect(
      page.default({ params: Promise.resolve({ id: "otdb-9" }) } as never),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });
});
