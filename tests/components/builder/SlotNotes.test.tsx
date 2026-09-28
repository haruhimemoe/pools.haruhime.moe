/**
 * @file tests/components/builder/SlotNotes.test.tsx
 * @desc Notes on slots: added in the editor as setNote (Enter or Save), edited and cleared, a
 *       note the checks refuse said under its field with nothing sent, Escape leaving it as it
 *       was, and the pool's page showing each note under its map.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuiltSlotList } from "@/components/builder/BuiltSlotList";
import { clientPool, mapsFor } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.clearAllMocks());

const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls.filter((call) => call.path.endsWith("/ops")).map((call) => call.body);

describe("notes in the editor", () => {
  it("adds a note as setNote and shows it under the map", async () => {
    const { api, user, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Add note to NM1" }));
    await user.type(screen.getByRole("textbox", { name: "Note for NM1" }), "jump aim check{Enter}");
    expect(screen.getByText("jump aim check")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit note for NM1" })).toHaveFocus();
    await saved();
    expect(opsOf(api.calls)).toEqual([
      { baseVersion: 1, ops: [{ type: "setNote", beatmapId: 10, note: "jump aim check" }] },
    ]);
  });

  it("clears a note, and Escape leaves it as it was", async () => {
    const { api, user, saved } = renderEditor(
      clientPool({ slotNotes: { 20: "replace if ranked late" } }),
    );
    expect(screen.getByText("replace if ranked late")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit note for NM2" }));
    await user.keyboard("{Escape}");
    expect(api.calls).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Edit note for NM2" }));
    await user.clear(screen.getByRole("textbox", { name: "Note for NM2" }));
    await user.click(screen.getByRole("button", { name: "Save note for NM2" }));
    expect(screen.queryByText("replace if ranked late")).toBeNull();
    await saved();
    expect(opsOf(api.calls)).toEqual([
      { baseVersion: 1, ops: [{ type: "setNote", beatmapId: 20, note: "" }] },
    ]);
  });

  it("says what's wrong with a note and sends nothing", async () => {
    const { api, user } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Add note to NM1" }));
    await user.type(screen.getByRole("textbox", { name: "Note for NM1" }), "retard map{Enter}");
    expect(screen.getByText("That fails the content filter.")).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});

describe("notes on the pool's page", () => {
  it("shows each note under its map", () => {
    const pool = clientPool({ slotNotes: { 30: "tiebreaker backup" } });
    render(<BuiltSlotList pool={pool} maps={mapsFor([10, 20, 30])} values={{}} />);
    const row = screen.getByText("tiebreaker backup").closest("li");
    expect(row).toHaveTextContent("NM3");
  });
});
