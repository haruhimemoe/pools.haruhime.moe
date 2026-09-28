/**
 * @file src/components/builder/AddToPool.tsx
 * @desc One difficulty's Add in the map browser. Add puts it at the end of the default slot for
 *       the lens (src/utils/browse-add.ts); with none, it opens an inline slot picker instead.
 *       "Choose slot" opens the picker for any slot (or no slot). The picker is a native select
 *       with its own Add and Cancel; opening it moves focus to the select, Escape or Cancel
 *       closes it and puts focus back on Add. A map already in the pool says so (Add stays
 *       focusable, marked unavailable, so focus isn't lost when it changes). Each button's name
 *       starts with the words on it, then the difficulty ("Add to NM: Insane"), so voice control
 *       finds it by what it shows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { type BucketEntry, bucketOptionLabel } from "@haruhimemoe/pool";
import { Button, Select } from "@haruhimemoe/ui";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

type AddToPoolProps = {
  beatmapId: number;
  /** The difficulty's name, for the buttons' names. */
  version: string;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  inPool: boolean;
  onAdd: (beatmapId: number, bucket: string | null) => void;
};

const NO_SLOT = "";

export function AddToPool(props: AddToPoolProps) {
  const { beatmapId, version, buckets, defaultBucket, inPool, onAdd } = props;
  const selectId = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(defaultBucket ?? buckets[0]?.code ?? NO_SLOT);
  useEffect(() => {
    if (open) select.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    addButton.current?.focus();
  };
  const add = () => {
    if (inPool) return;
    if (defaultBucket === null) setOpen(true);
    else onAdd(beatmapId, defaultBucket);
  };
  const addPicked = () => {
    onAdd(beatmapId, picked === NO_SLOT ? null : picked);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.key === "Escape") close();
  };
  // Each name starts with the words on the button (WCAG 2.5.3), then says which difficulty.
  const addName = inPool
    ? `In this pool: ${version}`
    : defaultBucket === null
      ? `Add ${version}: choose a slot`
      : `Add to ${defaultBucket}: ${version}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          ref={addButton}
          variant={inPool ? "ghost" : "secondary"}
          aria-label={addName}
          aria-disabled={inPool || undefined}
          onClick={add}
        >
          {inPool ? "In this pool" : defaultBucket === null ? "Add" : `Add to ${defaultBucket}`}
        </Button>
        {inPool ? null : (
          <Button
            variant="ghost"
            aria-label={`Choose slot for ${version}`}
            aria-expanded={open}
            onClick={() => (open ? close() : setOpen(true))}
          >
            Choose slot
          </Button>
        )}
      </div>
      {open && !inPool ? (
        <fieldset onKeyDown={onKeyDown} className="flex flex-wrap items-end gap-2">
          <legend className="sr-only">{`Add ${version} to a slot`}</legend>
          <Select
            ref={select}
            id={selectId}
            label="Slot"
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
          >
            {buckets.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {bucketOptionLabel(entry)}
              </option>
            ))}
            <option value={NO_SLOT}>No slot</option>
          </Select>
          <Button onClick={addPicked}>Add</Button>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        </fieldset>
      ) : null}
    </div>
  );
}
