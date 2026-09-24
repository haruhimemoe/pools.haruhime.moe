/**
 * @file tests/components/admin/RetrySyncButtons.test.tsx
 * @desc The retry buttons send failed pools (and rejected ones with the second button) and say
 *       what was sent and what's left, or why nothing was.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetrySyncButtons } from "@/components/admin/RetrySyncButtons";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

const STATES = { created: 0, updated: 2, unchanged: 0, rejected: 0, error: 1, gone: 0 };

describe("RetrySyncButtons", () => {
  it("retries failed syncs, then rejected ones too", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ due: 60, sent: 3, states: STATES, remaining: 57, configError: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RetrySyncButtons />);
    await user.click(screen.getByRole("button", { name: "Retry failed syncs" }));
    expect(
      await screen.findByText("Sent 3: 2 updated, 1 error. 57 still due."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry failed and rejected" }));
    const bodies = (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([, init]) =>
      JSON.parse(String(init.body)),
    );
    expect(bodies).toEqual([{ includeRejected: false }, { includeRejected: true }]);
  });

  it("says why nothing was sent", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        due: 2,
        sent: 0,
        states: STATES,
        remaining: 2,
        configError: "POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
      }),
    );
    const user = userEvent.setup();
    render(<RetrySyncButtons />);
    await user.click(screen.getByRole("button", { name: "Retry failed syncs" }));
    expect(
      await screen.findByText(
        "Nothing sent: POOLS_SERVICE_TOKEN isn't set, so the pack wasn't updated.",
      ),
    ).toBeInTheDocument();
  });
});
