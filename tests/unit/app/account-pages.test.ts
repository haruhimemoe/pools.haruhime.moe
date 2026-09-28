/**
 * @file tests/unit/app/account-pages.test.ts
 * @desc /signin says signing in is for making pools (anyone with an osu! account), explains an
 *       error code, and sends a signed-in visitor on to `next` through the browser; /account
 *       asks for sign-in, then shows the osu! name and avatar and the delete form. Neither is
 *       indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, requireUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/auth-session", () => ({ getCurrentUser, requireUser }));
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
  requireUser.mockReset();
});

describe("/signin", () => {
  it("says signing in is for making pools, and isn't indexed", async () => {
    getCurrentUser.mockResolvedValue(null);
    const html = await signInHtml({ next: "/account" });
    expect(html).toContain("Sign in with your osu! account to make pools.");
    expect(html).toContain("Sign in with osu!");
    expect(html).not.toContain("admin");
    expect((await import("@/app/signin/page")).metadata.robots).toEqual({ index: false });
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
    const page = await import("@/app/account/page");
    const html = renderToStaticMarkup(await page.default());
    expect(requireUser).toHaveBeenCalledWith("/account");
    expect(html).toContain("peppy");
    expect(html).toMatch(/src="[^"]*a\.ppy\.sh(%2F|\/)2/);
    expect(html).toContain("Delete my account");
    expect(page.metadata.robots).toEqual({ index: false });
  });
});
