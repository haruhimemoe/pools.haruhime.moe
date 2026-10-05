/**
 * @file src/app/pools/[id]/history/page.tsx
 * @desc /pools/<id>/history: a built pool's version history. Owner and editors always see it;
 *       anyone who can see the pool sees it too once the owner makes it public (not while the
 *       pool is private or hidden); admins see it for moderation. A pool the caller can't see at
 *       all is the site 404; one whose history is private to them says so. Sits beside /edit (not
 *       behind the b- rewrite), so past pool pages stay cookie-free. Reads the session, so it's
 *       rendered per request; never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { EmptyState, LinkRow, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChangeList } from "@/components/history/ChangeList";
import { HistoryTable } from "@/components/history/HistoryTable";
import { HistoryVisibilityForm } from "@/components/history/HistoryVisibilityForm";
import { RevertButton } from "@/components/history/RevertButton";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { HISTORY_COPY } from "@/constants/history";
import { getCurrentUser } from "@/lib/auth-session";
import { loadPoolHistory, loadPoolRevision } from "@/services/built-pool-history-read";
import { seqParam } from "@/utils/history-params";
import { poolChangeLines } from "@/utils/pool-changes";

/** The page's title; history is never indexed. */
export const metadata: Metadata = { title: "Pool history", robots: { index: false } };

/**
 * @function PoolHistoryPage
 * @param props {PageProps<"/pools/[id]/history">} the pool id, and `rev` and `before` from the
 *        query
 * @returns {Promise<JSX.Element>} the versions and one version's changes; a private history says
 *          so; a pool the caller can't see is a 404
 */
export default async function PoolHistoryPage({
  params,
  searchParams,
}: PageProps<"/pools/[id]/history">) {
  const { id } = await params;
  if (!BUILT_POOL_ID_PATTERN.test(id)) notFound();
  const query = await searchParams;
  const caller = await getCurrentUser();
  const history = await loadPoolHistory(id, caller, seqParam(query.before));
  if (!history.ok) {
    if (history.status !== 403) notFound();
    return (
      <EmptyState title={HISTORY_COPY.privateTitle} variant="filled">
        {HISTORY_COPY.privateBody}
      </EmptyState>
    );
  }
  const { pool, access, revisions, older, historyPublic } = history.value;
  const selected = typeof query.rev === "string" ? query.rev : revisions[0]?.id;
  const shown = selected ? await loadPoolRevision(id, caller, selected) : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`History of ${pool.name}`} />
      <LinkRow
        items={[
          { href: `/pools/${id}`, label: "Back to the pool" },
          ...(access.canRevert ? [{ href: `/pools/${id}/edit`, label: "Edit" }] : []),
        ]}
      />
      {access.canToggle ? (
        <HistoryVisibilityForm poolId={id} historyPublic={historyPublic} />
      ) : null}
      {shown?.ok ? (
        <ChangeList
          revision={shown.value.revision}
          lines={
            shown.value.before
              ? poolChangeLines(shown.value.changes, shown.value.before, shown.value.after)
              : null
          }
          action={
            access.canRevert && shown.value.revision.id !== revisions[0]?.id ? (
              <RevertButton poolId={id} revisionId={shown.value.revision.id} />
            ) : null
          }
        />
      ) : null}
      <HistoryTable poolId={id} revisions={revisions} selected={selected} older={older} />
    </div>
  );
}
