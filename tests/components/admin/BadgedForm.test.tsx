/**
 * @file tests/components/admin/BadgedForm.test.tsx
 * @desc The badged form sets every pool of the tournament, for this pool's year or every year.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BadgedForm } from "@/components/admin/BadgedForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

describe("BadgedForm", () => {
  it("sends the tournament key, the year choice and the value", async () => {
    const fetchMock = vi.fn(async () => Response.json({ matched: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BadgedForm tournamentKey="spring-cup" year={2020} />);
    await user.selectOptions(screen.getByLabelText("Which pools"), "all");
    await user.selectOptions(screen.getByLabelText("Badged"), "yes");
    await user.click(screen.getByRole("button", { name: "Set badged" }));
    expect(await screen.findByText("Set 3 pools.")).toBeInTheDocument();
    const [, init] = (fetchMock.mock.calls[0] ?? []) as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      tournamentKey: "spring-cup",
      year: "all",
      badged: true,
    });
  });
});
