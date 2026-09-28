/**
 * @file src/hooks/useSlotDrag.ts
 * @desc Dragging slots in the editor, with no library: a mouse drags a row's handle with native
 *       HTML drag events, and touch or a pen drags it with pointer events (the handle takes the
 *       pointer, and the drop target is whatever row or bucket is under the finger). Rows and
 *       buckets are drop targets through their data attributes (src/utils/drag-move.ts). The
 *       hook says which map is being dragged and which target is under it, for the styles, and
 *       hands the drop to the editor. The Up, Down and Move buttons stay the keyboard's way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { PoolSlot } from "@haruhimemoe/pool";
import { type DragEvent, type PointerEvent, useRef, useState } from "react";
import { type DropTarget, readDropTarget } from "@/utils/drag-move";

const targetAt = (x: number, y: number): DropTarget | null =>
  readDropTarget(document.elementFromPoint?.(x, y)?.closest("[data-drop-bucket]") ?? null);

const targetOf = (element: Element): DropTarget | null =>
  readDropTarget(element.closest("[data-drop-bucket]"));

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a?.bucket === b?.bucket && a?.index === b?.index;

export type SlotDrag = ReturnType<typeof useSlotDrag>;

/**
 * @function useSlotDrag
 * @param onDrop {(slot: PoolSlot, target: DropTarget) => void} what a drop does
 * @returns the dragged map, the target under it, and props for handles and drop targets
 */
export const useSlotDrag = (onDrop: (slot: PoolSlot, target: DropTarget) => void) => {
  const dragged = useRef<PoolSlot | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const start = (slot: PoolSlot) => {
    dragged.current = slot;
    setDragging(slot.beatmapId);
  };
  const end = () => {
    dragged.current = null;
    setDragging(null);
    setOver(null);
  };
  const hover = (target: DropTarget | null) =>
    setOver((was) => (sameTarget(was, target) ? was : target));
  const drop = (target: DropTarget | null) => {
    const slot = dragged.current;
    end();
    if (slot && target) onDrop(slot, target);
  };

  const handle = (slot: PoolSlot) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.dataTransfer?.setData("text/plain", String(slot.beatmapId));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      start(slot);
    },
    onDragEnd: end,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      start(slot);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" && dragged.current)
        hover(targetAt(event.clientX, event.clientY));
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" && dragged.current)
        drop(targetAt(event.clientX, event.clientY));
    },
    onPointerCancel: end,
  });

  const target = () => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!dragged.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      hover(targetOf(event.currentTarget));
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!dragged.current) return;
      event.preventDefault();
      event.stopPropagation();
      drop(targetOf(event.currentTarget));
    },
  });

  return { dragging, over, handle, target };
};
