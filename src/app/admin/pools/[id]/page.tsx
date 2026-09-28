/**
 * @file src/app/admin/pools/[id]/page.tsx
 * @desc /admin/pools/[id]: an admin's view of one pool, hidden ones included: the page as the
 *       public sees it (with a hidden notice and each slot's values under its mods), its pack's
 *       sync state, the edit form, and badged for the whole tournament. 404 for an unknown id.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgedForm } from "@/components/admin/BadgedForm";
import { PoolEditForm } from "@/components/admin/PoolEditForm";
import { PoolView } from "@/components/pools/PoolView";
import { requireAdmin } from "@/lib/auth-session";
import { getMapSummaries, getPoolById } from "@/services/pools";
import { pastSlotValues } from "@/services/slot-values";
import { openInPacksHref } from "@/utils/pack-input";
import { shownNotes } from "@/utils/pool-record";

/** The admin preview's title; it's never indexed. */
export const metadata: Metadata = { title: "Pool (admin)", robots: { index: false } };

/**
 * @function AdminPoolPage
 * @param props {PageProps<"/admin/pools/[id]">} the pool's id
 * @returns {Promise<JSX.Element>} the pool as the public sees it (hidden ones too) with the admin's
 *          edit form
 */
export default async function AdminPoolPage({ params }: PageProps<"/admin/pools/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/pools/${id}`);
  const pool = await getPoolById(id);
  if (!pool) notFound();
  const maps = await getMapSummaries(pool.slots.map((slot) => slot.beatmapId));
  const { values } = await pastSlotValues(pool, maps);
  return (
    <div className="flex flex-col gap-6">
      <PoolView
        pool={pool}
        maps={maps}
        values={values}
        openInPacks={openInPacksHref(pool)}
        preview
      />
      <Card title="Pack sync">
        <p className="text-sm">
          {pool.pack.state ?? "Never sent"}
          {pool.pack.slug ? ` · packs slug ${pool.pack.slug}` : ""}
          {pool.pack.syncedAt
            ? ` · ${pool.pack.syncedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
            : ""}
        </p>
        {pool.pack.error ? <p className="text-rose-300 text-sm">{pool.pack.error}</p> : null}
      </Card>
      <Card title="Edit">
        <PoolEditForm
          poolId={pool._id}
          initial={{
            tournament: pool.tournament,
            round: pool.round,
            year: pool.year,
            notes: shownNotes(pool.notes, pool.edited),
            hidden: pool.hidden,
            badged: pool.badged,
          }}
        />
      </Card>
      <Card title="Badged, for the whole tournament">
        <BadgedForm tournamentKey={pool.tournamentKey} year={pool.year} />
      </Card>
    </div>
  );
}
