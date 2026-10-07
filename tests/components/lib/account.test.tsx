/**
 * @file tests/components/lib/account.test.tsx
 * @desc pools' wiring of next-kit's account store over the hub session: the marker is the shared
 *       `haruhime-signed-in` cookie, a page without it never asks GET /api/session, and one with
 *       it asks once; signOutHere posts to /api/signout and throws when pools refuses.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

const setCookie = (value: string) => {
  // biome-ignore lint/suspicious/noDocumentCookie: the test sets the marker as the hub does
  document.cookie = value;
};
const clearCookie = () => setCookie("haruhime-signed-in=; Path=/; Max-Age=0");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  clearCookie();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("signedInMarker", () => {
  it("reads the shared haruhime cookie, not pools' old one", async () => {
    const { signedInMarker } = await import("@/lib/account");
    expect(signedInMarker.has("haruhime-signed-in=1")).toBe(true);
    expect(signedInMarker.has("pools-signed-in=1")).toBe(false);
  });
});

describe("useAccount", () => {
  const Who = ({ use }: { use: () => { status: string } }) => <p>{use().status}</p>;

  it("never asks for the session without the marker", async () => {
    const { useAccount } = await import("@/lib/account");
    render(<Who use={useAccount} />);
    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks GET /api/session once with the marker", async () => {
    setCookie("haruhime-signed-in=1; Path=/");
    fetchMock.mockResolvedValue(
      Response.json({ user: { id: "u1", username: "peppy", avatarUrl: null } }),
    );
    const { useAccount } = await import("@/lib/account");
    render(<Who use={useAccount} />);
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/session");
  });
});

describe("signOutHere", () => {
  it("posts to /api/signout", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { signOutHere } = await import("@/lib/account");
    await signOutHere();
    expect(fetchMock).toHaveBeenCalledWith("/api/signout", { method: "POST", cache: "no-store" });
  });

  it("throws when pools refuses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const { signOutHere } = await import("@/lib/account");
    await expect(signOutHere()).rejects.toThrow("signout 403");
  });
});
