/**
 * @file src/components/builder/SlotRow.tsx
 * @desc One slot in the editor: its label, its cover and preview clip, its map, and buttons to move it up or down, move it to
 *       another bucket (a picker and a Move button, so arrow keys in the picker never move
 *       anything) and remove it, a badge when its stars sit outside the bucket's target, and its note. A handle drags it
 *       (mouse or touch) onto another row or bucket; it's hidden from screen readers, since the
 *       buttons do the same by keyboard.
 *       Every control names its slot for screen readers. Its map and
 *       controls sit side by side only once the maps card (a size container) is 48rem wide;
 *       narrower, on phones and in the desktop editor's pool column, they stack. The editor
 *       decides what each button does and where focus goes after.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import { Button, fieldClasses } from "@haruhimemoe/ui";
import { useState } from "react";
import { MapPreview } from "@/components/builder/MapPreview";
import { SlotMapText } from "@/components/builder/SlotMapText";
import { SlotNote } from "@/components/builder/SlotNote";
import type { SlotDrag } from "@/hooks/useSlotDrag";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { songOf } from "@/utils/map-preview";
import type { SlotValueAnswer } from "@/utils/slot-values";

export type MoveTarget = { code: string; label: string };

type SlotRowProps = {
  slot: PoolSlot;
  map: BuiltMap | null | undefined;
  /** Its values under the slot's mods, once known. */
  values?: SlotValueAnswer | undefined;
  /** Where its stars fall outside the bucket's target range ("Below 5.80–6.30★"), or null. */
  badge?: string | null;
  /** Its note, if it has one. */
  note?: string | undefined;
  /** Dragging it by its handle, and dropping others on it. */
  drag?: SlotDrag | undefined;
  onNote: (note: string) => void;
  first: boolean;
  last: boolean;
  /** The buckets it can move to (every other one). */
  targets: readonly MoveTarget[];
  onMove: (direction: "up" | "down") => void;
  onMoveTo: (bucket: string) => void;
  onRemove: () => void;
};

export function SlotRow(props: SlotRowProps) {
  const { slot, map, values, badge, note, drag, first, last, targets, ...on } = props;
  const dragged = drag?.dragging === slot.beatmapId;
  const over = drag?.over?.bucket === slot.mod && drag.over.index === slot.index && !dragged;
  const [target, setTarget] = useState("");
  const label = slotLabel(slot);
  const chosen = targets.find((option) => option.code === target);
  return (
    <li
      data-map={slot.beatmapId}
      data-drop-bucket={slot.mod ?? ""}
      data-drop-index={slot.index}
      {...drag?.target()}
      className={`flex @3xl:flex-row flex-col @3xl:items-center gap-2 border-t py-3 ${over ? "border-h1 border-t-2" : "border-b3"} ${dragged ? "opacity-50" : ""}`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {drag ? (
          <span
            data-drag-handle
            aria-hidden="true"
            title="Drag to move"
            {...drag.handle(slot)}
            className="flex w-5 shrink-0 cursor-grab touch-none select-none items-center justify-center text-c3 hover:text-c1 active:cursor-grabbing"
          >
            ⋮⋮
          </span>
        ) : null}
        <span className="w-14 shrink-0 font-bold text-c1">{label}</span>
        <MapPreview setId={map?.setId ?? null} song={songOf(map, slot.beatmapId)} />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <SlotMapText beatmapId={slot.beatmapId} map={map} values={values} />
          {badge ? (
            <span className="rounded-full bg-amber-300/20 px-2 py-0.5 font-bold text-amber-200 text-xs">
              {badge}
            </span>
          ) : null}
          <SlotNote beatmapId={slot.beatmapId} label={label} note={note} onSave={on.onNote} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          data-control="up"
          disabled={first}
          aria-label={`Move ${label} up`}
          onClick={() => on.onMove("up")}
        >
          Up
        </Button>
        <Button
          variant="secondary"
          data-control="down"
          disabled={last}
          aria-label={`Move ${label} down`}
          onClick={() => on.onMove("down")}
        >
          Down
        </Button>
        {targets.length > 0 ? (
          <>
            <div className="w-40">
              <select
                data-control="target"
                aria-label={`Move ${label} to`}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className={fieldClasses()}
              >
                <option value="">Move to…</option>
                {targets.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              disabled={!chosen}
              aria-label={chosen ? `Move ${label} to ${chosen.code}` : `Move ${label}`}
              onClick={() => on.onMoveTo(target)}
            >
              Move
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          data-control="remove"
          aria-label={`Remove ${label}`}
          onClick={on.onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
