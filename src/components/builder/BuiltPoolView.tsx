/**
 * @file src/components/builder/BuiltPoolView.tsx
 * @desc A built pool's page: its name, tournament · round · year, map count and who can see it,
 *       "Download on packs" once its pack is synced, Edit for its owner and editors, a moderation notice when it's hidden, the notes, "Built
 *       by" (owner and editors, linking osu! profiles), the maps with their values under each
 *       slot's mods, and the summary with the content rules check. Presentational; the page loads the pool for the visitor.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { userUrl } from "@haruhimemoe/osu/shapes";
import { ButtonLink, Card, Notice, PageHeader } from "@haruhimemoe/ui";
import { BuiltSlotList } from "@/components/builder/BuiltSlotList";
import { type CheckRules, ContentRulesCheck } from "@/components/builder/ContentRulesCheck";
import { PoolSummary } from "@/components/builder/PoolSummary";
import { VISIBILITY_TEXT } from "@/constants/built-pools";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import { builtHeadline } from "@/utils/pool-text";
import type { SlotValueMap } from "@/utils/slot-values";

type BuiltPoolViewProps = {
  pool: ClientPool;
  maps: BuiltMaps;
  /** Values under each slot's mods. */
  values: SlotValueMap;
  rules: CheckRules;
};

export function BuiltPoolView({ pool, maps, values, rules }: BuiltPoolViewProps) {
  const count = `${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"}`;
  const people = [
    ...(pool.owner ? [{ ...pool.owner, role: "owner" }] : []),
    ...pool.editors.map((editor) => ({ ...editor, role: "editor" })),
  ];
  const download =
    pool.pack.state === "synced" && pool.pack.href ? (
      <ButtonLink key="download" href={pool.pack.href}>
        Download on packs
      </ButtonLink>
    ) : null;
  const edit = pool.access.canEdit ? (
    <ButtonLink key="edit" href={`/pools/${pool.id}/edit`} variant="secondary">
      Edit
    </ButtonLink>
  ) : null;
  return (
    <article className="flex flex-col gap-6">
      <PageHeader
        title={pool.name}
        lead={builtHeadline(pool) || undefined}
        meta={`${count} · ${VISIBILITY_TEXT[pool.visibility].label}`}
        actions={download || edit ? <>{[download, edit]}</> : null}
      />
      {pool.hidden ? (
        <Notice tone="warning">
          Moderators hid this pool. Only its owner, its editors and admins can see it.
        </Notice>
      ) : null}
      {pool.notes ? (
        <Card title="Notes">
          <p className="whitespace-pre-line">{pool.notes}</p>
        </Card>
      ) : null}
      <Card title="Built by">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {people.map((person) => (
            <li key={person.osuId}>
              <a
                href={userUrl(person.osuId)}
                rel="noopener"
                className="font-bold text-c1 hover:underline"
              >
                {person.username}
              </a>{" "}
              <span className="text-c3">{person.role}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Maps">
        <BuiltSlotList pool={pool} maps={maps} values={values} />
      </Card>
      <Card title="Summary">
        <PoolSummary pool={pool} maps={maps} values={values} />
        <h3 className="mt-4 mb-2 font-bold text-c1">Check against the content rules</h3>
        <ContentRulesCheck slots={pool.slots} rules={rules} />
      </Card>
    </article>
  );
}
