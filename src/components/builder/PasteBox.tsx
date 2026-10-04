/**
 * @file src/components/builder/PasteBox.tsx
 * @desc Pastes maps into the pool as packs reads them (slot lines like "NM1 129891", or beatmap
 *       IDs and links), adding to the pool (a slot already there takes the pasted map) or
 *       replacing every map. Sent as one replaceMaps change. Lines that can't be read are listed
 *       with their number, text and why, and nothing is changed; the text stays so it can be
 *       fixed. A paste that applies clears the box.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import type { SlotLineError } from "@haruhimemoe/pool";
import { Button, Select, Textarea } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import { MAX_PASTE_LENGTH } from "@/constants/built-pools";
import type { PoolOp } from "@/schemas/built-pool-ops";

type Mode = "merge" | "replace";

type PasteBoxProps = {
  change: (ops: PoolOp[]) => boolean;
  /** The bad lines of the last paste that failed, if the last failure was one. */
  lines: readonly SlotLineError[] | undefined;
};

/**
 * @function PasteBox
 * @param props {PasteBoxProps} the change call and a paste's bad lines
 * @returns {JSX.Element} the paste box for IDs, links and slot lines
 */
export function PasteBox({ change, lines }: PasteBoxProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("merge");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "") return;
    if (change([{ type: "replaceMaps", text, mode }])) setText("");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Textarea
        id="paste-maps"
        label="Paste maps"
        hint="Slot lines like NM1 129891, or beatmap IDs and links. Lines starting with # are skipped."
        rows={5}
        maxLength={MAX_PASTE_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Select
        id="paste-mode"
        label="What the paste does"
        value={mode}
        onChange={(event) => setMode(event.target.value as Mode)}
      >
        <option value="merge">Add to the pool (a slot already there takes the pasted map)</option>
        <option value="replace">Replace every map in the pool</option>
      </Select>
      <Button type="submit" variant="secondary">
        Paste maps
      </Button>
      {lines && lines.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="font-bold text-rose-300 text-sm">These lines couldn't be read:</p>
          <ul className="flex flex-col gap-1 text-sm">
            {lines.map((line) => (
              <li key={`${line.line}-${line.code}`}>
                <span className="font-bold text-c1">Line {line.line}</span>{" "}
                <code className="break-all text-c3">{line.text}</code>: {line.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
