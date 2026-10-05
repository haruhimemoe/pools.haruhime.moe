/**
 * @file tests/components/admin/BuiltPoolModeration.test.tsx
 * @desc An admin's buttons on a built pool: Hide sends hidden true (Unhide false), refreshes
 *       the page and says so; Delete asks in a dialog first (focus on Cancel), Cancel
 *       backs out (focus back on Delete), "Delete for good" deletes and says when packs will
 *       remove the pack later, in the table's live region, which keeps the message and focus
 *       once the refreshed page drops the row; a failed delete is said in the dialog.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuiltModerationArea } from "@/components/admin/BuiltModerationArea";
import { BuiltPoolModeration } from "@/components/admin/BuiltPoolModeration";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

type Call = [string, RequestInit];

const area = (row: boolean, hidden = false) => (
  <BuiltModerationArea>
    {row ? <BuiltPoolModeration id="b-a0000001" name="Rude Cup" hidden={hidden} /> : null}
  </BuiltModerationArea>
);

const setup = (answer: () => Response, hidden = false) => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => answer());
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  const view = render(area(true, hidden));
  return { user, view, calls: () => fetchMock.mock.calls as unknown as Call[] };
};

describe("BuiltPoolModeration", () => {
  it("hides and unhides, and says so", async () => {
    const { user, calls } = setup(() => Response.json({ pool: {} }));
    await user.click(screen.getByRole("button", { name: "Hide Rude Cup" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(calls()[0]?.[0]).toBe("/api/admin/built-pools/b-a0000001");
    expect(calls()[0]?.[1]).toMatchObject({ method: "PATCH", body: '{"hidden":true}' });
    expect(screen.getByRole("status")).toHaveTextContent("Rude Cup is hidden.");
  });

  it("offers Unhide on a hidden pool", async () => {
    const { user, calls } = setup(() => Response.json({ pool: {} }), true);
    await user.click(screen.getByRole("button", { name: "Unhide Rude Cup" }));
    await waitFor(() => expect(calls()[0]?.[1]?.body).toBe('{"hidden":false}'));
  });

  it("asks before deleting, with focus on the question's buttons", async () => {
    const { user, calls } = setup(() => new Response(null, { status: 204 }));
    await user.click(screen.getByRole("button", { name: "Delete Rude Cup" }));
    const question = screen.getByRole("alertdialog", { name: "Delete Rude Cup for good?" });
    expect(within(question).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(calls()).toEqual([]);
    expect(screen.getByRole("button", { name: "Delete Rude Cup" })).toHaveFocus();
  });

  it("says a delete, and when packs removes the pack later, after the row is gone", async () => {
    const notice = "packs.haruhime.moe didn't answer, so the pack will be removed later.";
    const { user, view, calls } = setup(() => Response.json({ packRemoval: "queued", notice }));
    await user.click(screen.getByRole("button", { name: "Delete Rude Cup" }));
    await user.click(screen.getByRole("button", { name: "Delete for good" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(calls()[0]?.[1]?.method).toBe("DELETE");
    // The refreshed page no longer lists the pool: the message and focus stay put.
    view.rerender(area(false));
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(`Rude Cup is deleted. ${notice}`);
    expect(status).toHaveFocus();
  });

  it("says when it didn't work", async () => {
    const { user } = setup(() => new Response(null, { status: 500 }));
    await user.click(screen.getByRole("button", { name: "Hide Rude Cup" }));
    expect(await screen.findByText("That didn't work for Rude Cup (500).")).toBeInTheDocument();
  });

  it("keeps the dialog open with why when a delete fails", async () => {
    const { user } = setup(() => new Response(null, { status: 500 }));
    await user.click(screen.getByRole("button", { name: "Delete Rude Cup" }));
    await user.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "That didn't work for Rude Cup (500).",
    );
  });
});
