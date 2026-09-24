/**
 * @file src/components/maps/MapHistoryTable.tsx
 * @desc A map's tournament history: pool (linking its page), year ("year unknown"), slot label,
 *       and a Badged column only when some row knows it. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import Link from "next/link";
import type { HistoryRow } from "@/utils/history";
import { yearText } from "@/utils/pool-text";

export function MapHistoryTable({ rows }: { rows: readonly HistoryRow[] }) {
  const showBadged = rows.some((row) => row.badged !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Pools that used this map, newest first</caption>
        <thead className="text-c3 text-xs uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Pool
            </th>
            <th scope="col" className="py-2 pr-3">
              Year
            </th>
            <th scope="col" className="py-2 pr-3">
              Slot
            </th>
            {showBadged ? (
              <th scope="col" className="py-2">
                Badged
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.poolId}-${row.slot}`} className="border-b4 border-t">
              <td className="py-2 pr-3">
                <Link href={`/pools/${row.poolId}`} className="hover:text-c1 hover:underline">
                  {row.round ? `${row.tournament} · ${row.round}` : row.tournament}
                </Link>
              </td>
              <td className="py-2 pr-3 tabular-nums">{yearText(row.year)}</td>
              <td className="py-2 pr-3 font-bold text-c1">{row.slot}</td>
              {showBadged ? (
                <td className="py-2">
                  {row.badged === null ? "Not known" : row.badged ? "Yes" : "No"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
