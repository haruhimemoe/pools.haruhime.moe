/**
 * @file src/components/account/YourPools.tsx
 * @desc "Your pools" on /account: how many pools the user owns and edits, then each one's name,
 *       who can see it and how many maps it holds, owned first. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { PoolListItem, YourPools as Pools } from "@/services/built-pools";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function PoolList({ title, pools }: { title: string; pools: PoolListItem[] }) {
  if (pools.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold text-c3 text-sm">{title}</h3>
      <ul className="flex flex-col gap-1">
        {pools.map((pool) => (
          <li key={pool.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-bold text-c1">{pool.name}</span>
            <span className="text-c3 text-xs">
              {pool.visibility} · {count(pool.maps, "map", "maps")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function YourPools({ owned, editing }: Pools) {
  if (owned.length === 0 && editing.length === 0) {
    return <p className="text-c2 text-sm">You haven't made a pool yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-c2 text-sm">
        You own {count(owned.length, "pool", "pools")} and edit {editing.length}.
      </p>
      <PoolList title="Yours" pools={owned} />
      <PoolList title="You edit" pools={editing} />
    </div>
  );
}
