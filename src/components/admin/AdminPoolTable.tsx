/**
 * @file src/components/admin/AdminPoolTable.tsx
 * @desc Every pool for admins: id (the preview and edit page), name, headline, hidden and
 *       superseded marks, and the pack's sync state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Table, TBody, Td, TextLink, THead, Th } from "@haruhimemoe/ui";
import type { AdminPoolRow } from "@/services/admin-pools";
import { poolHeadline } from "@/utils/pool-text";

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
                <div className="text-rose-300 text-xs">{pool.pack.error}</div>
              ) : null}
            </Td>
          </tr>
        ))}
      </TBody>
    </Table>
  );
}
