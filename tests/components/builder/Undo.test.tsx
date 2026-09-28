/**
 * @file tests/components/builder/Undo.test.tsx
 * @desc Undo in the editor: the button puts back this session's last change by sending its
 *       inverse with the current version (a removed map comes back at its slot with its note),
 *       step by step, with no redo; Ctrl+Z does the same unless focus is in a text field; a 409
 *       on the undo drops that step with a notice and reloads the pool; someone else's change,
 *       from a poll or a 409, ends the history, while a newer version with the same content
 *       (a visibility change) keeps it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNDO_DROPPED } from "@/constants/editor";
import { clientPool, nm } from "../../helpers/pool-editor";
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

  it("never undoes over someone else's change that the poll brought in", async () => {
    const { api, user, order, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Move NM1 down" }));
    await saved();
    expect(undoButton()).toBeEnabled();
    // Someone else removes a map: our step's inverse names slots by place, so it'd move theirs.
    api.pool = clientPool({ version: 3, slots: [nm(1, 20), nm(2, 30)] });
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(order()).toEqual([20, 30]));
    expect(undoButton()).toBeDisabled();
  });

  it("keeps the history when a newer version changed nothing in the pool's content", async () => {
    const { api, user, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Move NM1 down" }));
    await saved();
    api.pool = { ...api.pool, version: api.pool.version + 1, visibility: "unlisted" };
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(screen.getByRole("radio", { name: /unlisted/i })).toBeChecked());
    expect(undoButton()).toBeEnabled();
    await user.click(undoButton());
    await saved();
    expect(opsOf(api.calls).at(-1)).toMatchObject({ baseVersion: 3 });
  });

  it("ends the history when a change meets someone else's (409)", async () => {
    const { api, user, saved } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Move NM1 down" }));
    await saved();
    const theirs = clientPool({ version: 5, slots: [nm(1, 99)] });
    api.next(() =>
      Response.json({ error: { code: "conflict", message: "x" }, pool: theirs }, { status: 409 }),
    );
    await user.click(screen.getByRole("button", { name: "Remove NM1" }));
    await waitFor(() => expect(api.pool.version).toBe(2));
    expect(await screen.findByText(/Someone else changed this pool/)).toBeInTheDocument();
    expect(undoButton()).toBeDisabled();
  });
});
