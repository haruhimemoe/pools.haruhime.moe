/**
 * @file tests/components/builder/Undo.test.tsx
 * @desc Undo in the editor: the button puts back this session's last change by sending its
 *       inverse with the current version (a removed map comes back at its slot with its note),
 *       step by step, with no redo; Ctrl+Z does the same unless focus is in a text field; a 409
 *       on the undo drops that step with a notice and reloads the pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNDO_DROPPED } from "@/hooks/usePoolEditor";
import { clientPool } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.clearAllMocks());

const undoButton = () => screen.getByRole("button", { name: "Undo" });
const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls.filter((call) => call.path.endsWith("/ops")).map((call) => call.body);

describe("Undo", () => {
  it("puts back the last change with its inverse, step by step, and has no redo", async () => {
    const { api, user, order, saved } = renderEditor(clientPool({ slotNotes: { 20: "jump aim" } }));
    expect(undoButton()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove NM2" }));
    await saved();
    expect(order()).toEqual([10, 30]);
    await user.click(undoButton());
    expect(order()).toEqual([10, 20, 30]);
    expect(screen.getByText("jump aim")).toBeInTheDocument();
    await saved();
    expect(opsOf(api.calls).at(-1)).toEqual({
      baseVersion: 2,
      ops: [
        { type: "addMap", beatmapId: 20, bucket: "NM", index: 2 },
        { type: "setNote", beatmapId: 20, note: "jump aim" },
      ],
    });
    expect(undoButton()).toBeDisabled();
  });

  it("undoes with Ctrl+Z, but not while typing in a field", async () => {
    const { user, order, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Move NM1 down" }));
    await saved();
    await user.click(screen.getByRole("textbox", { name: "Paste maps" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(order()).toEqual([20, 10, 30]);
    await user.click(screen.getByRole("heading", { name: "Maps" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(order()).toEqual([10, 20, 30]);
  });

  it("drops the step with a notice when the pool changed under it", async () => {
    const { api, user, order, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Remove NM3" }));
    await saved();
    const theirs = clientPool({ version: 5, slots: [{ mod: "NM", index: 1, beatmapId: 99 }] });
    api.next(() =>
      Response.json({ error: { code: "conflict", message: "x" }, pool: theirs }, { status: 409 }),
    );
    await user.click(undoButton());
    expect(await screen.findByText(UNDO_DROPPED)).toBeInTheDocument();
    expect(order()).toEqual([99]);
    expect(undoButton()).toBeDisabled();
  });
});
