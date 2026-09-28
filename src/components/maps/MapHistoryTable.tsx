/**
 * @file src/components/maps/MapHistoryTable.tsx
 * @desc A map's tournament history: pool (linking its page), year ("year unknown"), slot label,
 *       and a Badged column only when some row knows it. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Table, TBody, Td, THead, Th } from "@haruhimemoe/ui";
import Link from "next/link";
import type { HistoryRow } from "@/utils/history";
import { yearText } from "@/utils/pool-text";

export function MapHistoryTable({ rows }: { rows: readonly HistoryRow[] }) {
  const showBadged = rows.some((row) => row.badged !== null);
  return (
    <Table caption="Pools that used this map, newest first" hideCaption>
      <THead>
        <tr>
          <Th>Pool</Th>
          <Th>Year</Th>
          <Th>Slot</Th>
          {showBadged ? <Th>Badged</Th> : null}
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <tr key={`${row.poolId}-${row.slot}`}>
            <Td>
              <Link href={`/pools/${row.poolId}`} className="hover:text-c1 hover:underline">
                {row.round ? `${row.tournament} · ${row.round}` : row.tournament}
              </Link>
            </Td>
            <Td numeric>{yearText(row.year)}</Td>
            <Td className="font-bold text-c1">{row.slot}</Td>
            {showBadged ? (
              <Td>{row.badged === null ? "Not known" : row.badged ? "Yes" : "No"}</Td>
            ) : null}
          </tr>
        ))}
      </TBody>
    </Table>
  );
}
