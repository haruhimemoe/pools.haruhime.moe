/**
 * @file src/components/search/ChoiceChips.tsx
 * @desc One choice from a few, as a real radio group (native radio inputs, one name) drawn as
 *       the ui kit's chips: Tab reaches the checked chip, the arrow keys move and pick, and
 *       screen readers hear "radio, 1 of 3, checked". The group's name comes from the FilterRow
 *       fieldset around it. The all-maps status and the pools tab's type use it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { useId } from "react";

type Props<T extends string> = {
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  value: T;
  onChange: (value: T) => void;
};

/** The ui kit's Chip look (on and off), with the focus ring on the chip, not the hidden input. */
const BASE =
  "cursor-pointer rounded-full px-2.5 py-0.5 font-bold text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-h1 has-[:focus-visible]:outline-offset-2";
const ON = "bg-h1 text-b6 forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]";
const OFF = "bg-b3 text-c2 hover:bg-b2";

export function ChoiceChips<T extends string>({ options, labels, value, onChange }: Props<T>) {
  const name = useId();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <label key={option} className={`${BASE} ${option === value ? ON : OFF}`}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={option === value}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {labels[option]}
        </label>
      ))}
    </div>
  );
}
