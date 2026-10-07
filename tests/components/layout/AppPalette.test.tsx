/**
 * @file tests/components/layout/AppPalette.test.tsx
 * @desc AppPalette: opens on Ctrl K with the site's "Go to" rows and pools' own extras (New
 *       pool, Search maps), My pools and Sign out appear only once signed in, Sign out signs out
 *       in place (signOutHere, then the store and home), and the pools provider searches
 *       GET /api/search as the query changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Tue Oct 6, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/lib/account";

const push = vi.fn();
const navigationMock = { useRouter: () => ({ push }), usePathname: () => "/" };
vi.mock("next/navigation", () => navigationMock);
vi.mock("next/navigation.js", () => navigationMock);

const { useAccountMock, signOutHere, markSignedOut } = vi.hoisted(() => ({
  useAccountMock: vi.fn<() => Account>(() => ({ status: "signed-out" })),
  signOutHere: vi.fn().mockResolvedValue(undefined),
  markSignedOut: vi.fn(),
}));
vi.mock("@/lib/account", () => ({
  useAccount: useAccountMock,
  signOutHere,
  accountStore: { markSignedOut },
}));

const fetchMock = vi.fn<(input: string) => Promise<Response>>();

beforeEach(() => {
  push.mockClear();
  useAccountMock.mockReturnValue({ status: "signed-out" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const { AppPalette } = await import("@/components/layout/AppPalette");

const openWithHotkey = async () => {
  const user = userEvent.setup();
  render(<AppPalette />);
  await user.keyboard("{Control>}k{/Control}");
};

describe("AppPalette", () => {
  it("opens on Ctrl K with the site's navigate rows", async () => {
    await openWithHotkey();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Go to Home")).toBeInTheDocument();
    expect(screen.getByText("Go to Search")).toBeInTheDocument();
  });

  it("lists pools' own extras", async () => {
    await openWithHotkey();
    expect(await screen.findByText("New pool")).toBeInTheDocument();
    expect(screen.getByText("Search maps")).toBeInTheDocument();
  });

  it("hides My pools and Sign out while signed out", async () => {
    await openWithHotkey();
    await screen.findByText("New pool");
    expect(screen.queryByText("My pools")).toBeNull();
    expect(screen.queryByText("Sign out")).toBeNull();
    expect(screen.queryByText("Sign in")).not.toBeNull();
  });

  it("shows My pools and Sign out while signed in", async () => {
    useAccountMock.mockReturnValue({
      status: "signed-in",
      user: { id: "1", username: "peppy", avatarUrl: null },
    });
    await openWithHotkey();
    expect(await screen.findByText("My pools")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("signs out in place, tells the store and goes home", async () => {
    useAccountMock.mockReturnValue({
      status: "signed-in",
      user: { id: "1", username: "peppy", avatarUrl: null },
    });
    await openWithHotkey();
    await userEvent.click(await screen.findByText("Sign out"));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signOutHere).toHaveBeenCalledTimes(1);
    expect(markSignedOut).toHaveBeenCalledTimes(1);
  });

  it("searches public pools as the query changes", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        tab: "pools",
        page: 1,
        pageCount: 1,
        total: 1,
        hiddenMissing: 0,
        badgedKnown: true,
        results: [
          {
            kind: "past",
            builtBy: null,
            id: "owc2024",
            name: "OWC 2024",
            tournament: "OWC",
            round: "Grand Finals",
            year: 2024,
            badged: true,
            stats: { srMin: 4, srMax: 7, count: 16, complete: true },
          },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<AppPalette />);
    await user.keyboard("{Control>}k{/Control}");
    await user.type(await screen.findByRole("combobox"), "owc");
    expect(await screen.findByText("OWC 2024")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=owc", expect.anything());
  });
});
