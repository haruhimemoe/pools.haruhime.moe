/**
 * @file src/components/maps/MapHistoryTable.tsx
 * @desc A map's tournament history: pool (linking its page), year ("year unknown"), slot label,
 *       and a Badged column only when some row knows it. Scrolls sideways on phones.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

import { Table, TBody, Td, THead, Th } from "@haruhimemoe/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { HistoryRow } from "@/utils/history";
import { yearText } from "@/utils/pool-text";

/**
 * @function MapHistoryTable
 * @param props {{ rows: readonly HistoryRow[] }} the current pools the map is in
 * @returns {JSX.Element} a table of pool, year, slot and (when known) badged
 */
export function MapHistoryTable({ rows }: { rows: readonly HistoryRow[] }) {
  const t = useTranslations("pools.mapHistoryTable");
  const showBadged = rows.some((row) => row.badged !== null);
  return (
    <Table caption={t("poolsThatUsedThis")} hideCaption>
      <THead>
        <tr>
          <Th>{t("pool")}</Th>
          <Th>{t("year")}</Th>
          <Th>{t("slot")}</Th>
          {showBadged ? <Th>{t("badged")}</Th> : null}
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
              <Td>{row.badged === null ? t("notKnown") : row.badged ? "Yes" : "No"}</Td>
            ) : null}
          </tr>
        ))}
      </TBody>
    </Table>
  );
}
