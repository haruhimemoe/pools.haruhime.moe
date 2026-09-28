/**
 * @file src/components/admin/AdminBuiltPoolTable.tsx
 * @desc The newest unlisted and public pools built here, for admins: name (linking its page;
 *       a private one, which admins can't open, is never listed but would show no link), id,
 *       owner, who can see it, hidden, map count, pack state and when it was made, each with
 *       Hide or Unhide and Delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import Link from "next/link";
import { BuiltPoolModeration } from "@/components/admin/BuiltPoolModeration";
import { VISIBILITY_TEXT } from "@/constants/built-pools";
import type { AdminBuiltPool } from "@/services/built-moderation";

const HEADINGS = ["Pool", "Owner", "Seen by", "Maps", "Pack", "Made", "Moderation"] as const;

export function AdminBuiltPoolTable({ pools }: { pools: readonly AdminBuiltPool[] }) {
  if (pools.length === 0) {
    return <p className="text-c3 text-sm">No unlisted or public pool has been built yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-c3 text-xs uppercase">
          <tr>
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className="py-2 pr-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pools.map((pool) => (
            <tr key={pool.id} className="border-b4 border-t align-top">
              <td className="py-2 pr-3">
                {pool.visibility === "private" ? (
                  <span className="font-bold text-c1">{pool.name}</span>
                ) : (
                  <Link href={`/pools/${pool.id}`} className="font-bold text-c1 hover:underline">
                    {pool.name}
                  </Link>
                )}
                <div className="text-c3 text-xs">{pool.id}</div>
              </td>
              <td className="py-2 pr-3">{pool.owner ?? "unknown"}</td>
              <td className="py-2 pr-3">
                {VISIBILITY_TEXT[pool.visibility].label}
                {pool.hidden ? <div className="font-bold text-rose-300 text-xs">hidden</div> : null}
              </td>
              <td className="py-2 pr-3">{pool.maps}</td>
              <td className="py-2 pr-3">{pool.pack}</td>
              <td className="py-2 pr-3">{pool.createdAt.toISOString().slice(0, 10)}</td>
              <td className="py-2">
                <BuiltPoolModeration id={pool.id} name={pool.name} hidden={pool.hidden} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
