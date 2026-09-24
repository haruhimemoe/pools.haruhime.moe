/**
 * @file src/components/admin/AdminPoolTable.tsx
 * @desc Every pool for admins: id (the preview and edit page), name, headline, hidden and
 *       superseded marks, and the pack's sync state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import Link from "next/link";
import type { AdminPoolRow } from "@/services/admin";
import { poolHeadline } from "@/utils/pool-text";

export function AdminPoolTable({ rows }: { rows: readonly AdminPoolRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-c3 text-xs uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Pool
            </th>
            <th scope="col" className="py-2 pr-3">
              Tournament
            </th>
            <th scope="col" className="py-2 pr-3">
              Marks
            </th>
            <th scope="col" className="py-2">
              Pack
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pool) => (
            <tr key={pool._id} className="border-b4 border-t align-top">
              <td className="py-2 pr-3">
                <Link
                  href={`/admin/pools/${pool._id}`}
                  className="font-bold text-c1 hover:underline"
                >
                  {pool.name}
                </Link>
                <div className="text-c3 text-xs">{pool._id}</div>
              </td>
              <td className="py-2 pr-3">{poolHeadline(pool)}</td>
              <td className="py-2 pr-3">
                {[
                  pool.hidden ? "hidden" : null,
                  pool.supersededBy ? `replaced by ${pool.supersededBy}` : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "none"}
              </td>
              <td className="py-2">
                {pool.pack.state ?? "never sent"}
                {pool.pack.error ? (
                  <div className="text-rose-300 text-xs">{pool.pack.error}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
