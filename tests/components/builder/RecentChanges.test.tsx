/**
 * @file tests/components/builder/RecentChanges.test.tsx
 * @desc Recent changes in the editor: the activity log's entries with who and when, asked for
 *       on opening and again after a saved change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientPool } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.clearAllMocks());

const card = () =>
  screen.getByRole("heading", { name: "Recent changes" }).closest("section") as HTMLElement;

describe("Recent changes", () => {
  it("lists who changed what, and asks again after a save", async () => {
    const { api, user, saved } = renderEditor(clientPool());
    await waitFor(() => expect(api.activityCalls).toHaveLength(1));
    expect(await within(card()).findByText("No changes yet.")).toBeInTheDocument();
    api.activity = [
      {
        id: "1",
        at: new Date().toISOString(),
        osuId: 10,
        username: "owner",
        kind: "remove",
        summary: "Removed beatmap 30 from NM3",
      },
    ];
    await user.click(screen.getByRole("button", { name: "Remove NM3" }));
    await saved();
    expect(await within(card()).findByText("Removed beatmap 30 from NM3")).toBeInTheDocument();
    expect(within(card()).getByText("owner")).toBeInTheDocument();
    expect(within(card()).getByText("just now")).toBeInTheDocument();
    expect(api.activityCalls[0]).toBe("/api/pools/b-a0000001/activity");
  });
});
