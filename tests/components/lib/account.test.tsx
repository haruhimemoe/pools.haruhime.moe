/**
 * @file tests/components/lib/account.test.tsx
 * @desc pools' wiring of next-kit's account store: the marker is pools' own cookie, a page
 *       without it never asks for the session, and one with it asks once.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { getSession } }));

const setCookie = (value: string) => {
  // biome-ignore lint/suspicious/noDocumentCookie: the test sets the marker as the server does
  document.cookie = value;
};
const clearCookie = () => setCookie("pools-signed-in=; Path=/; Max-Age=0");

afterEach(() => {
  clearCookie();
  getSession.mockReset();
  vi.resetModules();
});

describe("signedInMarker", () => {
  it("reads pools' own cookie", async () => {
    const { signedInMarker } = await import("@/lib/account");
    expect(signedInMarker.has("pools-signed-in=1")).toBe(true);
    expect(signedInMarker.has("packs-signed-in=1")).toBe(false);
  });
});

describe("useAccount", () => {
  const Who = ({ use }: { use: () => { status: string } }) => <p>{use().status}</p>;

  it("never asks for the session without the marker", async () => {
    const { useAccount } = await import("@/lib/account");
    render(<Who use={useAccount} />);
    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("asks once with the marker", async () => {
    setCookie("pools-signed-in=1; Path=/");
    getSession.mockResolvedValue({ data: { user: { id: "u1", username: "peppy" } } });
    const { useAccount } = await import("@/lib/account");
    render(<Who use={useAccount} />);
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
