/**
 * @file src/components/search/StatusChips.tsx
 * @desc The all-maps status picker: one status at a time, as chips that are a real radio group
 *       (ui's ChoiceChips), named by the Status row around it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { ChoiceChips } from "@haruhimemoe/ui";
import { MAP_STATUS_LABELS, MAP_STATUSES, type MapStatus } from "@/constants/search";

type Props = { value: MapStatus; onChange: (status: MapStatus) => void };

const STATUS_OPTIONS = MAP_STATUSES.map((status) => ({
  value: status,
  label: MAP_STATUS_LABELS[status],
}));

/**
 * @function StatusChips
 * @param props {Props} the status and the change handler
 * @returns {JSX.Element} one status at a time as ui's ChoiceChips
 */
export function StatusChips({ value, onChange }: Props) {
  return (
    <ChoiceChips
      label="Status"
      hideLabel
      options={STATUS_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
