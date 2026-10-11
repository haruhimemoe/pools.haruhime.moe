/**
 * @file src/components/pools/PoolView.tsx
 * @desc A pool page: name, tournament · round · year, map count and badged (when known), Open in
 *       packs, "Start from this pool" (a plain link to /new?from=<id>: the page stays cookie-free,
 *       and /new asks a visitor to sign in), the notes shown (an admin's or the source's), "Replaced by" when superseded, the
 *       maps with their values under each slot's mods, and the sources. The admin preview adds a hidden notice. Presentational: the page
 *       loads the data and builds the packs link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

import { ButtonLink, Card, Notice, PageHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PoolSlotTable } from "@/components/pools/PoolSlotTable";
import { PoolSources } from "@/components/pools/PoolSources";
import type { StoredPool } from "@/schemas/pool";
import type { MapSummary } from "@/services/pools";
import { startFromHref } from "@/utils/pool-links";
import { shownNotes } from "@/utils/pool-record";
import { badgedText, poolHeadline } from "@/utils/pool-text";
import type { SlotValueAnswer } from "@/utils/slot-values";

type PoolViewProps = {
  pool: StoredPool;
  maps: ReadonlyMap<number, MapSummary>;
  /** Each source slot's values under its mods (src/services/slot-values.ts), in order. */
  values: readonly SlotValueAnswer[];
  openInPacks: string;
  /** The admin preview: hidden pools show, with a notice. */
  preview?: boolean;
};

/**
 * @function PoolView
 * @param props {PoolViewProps} the pool, its maps, values, the packs link and whether it's the
 *        admin preview
 * @returns {JSX.Element} a past pool's page: header, maps, notes, sources, export and history
 */
export function PoolView({ pool, maps, values, openInPacks, preview = false }: PoolViewProps) {
  const t = useTranslations("pools.poolView");
  const notes = shownNotes(pool.notes, pool.edited);
  const count = `${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"}`;
  const badged = badgedText(pool.badged);
  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        title={pool.name}
        lead={poolHeadline(pool)}
        meta={badged ? `${count} · ${badged}` : count}
        actions={
          <>
            <ButtonLink href={openInPacks}>{t("openInPacks")}</ButtonLink>
            {pool.hidden ? null : (
              <ButtonLink href={startFromHref(pool._id)} variant="secondary">
                {t("startFromThisPool")}
              </ButtonLink>
            )}
          </>
        }
      />
      {preview && pool.hidden ? <Notice tone="warning">{t("thisPoolIsHidden")}</Notice> : null}
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
        <Card title={t("notes")}>
          <p className="whitespace-pre-line">{notes}</p>
        </Card>
      ) : null}
      <Card title={t("maps")}>
        <PoolSlotTable slots={pool.sourceSlots} maps={maps} values={values} />
      </Card>
      <Card title={t("sources")}>
        <PoolSources sources={pool.sources} formerSources={pool.formerSources} />
      </Card>
    </article>
  );
}
