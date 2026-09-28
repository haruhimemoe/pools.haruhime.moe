/**
 * @file src/components/builder/AddAsCandidate.tsx
 * @desc "Add as candidate" beside a map's Add: it opens an inline slot picker (every slot of the
 *       pool with a pick or candidates, and a new slot per bucket), the default bucket's first
 *       slot chosen, then Add or Cancel (Escape cancels, and focus goes back to the button). A
 *       note (from "Your candidates") comes along. Every name starts with the button's words
 *       and says which difficulty.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, Select } from "@haruhimemoe/ui";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { CandidateAdder } from "@/schemas/candidate-editor";

type AddAsCandidateProps = {
  beatmapId: number;
  beatmapsetId: number | null;
  /** The difficulty's name, for the buttons' names. */
  version: string;
  /** The bucket Add would use, whose first slot is chosen first. */
  defaultBucket: string | null;
  /** A note to copy with it. */
  note?: string | undefined;
  adder: CandidateAdder;
};

/**
 * @function AddAsCandidate
 * @param props {AddAsCandidateProps} the difficulty, its set, the default bucket, a note and the
 *        slots with the add call
 * @returns {JSX.Element} the button and, while open, the slot picker
 */
export function AddAsCandidate(props: AddAsCandidateProps) {
  const { beatmapId, beatmapsetId, version, defaultBucket, note, adder } = props;
  const selectId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const first = adder.options.find((o) => o.bucket === defaultBucket) ?? adder.options[0];
  const [picked, setPicked] = useState(first?.value ?? "");
  useEffect(() => {
    if (open) select.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const add = () => {
    const option = adder.options.find((o) => o.value === picked) ?? first;
    if (!option) return;
    const map = { beatmapId, beatmapsetId, ...(note ? { note } : {}) };
    adder.onAdd(map, { bucket: option.bucket, index: option.index });
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.key === "Escape") close();
  };
  return (
    <div className="flex flex-col gap-2">
      <Button
        ref={button}
        variant="ghost"
        className="self-start"
        aria-label={`Add as candidate: ${version}`}
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else {
            setPicked(first?.value ?? "");
            setOpen(true);
          }
        }}
      >
        Add as candidate
      </Button>
      {open ? (
        <fieldset onKeyDown={onKeyDown} className="flex flex-wrap items-end gap-2">
          <legend className="sr-only">{`Add ${version} as a candidate for a slot`}</legend>
          <Select
            ref={select}
            id={selectId}
            label="Candidate for"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
          >
            {adder.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button onClick={add} aria-label={`Add ${version} as a candidate`}>
            Add
          </Button>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        </fieldset>
      ) : null}
    </div>
  );
}
