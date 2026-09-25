/**
 * @file tests/components/admin/RefreshPagesButton.test.tsx
 * @desc The refresh button asks for every public page to be rebuilt and says whether it worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshPagesButton } from "@/components/admin/RefreshPagesButton";

afterEach(() => vi.unstubAllGlobals());

describe("RefreshPagesButton", () => {
  it("asks for a refresh and says the pages rebuild on their next visit", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RefreshPagesButton />);
    await user.click(screen.getByRole("button", { name: "Refresh public pages" }));
    expect(
      await screen.findByText("Done. Each public page rebuilds on its next visit."),
    ).toBeInTheDocument();
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0] ?? [];
    expect(url).toBe("/api/admin/revalidate");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({});
  });

  it("says when the refresh failed", async () => {
    vi.stubGlobal("fetch", async () => Response.json({}, { status: 503 }));
    const user = userEvent.setup();
    render(<RefreshPagesButton />);
    await user.click(screen.getByRole("button", { name: "Refresh public pages" }));
    expect(await screen.findByText("The refresh failed (503).")).toBeInTheDocument();
    vi.stubGlobal("fetch", async () => Promise.reject(new TypeError("offline")));
    await user.click(screen.getByRole("button", { name: "Refresh public pages" }));
    expect(await screen.findByText("The refresh didn't reach the server.")).toBeInTheDocument();
  });
});
