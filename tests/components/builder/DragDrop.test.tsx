/**
 * @file tests/components/builder/DragDrop.test.tsx
 * @desc Dragging slots in the editor with ui's sortable lists: a keyboard drag onto another row
 *       takes its place and onto another bucket goes to its end (each a moveMap); a touch drag
 *       does the same; a pool that changed mid-drag still moves the map picked up (found by
 *       beatmap id); a cancelled touch or keyboard drag leaves nothing behind; a drop where it
 *       started sends nothing, and the handle is a named button beside Up, Down and Move.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keyboardDrag, live } from "../../helpers/keyboard-drag";
import { clientPool, nm } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const grip = (label: string) => screen.getByRole("button", { name: `Reorder ${label}` });
const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls
    .filter((call) => call.path.endsWith("/ops"))
    .map((call) => (call.body as { ops: unknown[] }).ops);

/** NM's list and its three rows, 30px each from the top; everything else off screen. */
const layout = () => {
  const boxes: Record<string, [number, number]> = {
    "b:NM": [0, 100],
    "pick:10": [0, 30],
    "pick:20": [30, 60],
    "pick:30": [60, 90],
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function box(
    this: Element,
  ) {
    const key =
      this.getAttribute("data-sortable-container") ?? this.getAttribute("data-sortable-item") ?? "";
    const [top, bottom] = boxes[key] ?? [-1000, -1000];
    return {
      top,
      bottom,
      left: 0,
      right: 400,
      x: 0,
      y: top,
      width: 400,
      height: bottom - top,
      toJSON: () => ({}),
    } as DOMRect;
  });
};
const touch = (x: number, y: number) => ({
  pointerType: "touch",
  pointerId: 1,
  isPrimary: true,
  button: 0,
  clientX: x,
  clientY: y,
});

describe("drag and drop", () => {
  it("moves a slot onto another row's place, and onto another bucket's end", async () => {
    const { api, user, order, saved } = renderEditor();
    await keyboardDrag(user, "Reorder NM3", "NM3: onto NM1.");
    expect(order()).toEqual([30, 10, 20]);
    await saved();
    await keyboardDrag(user, "Reorder NM2", "NM2: end of HD.");
    expect(order()).toEqual([30, 20]);
    expect(order("HD")).toEqual([10]);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "moveMap", slot: { bucket: "NM", index: 3 }, bucket: "NM", index: 1 }],
      [{ type: "moveMap", slot: { bucket: "NM", index: 2 }, bucket: "HD" }],
    ]);
  });

  it("moves with a touch drag", async () => {
    const { order, saved } = renderEditor();
    layout();
    fireEvent.pointerDown(grip("NM1"), touch(5, 5));
    fireEvent.pointerMove(grip("NM1"), touch(5, 40));
    fireEvent.pointerUp(grip("NM1"), touch(5, 40));
    expect(order()).toEqual([20, 10, 30]);
    await saved();
  });

  it("moves the map it picked up even when the pool changed during the drag", async () => {
    const { api, user, order, saved } = renderEditor();
    grip("NM3").focus();
    await user.keyboard(" ");
    // Someone else's change arrives mid-drag: 10 goes, so 30 is NM2 now.
    api.pool = clientPool({ version: 2, slots: [nm(1, 20), nm(2, 30)] });
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(order()).toEqual([20, 30]));
    await user.keyboard("{PageDown}");
    expect(live()).toHaveTextContent("end of HD.");
    await user.keyboard("{Enter}");
    expect(order()).toEqual([20]);
    expect(order("HD")).toEqual([30]);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "moveMap", slot: { bucket: "NM", index: 2 }, bucket: "HD" }],
    ]);
  });

  it("leaves nothing behind for a cancelled touch drag or keyboard drag", async () => {
    const { api, user, container } = renderEditor();
    const leftover = () =>
      container.querySelectorAll("[data-sortable-state], [data-sortable-drop]").length;
    layout();
    fireEvent.pointerDown(grip("NM1"), touch(5, 5));
    fireEvent.pointerMove(grip("NM1"), touch(5, 40));
    expect(leftover()).toBeGreaterThan(0);
    fireEvent.pointerCancel(grip("NM1"), touch(5, 40));
    expect(leftover()).toBe(0);
    grip("NM2").focus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}");
    expect(leftover()).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(leftover()).toBe(0);
    expect(api.calls).toEqual([]);
  });

  it("sends nothing for a drop where it started, and keeps the buttons", async () => {
    const { api, user } = renderEditor();
    grip("NM2").focus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(api.calls).toEqual([]);
    expect(live()).toHaveTextContent("Cancelled. NM2 is back at position 2 of 3 in NM.");
    expect(screen.getByRole("button", { name: "Move NM2 up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move NM2" })).toBeInTheDocument();
    expect(grip("NM2")).not.toHaveAttribute("aria-hidden");
  });
});
