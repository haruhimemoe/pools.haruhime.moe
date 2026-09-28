/**
 * @file tests/components/builder/DragDrop.test.tsx
 * @desc Dragging slots in the editor, with fired events: a native drag from a row's handle onto
 *       another row takes its place, onto another bucket goes to its end (each a moveMap); a
 *       touch drag (pointer events on the handle) does the same; dropping where it started sends
 *       nothing; a pool that changed mid-drag still moves the map picked up (found by beatmap id);
 *       a cancelled touch drag or a drop outside leaves no state behind; the Up, Down and Move
 *       buttons are still there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientPool, nm } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const row = (id: number) => document.querySelector(`li[data-map="${id}"]`) as HTMLElement;
const handle = (id: number) => row(id).querySelector("[data-drag-handle]") as HTMLElement;
const bucket = (code: string) => document.querySelector(`[data-bucket="${code}"]`) as HTMLElement;
const transfer = () => ({ setData: vi.fn(), effectAllowed: "", dropEffect: "" });
const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls
    .filter((call) => call.path.endsWith("/ops"))
    .map((call) => (call.body as { ops: unknown[] }).ops);

const drag = (id: number, onto: HTMLElement) => {
  const dataTransfer = transfer();
  fireEvent.dragStart(handle(id), { dataTransfer });
  fireEvent.dragOver(onto, { dataTransfer });
  fireEvent.drop(onto, { dataTransfer });
  fireEvent.dragEnd(handle(id), { dataTransfer });
};

describe("drag and drop", () => {
  it("moves a slot onto another row's place, and onto another bucket's end", async () => {
    const { api, order, saved } = renderEditor();
    drag(30, row(10));
    expect(order()).toEqual([30, 10, 20]);
    await saved();
    drag(10, bucket("HD"));
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
    const target = row(20);
    document.elementFromPoint = vi.fn(() => target) as typeof document.elementFromPoint;
    fireEvent.pointerDown(handle(10), {
      pointerType: "touch",
      pointerId: 1,
      clientX: 5,
      clientY: 5,
    });
    fireEvent.pointerMove(handle(10), {
      pointerType: "touch",
      pointerId: 1,
      clientX: 5,
      clientY: 40,
    });
    fireEvent.pointerUp(handle(10), {
      pointerType: "touch",
      pointerId: 1,
      clientX: 5,
      clientY: 40,
    });
    expect(order()).toEqual([20, 10, 30]);
    await saved();
  });

  it("moves the map it picked up even when the pool changed during the drag", async () => {
    const { api, order, saved } = renderEditor();
    const dataTransfer = transfer();
    fireEvent.dragStart(handle(30), { dataTransfer });
    // Someone else's change arrives mid-drag: 10 goes, so 30 is NM2 now.
    api.pool = clientPool({ version: 2, slots: [nm(1, 20), nm(2, 30)] });
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(order()).toEqual([20, 30]));
    fireEvent.dragOver(bucket("HD"), { dataTransfer });
    fireEvent.drop(bucket("HD"), { dataTransfer });
    fireEvent.dragEnd(handle(30), { dataTransfer });
    expect(order()).toEqual([20]);
    expect(order("HD")).toEqual([30]);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "moveMap", slot: { bucket: "NM", index: 2 }, bucket: "HD" }],
    ]);
  });

  it("leaves nothing behind for a touch drag cancelled or a drag dropped outside", () => {
    const { api, container } = renderEditor();
    const leftover = () => container.querySelectorAll(".opacity-50, .border-t-2").length;
    const touch = { pointerType: "touch", pointerId: 1, clientX: 5, clientY: 40 };
    document.elementFromPoint = vi.fn(() => row(20)) as typeof document.elementFromPoint;
    fireEvent.pointerDown(handle(10), touch);
    fireEvent.pointerMove(handle(10), touch);
    expect(leftover()).toBeGreaterThan(0);
    fireEvent.pointerCancel(handle(10), touch);
    expect(leftover()).toBe(0);
    const dataTransfer = transfer();
    fireEvent.dragStart(handle(10), { dataTransfer });
    fireEvent.dragOver(row(30), { dataTransfer });
    expect(leftover()).toBeGreaterThan(0);
    fireEvent.dragEnd(handle(10), { dataTransfer });
    expect(leftover()).toBe(0);
    expect(api.calls).toEqual([]);
  });

  it("sends nothing for a drop where it started, and keeps the buttons", () => {
    const { api } = renderEditor();
    drag(20, row(20));
    expect(api.calls).toEqual([]);
    expect(screen.getByRole("button", { name: "Move NM2 up" })).toBeInTheDocument();
    expect(handle(20)).toHaveAttribute("aria-hidden", "true");
  });
});
