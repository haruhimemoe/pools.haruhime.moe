/**
 * @file src/components/pools/PoolView.tsx
 * @desc A pool page: name, tournament · round · year, map count and badged (when known), Open in
 *       packs, the notes shown (an admin's or the source's), "Replaced by" when superseded, the
 *       maps, and the sources. The admin preview adds a hidden notice. Presentational: the page
 *       loads the data and builds the packs link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ButtonLink, Card, Notice, PageHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { PoolSlotTable } from "@/components/pools/PoolSlotTable";
import { PoolSources } from "@/components/pools/PoolSources";
import type { StoredPool } from "@/schemas/pool";
import type { MapSummary } from "@/services/pools";
import { shownNotes } from "@/utils/pool-record";
import { badgedText, poolHeadline } from "@/utils/pool-text";

type PoolViewProps = {
  pool: StoredPool;
  maps: ReadonlyMap<number, MapSummary>;
  openInPacks: string;
  /** The admin preview: hidden pools show, with a notice. */
  preview?: boolean;
};

export function PoolView({ pool, maps, openInPacks, preview = false }: PoolViewProps) {
  const notes = shownNotes(pool.notes, pool.edited);
  const count = `${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"}`;
  const badged = badgedText(pool.badged);
  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        title={pool.name}
        lead={poolHeadline(pool)}
        meta={badged ? `${count} · ${badged}` : count}
        actions={<ButtonLink href={openInPacks}>Open in packs</ButtonLink>}
      />
      {preview && pool.hidden ? (
        <Notice tone="warning">This pool is hidden. Only admins see this preview.</Notice>
      ) : null}
      {pool.supersededBy ? (
        <Notice tone="warning">
          This pool changed at its source.{" "}
          <Link href={`/pools/${pool.supersededBy}`} className="underline">
            Replaced by {pool.supersededBy}
          </Link>
          .
        </Notice>
      ) : null}
      {notes ? (
        <Card title="Notes">
          <p className="whitespace-pre-line">{notes}</p>
        </Card>
      ) : null}
      <Card title="Maps">
        <PoolSlotTable slots={pool.sourceSlots} maps={maps} />
      </Card>
      <Card title="Sources">
        <PoolSources sources={pool.sources} formerSources={pool.formerSources} />
      </Card>
    </article>
  );
}
