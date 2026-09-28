/**
 * @file src/components/check/CheckResults.tsx
 * @desc The check's rows: slot (or its place in the paste), the map (its label when a pool here
 *       has it; osu! link), the verdict with its notes (https links only, never HTML), and its
 *       pool usage linking the map's history. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { beatmapUrl } from "@haruhimemoe/osu/shapes";
import { cx, Table, TBody, Td, THead, Th } from "@haruhimemoe/ui";
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

/**
 * @function CheckResults
 * @param props {CheckResultsProps} the check's answer and the pasted ids
 * @returns {JSX.Element} a table of each map's verdict and where pools used it
 */
export function CheckResults({
  rows,
  result,
}: {
  rows: readonly CheckRow[];
  result: CheckResponse;
}) {
  return (
    <Table caption="Each map's verdict and where pools used it" hideCaption>
      <THead>
        <tr>
          <Th>Slot</Th>
          <Th>Map</Th>
          <Th>Verdict</Th>
          <Th>In pools</Th>
        </tr>
      </THead>
      <TBody>
        {rows.map((row, i) => {
          const verdict = rowVerdict(result, row.beatmapId);
          const map = result.maps[String(row.beatmapId)];
          const usage = { count: map?.count ?? 0, lastYear: map?.lastYear ?? null };
          return (
            <tr
              key={`${row.label ?? ""}:${row.beatmapId}`}
              className="border-b4 border-t align-top"
            >
              <Th scope="row">{row.label ?? `Map ${i + 1}`}</Th>
              <Td>
                <a
                  href={beatmapUrl(row.beatmapId)}
                  rel="noreferrer"
                  className="hover:text-c1 hover:underline"
                >
                  {map?.label ?? `Beatmap ${row.beatmapId}`}
                </a>
              </Td>
              <Td>
                <span className={cx("font-bold", TONE_CLASSES[verdict.tone])}>{verdict.text}</span>
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
              </Td>
              <Td>
                {usage.count > 0 ? (
                  <Link href={`/maps/${row.beatmapId}`} className="hover:text-c1 hover:underline">
                    {usageSummary(usage)}
                  </Link>
                ) : (
                  usageSummary(usage)
                )}
              </Td>
            </tr>
          );
        })}
      </TBody>
    </Table>
  );
}
