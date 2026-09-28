/**
 * @file src/components/search/StatusChips.tsx
 * @desc The all-maps status picker: one status at a time, as chips that are a real radio group
 *       (ChoiceChips).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { ChoiceChips } from "@/components/search/ChoiceChips";
import { MAP_STATUS_LABELS, MAP_STATUSES, type MapStatus } from "@/constants/search";

type Props = { value: MapStatus; onChange: (status: MapStatus) => void };

export function StatusChips({ value, onChange }: Props) {
  return (
    <ChoiceChips
      options={MAP_STATUSES}
      labels={MAP_STATUS_LABELS}
      value={value}
      onChange={onChange}
    />
  );
}
