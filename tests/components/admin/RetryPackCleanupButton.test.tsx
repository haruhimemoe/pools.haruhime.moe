/**
 * @file tests/components/admin/RetryPackCleanupButton.test.tsx
 * @desc "Retry pack cleanup" posts an empty object and says what it did, why nothing was tried,
 *       or that it failed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetryPackCleanupButton } from "@/components/admin/RetryPackCleanupButton";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

const click = async () => {
  const user = userEvent.setup();
  render(<RetryPackCleanupButton />);
  await user.click(screen.getByRole("button", { name: "Retry pack cleanup" }));
};

describe("RetryPackCleanupButton", () => {
  it("posts an empty object and says what was removed", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ due: 2, removed: 2, failed: 0, kept: 0, remaining: 0, configError: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await click();
    expect(await screen.findByText("Removed 2 packs.")).toBeInTheDocument();
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0] ?? [];
    expect(url).toBe("/api/admin/pack-cleanup");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("{}");
  });

  it("says when the retry failed or didn't reach the server", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    await click();
    expect(await screen.findByText("The retry failed (500).")).toBeInTheDocument();
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry pack cleanup" }));
    expect(await screen.findByText("The retry didn't reach the server.")).toBeInTheDocument();
  });
});
