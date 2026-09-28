/**
 * @file src/components/builder/ExportPanel.tsx
 * @desc Export on a built pool's page and in its editor, made from what the page already holds:
 *       Copy beatmap IDs (slot label and ID per line), Copy !mp lines (per slot, `!mp map <id> 0`
 *       and `!mp mods`, in slot order) and Download CSV (the file is made in the browser and
 *       saved from there). Nothing is fetched.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { Button, CopyButton } from "@haruhimemoe/ui";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { csvFileName, csvOf, exportRows, idLines, mpLines } from "@/utils/pool-export";
import type { SlotValueMap } from "@/utils/slot-values";

type ExportPanelProps = {
  pool: { name: string; buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] };
  maps: BuiltMaps;
  /** Values under each slot's mods, as far as they're known. */
  values: SlotValueMap;
};

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

export function ExportPanel({ pool, maps, values }: ExportPanelProps) {
  if (pool.slots.length === 0) return <p className="text-c3 text-sm">Add maps to export them.</p>;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-c3">
        The !mp lines set each map for osu!standard, then its slot's mods (None, the forced mods, or
        Freemod), ready to paste into a tournament room one at a time.
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={idLines(pool)} label="Copy beatmap IDs" />
        <CopyButton text={mpLines(pool)} label="Copy !mp lines" />
        <Button
          variant="secondary"
          onClick={() => download(csvFileName(pool.name), csvOf(exportRows(pool, maps, values)))}
        >
          Download CSV
        </Button>
      </div>
    </div>
  );
}
