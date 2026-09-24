/**
 * @file src/components/check/CheckResults.tsx
 * @desc The check's rows: slot (or its place in the paste), the map (its label when a pool here
 *       has it; osu! link), the verdict with its notes (https links only, never HTML), and its
 *       pool usage linking the map's history. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { beatmapUrl } from "@haruhimemoe/osu/shapes";
import Link from "next/link";
import type { CheckResponse } from "@/schemas/compliance";
import type { CheckRow } from "@/utils/check-input";
import { noteParts, type RowTone, rowVerdict } from "@/utils/compliance-view";
import { usageSummary } from "@/utils/usage";

const TONE_CLASSES: Readonly<Record<RowTone, string>> = {
  ok: "text-emerald-300",
  potential: "text-amber-300",
  missing: "text-amber-300",
  disallowed: "text-rose-300",
  unchecked: "text-c3",
};

export function CheckResults({
  rows,
  result,
}: {
  rows: readonly CheckRow[];
  result: CheckResponse;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Each map's verdict and where pools used it</caption>
        <thead className="text-c3 text-xs uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Slot
            </th>
            <th scope="col" className="py-2 pr-3">
              Map
            </th>
            <th scope="col" className="py-2 pr-3">
              Verdict
            </th>
            <th scope="col" className="py-2">
              In pools
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const verdict = rowVerdict(result, row.beatmapId);
            const map = result.maps[String(row.beatmapId)];
            const usage = { count: map?.count ?? 0, lastYear: map?.lastYear ?? null };
            return (
              <tr
                key={`${row.label ?? ""}:${row.beatmapId}`}
                className="border-b4 border-t align-top"
              >
                <th scope="row" className="py-2 pr-3 font-bold text-c1">
                  {row.label ?? `Map ${i + 1}`}
                </th>
                <td className="py-2 pr-3">
                  <a
                    href={beatmapUrl(row.beatmapId)}
                    rel="noreferrer"
                    className="hover:text-c1 hover:underline"
                  >
                    {map?.label ?? `Beatmap ${row.beatmapId}`}
                  </a>
                </td>
                <td className="py-2 pr-3">
                  <span className={`font-bold ${TONE_CLASSES[verdict.tone]}`}>{verdict.text}</span>
                  {verdict.notes ? (
                    <p className="text-c3">
                      {noteParts(verdict.notes).map((part, j) =>
                        "href" in part ? (
                          <a
                            // biome-ignore lint/suspicious/noArrayIndexKey: the same link can appear twice in one note; the parts never reorder
                            key={`${j}-${part.href}`}
                            href={part.href}
                            rel="noreferrer"
                            className="underline"
                          >
                            {part.text}
                          </a>
                        ) : (
                          // biome-ignore lint/suspicious/noArrayIndexKey: the same text can appear twice in one note; the parts never reorder
                          <span key={`${j}-${part.text}`}>{part.text}</span>
                        ),
                      )}
                    </p>
                  ) : null}
                </td>
                <td className="py-2">
                  {usage.count > 0 ? (
                    <Link href={`/maps/${row.beatmapId}`} className="hover:text-c1 hover:underline">
                      {usageSummary(usage)}
                    </Link>
                  ) : (
                    usageSummary(usage)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
