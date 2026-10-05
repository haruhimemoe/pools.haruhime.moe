/**
 * @file src/components/builder/SlotRow.tsx
 * @desc One slot in the editor: its label, its cover and preview clip, its map, and buttons to move it up or down, move it to
 *       another bucket (a picker and a Move button, so arrow keys in the picker never move
 *       anything), demote it to a candidate ("Demote"), find maps like it (Find similar) and remove it, with the slot's
 *       candidate list under it, a badge when its stars sit outside the bucket's target, and its note. A handle (a button,
 *       "Reorder NM2") drags it by mouse, touch or keyboard onto another row or bucket; Up, Down and Move do the same in one
 *       press.
 *       Every control names its slot for screen readers. Its map and
 *       controls sit side by side only once the maps card (a size container) is 48rem wide;
 *       narrower, on phones and in the desktop editor's pool column, they stack. The editor
 *       decides what each button does and where focus goes after.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import {
  Badge,
  Button,
  cx,
  fieldClasses,
  ModBadge,
  SORTABLE_ITEM,
  type Sortable,
  SortableHandle,
  SortableMoveButtons,
} from "@haruhimemoe/ui";
import { type ReactNode, useState } from "react";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import { MapPreview } from "@/components/builder/MapPreview";
import { SlotMapText } from "@/components/builder/SlotMapText";
import { SlotNote } from "@/components/builder/SlotNote";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { songOf } from "@/utils/map-preview";
import { mapLabel } from "@/utils/map-record";
import type { SlotValueAnswer } from "@/utils/slot-values";
import { bucketListId, pickId } from "@/utils/sortable-ids";

/** A bucket a map can move to: its code and label. */
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
  /** Dragging it by its handle (mouse, touch or keyboard), and dropping others on it. */
  sortable: Sortable;
  /** Its place in the bucket's list (empty slots counted). */
  position: number;
  onNote: (note: string) => void;
  /** The buckets it can move to (every other one). */
  targets: readonly MoveTarget[];
  onRemove: () => void;
  /** Makes the pick one of the slot's candidates (buckets only). */
  onDemote?: (() => void) | undefined;
  /** The slot's candidate list, under the map. */
  children?: ReactNode;
};

/**
 * @function SlotRow
 * @param props {SlotRowProps} the slot, its map, values, note, move targets and actions
 * @returns {JSX.Element} one slot: label, preview, map text, note, and its move and remove controls
 */
export function SlotRow(props: SlotRowProps) {
  const { slot, map, values, badge, note, sortable, position, targets, children, ...on } = props;
  const [target, setTarget] = useState("");
  const label = slotLabel(slot);
  const chosen = targets.find((option) => option.code === target);
  const id = pickId(slot.beatmapId);
  return (
    <li
      data-map={slot.beatmapId}
      {...sortable.item(id, { container: bucketListId(slot.mod), index: position, label })}
      className={cx("flex flex-col gap-2 border-b3 border-t py-3", SORTABLE_ITEM)}
    >
      <div className="flex @3xl:flex-row flex-col @3xl:items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-3">
          <SortableHandle sortable={sortable} id={id} className="self-start" />
          <span className="w-14 shrink-0">
            <ModBadge mod={label} />
          </span>
          <MapPreview setId={map?.setId ?? null} song={songOf(map, slot.beatmapId)} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <SlotMapText beatmapId={slot.beatmapId} map={map} values={values} />
            {badge ? <Badge tone="warning">{badge}</Badge> : null}
            <SlotNote beatmapId={slot.beatmapId} label={label} note={note} onSave={on.onNote} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SortableMoveButtons sortable={sortable} id={id} label={label} variant="secondary" />
          {targets.length > 0 ? (
            <>
              <div className="w-36">
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
                onClick={() => {
                  sortable.moveTo(id, {
                    container: bucketListId(target),
                    index: Number.MAX_SAFE_INTEGER,
                  });
                  setTarget("");
                }}
              >
                Move
              </Button>
            </>
          ) : null}
          {on.onDemote ? (
            <Button
              variant="ghost"
              data-control="demote"
              aria-label={`Demote ${label}'s pick to a candidate`}
              onClick={on.onDemote}
            >
              Demote
            </Button>
          ) : null}
          <FindSimilarButton beatmapId={slot.beatmapId} label={mapLabel(map, slot.beatmapId)} />
          <Button
            variant="ghost"
            data-control="remove"
            aria-label={`Remove ${label}`}
            onClick={on.onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
      {children}
    </li>
  );
}
