/**
 * @file src/components/account/YourPools.tsx
 * @desc "Your pools" on /account: how many pools the user owns and edits, then each one (owned
 *       first, newest change first) linking its page, with who can see it, how many maps it
 *       holds and a link to its editor; "Make a pool" goes to /new. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { ButtonLink } from "@haruhimemoe/ui";
import Link from "next/link";
import { VISIBILITY_TEXT } from "@/constants/built-pools";
import type { PoolListItem, YourPools as Pools } from "@/services/built-pools";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function PoolList({ title, pools }: { title: string; pools: PoolListItem[] }) {
  if (pools.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold text-c3 text-sm">{title}</h3>
      <ul className="flex flex-col">
        {pools.map((pool) => (
          <li
            key={pool.id}
            className="flex flex-col gap-1 border-b3 border-t py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            <Link href={`/pools/${pool.id}`} className="font-bold text-c1 hover:underline">
              {pool.name}
            </Link>
            <span className="flex flex-wrap items-baseline gap-x-3 text-c3 text-xs">
              <span>
                {VISIBILITY_TEXT[pool.visibility].label.toLowerCase()} ·{" "}
                {count(pool.maps, "map", "maps")}
              </span>
              <Link
                href={`/pools/${pool.id}/edit`}
                aria-label={`Edit ${pool.name}`}
                className="font-bold text-c2 hover:text-c1"
              >
                Edit
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function YourPools({ owned, editing }: Pools) {
  const make = (
    <ButtonLink href="/new" className="self-start">
      Make a pool
    </ButtonLink>
  );
  if (owned.length === 0 && editing.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-c2 text-sm">You haven't made a pool yet.</p>
        {make}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-c2 text-sm">
        You own {count(owned.length, "pool", "pools")} and edit {editing.length}.
      </p>
      {make}
      <PoolList title="Yours" pools={owned} />
      <PoolList title="You edit" pools={editing} />
    </div>
  );
}
