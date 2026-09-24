/**
 * @file tests/components/admin/PoolEditForm.test.tsx
 * @desc The pool edit form sends the fields as JSON (an empty year as unknown), then says what
 *       happened to the pack, and shows the route's error when the save is refused. A field follows
 *       its stored value after a refresh (the tournament-wide badged form saving on the same page),
 *       so the next save never sends a stale badged back, while unsaved typing and the save message
 *       stay.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoolEditForm } from "@/components/admin/PoolEditForm";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const FIELDS = {
  tournament: "Spring Cup",
  round: "Finals",
  year: 2020,
  notes: "",
  hidden: false,
  badged: null,
};

describe("PoolEditForm", () => {
  it("sends the fields and says the pack was updated", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ pool: {}, sync: { status: "sent", state: "updated", error: null } }),
    );
    const user = userEvent.setup();
    render(<PoolEditForm poolId="otdb-1" initial={FIELDS} />);
    await user.clear(screen.getByLabelText("Year"));
    await user.click(screen.getByLabelText("Hidden"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved. packs updated the pack.")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/admin/pools/otdb-1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ ...FIELDS, year: null, hidden: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a failed PUT and a refused save", async () => {
    fetchMock.mockImplementationOnce(async () =>
      Response.json({
        pool: {},
        sync: { status: "sent", state: "error", error: "packs answered 502." },
      }),
    );
    const user = userEvent.setup();
    render(<PoolEditForm poolId="otdb-1" initial={FIELDS} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        "Saved, but packs didn't take the update: packs answered 502. Retry from /admin.",
      ),
    ).toBeInTheDocument();
    fetchMock.mockImplementationOnce(async () =>
      Response.json(
        { error: { code: "bad_request", message: "The tournament needs a name." } },
        { status: 400 },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The tournament needs a name.")).toBeInTheDocument();
  });
  it("takes a badged the tournament-wide form saved, so the next save doesn't undo it", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ pool: {}, sync: { status: "not-needed" } }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<PoolEditForm poolId="otdb-1" initial={FIELDS} />);
    await user.clear(screen.getByLabelText("Round"));
    await user.type(screen.getByLabelText("Round"), "Semifinals");
    rerender(<PoolEditForm poolId="otdb-1" initial={{ ...FIELDS, badged: true }} />);
    expect(screen.getByLabelText("Badged tournament")).toHaveValue("yes");
    expect(screen.getByLabelText("Round")).toHaveValue("Semifinals");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved. The pack didn't need an update.")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      ...FIELDS,
      round: "Semifinals",
      badged: true,
    });
  });

  it("keeps the save message when the refresh brings the saved values back", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ pool: {}, sync: { status: "sent", state: "updated", error: null } }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<PoolEditForm poolId="otdb-1" initial={FIELDS} />);
    await user.clear(screen.getByLabelText("Tournament"));
    await user.type(screen.getByLabelText("Tournament"), "  Autumn Cup ");
    await user.selectOptions(screen.getByLabelText("Badged tournament"), "no");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved. packs updated the pack.")).toBeInTheDocument();
    rerender(
      <PoolEditForm
        poolId="otdb-1"
        initial={{ ...FIELDS, tournament: "Autumn Cup", badged: false }}
      />,
    );
    expect(screen.getByText("Saved. packs updated the pack.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tournament")).toHaveValue("Autumn Cup");
    expect(screen.getByLabelText("Badged tournament")).toHaveValue("no");
  });
});
