/**
 * @file tests/components/builder/DragDrop.test.tsx
 * @desc Dragging slots in the editor, with fired events: a native drag from a row's handle onto
 *       another row takes its place, onto another bucket goes to its end (each a moveMap); a
 *       touch drag (pointer events on the handle) does the same; dropping where it started sends
 *       nothing; the Up, Down and Move buttons are still there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("sends nothing for a drop where it started, and keeps the buttons", () => {
    const { api } = renderEditor();
    drag(20, row(20));
    expect(api.calls).toEqual([]);
    expect(screen.getByRole("button", { name: "Move NM2 up" })).toBeInTheDocument();
    expect(handle(20)).toHaveAttribute("aria-hidden", "true");
  });
});
