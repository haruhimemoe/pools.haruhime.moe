/**
 * @file src/components/builder/EmptySlotRow.tsx
 * @desc A slot in the editor with candidates and no pick: its label, a line saying so, and its
 *       candidate list (open). The row is a drop target: a candidate of the bucket dropped on it
 *       becomes the pick. It counts for nothing at the pool level (targets, summary, export,
 *       packs): only picks do. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { cx, ModBadge } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import type { SlotDrag } from "@/hooks/useSlotDrag";

type EmptySlotRowProps = {
  place: { bucket: string; index: number };
  /** Its label ("NM4"). */
  label: string;
  drag?: SlotDrag | undefined;
  /** Its candidate list. */
  children: ReactNode;
};

/**
 * @function EmptySlotRow
 * @param props {EmptySlotRowProps} the slot, its label, dragging and its candidate list
 * @returns {JSX.Element} the slot as a list item, as a drop target
 */
export function EmptySlotRow({ place, label, drag, children }: EmptySlotRowProps) {
  const over =
    drag?.over?.bucket === place.bucket &&
    drag.over.index === place.index &&
    drag.over.zone === undefined;
  return (
    <li
      data-empty-slot={label}
      data-drop-bucket={place.bucket}
      data-drop-index={place.index}
      {...drag?.target()}
      className={cx(
        "flex flex-col gap-2 border-t py-3",
        over ? "border-h1 border-t-2" : "border-b3",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="w-5 shrink-0" />
        <span className="w-14 shrink-0">
          <ModBadge mod={label} />
        </span>
        <p className="text-c3 text-sm">No pick yet. Promote a candidate or drop one here.</p>
      </div>
      {children}
    </li>
  );
}
