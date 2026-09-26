/**
 * @file src/components/search/StatusChips.tsx
 * @desc The all-maps status picker: one status at a time, so it's a real radio group (native
 *       radio inputs, one name) drawn as the ui kit's chips. Tab reaches the checked chip, the
 *       arrow keys move and pick, and screen readers hear "radio, 1 of 5, checked". The group's
 *       name comes from the FilterRow fieldset around it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

"use client";

import { useId } from "react";
import { MAP_STATUS_LABELS, MAP_STATUSES, type MapStatus } from "@/constants/search";

type Props = { value: MapStatus; onChange: (status: MapStatus) => void };

/** The ui kit's Chip look (on and off), with the focus ring on the chip, not the hidden input. */
const BASE =
  "cursor-pointer rounded-full px-2.5 py-0.5 font-bold text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-h1 has-[:focus-visible]:outline-offset-2";
const ON = "bg-h1 text-b6 forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]";
const OFF = "bg-b3 text-c2 hover:bg-b2";

export function StatusChips({ value, onChange }: Props) {
  const name = useId();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {MAP_STATUSES.map((status) => (
        <label key={status} className={`${BASE} ${status === value ? ON : OFF}`}>
          <input
            type="radio"
            name={name}
            value={status}
            checked={status === value}
            onChange={() => onChange(status)}
            className="sr-only"
          />
          {MAP_STATUS_LABELS[status]}
        </label>
      ))}
    </div>
  );
}
