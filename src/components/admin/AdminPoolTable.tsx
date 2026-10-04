/**
 * @file src/components/admin/AdminPoolTable.tsx
 * @desc Every pool for admins: id (the preview and edit page), name, headline, hidden and
 *       superseded marks, and the pack's sync state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { Table, TBody, Td, Text, TextLink, THead, Th } from "@haruhimemoe/ui";
import type { AdminPoolRow } from "@/services/admin-pools";
import { poolHeadline } from "@/utils/pool-text";

/**
 * @function AdminPoolTable
 * @param props {{ rows: readonly AdminPoolRow[] }} one page of the admin pool list
 * @returns {JSX.Element} the table of pools with their state and sync
 */
export function AdminPoolTable({ rows }: { rows: readonly AdminPoolRow[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Pool</Th>
          <Th>Tournament</Th>
          <Th>Marks</Th>
          <Th>Pack</Th>
        </tr>
      </THead>
      <TBody>
        {rows.map((pool) => (
          <tr key={pool._id} className="align-top">
            <Td>
              <TextLink href={`/admin/pools/${pool._id}`} variant="plain">
                {pool.name}
              </TextLink>
              <div className="text-c3 text-xs">{pool._id}</div>
            </Td>
            <Td>{poolHeadline(pool)}</Td>
            <Td>
              {[
                pool.hidden ? "hidden" : null,
                pool.supersededBy ? `replaced by ${pool.supersededBy}` : null,
              ]
                .filter(Boolean)
                .join(", ") || "none"}
            </Td>
            <Td>
              {pool.pack.state ?? "never sent"}
              {pool.pack.error ? (
                <Text as="div" tone="error" size="xs">
                  {pool.pack.error}
                </Text>
              ) : null}
            </Td>
          </tr>
        ))}
      </TBody>
    </Table>
  );
}
