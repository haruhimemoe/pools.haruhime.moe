/**
 * @file src/app/admin/page.tsx
 * @desc /admin: the newest import reports, how many pools sit in each sync state, the retry
 *       buttons, how many pack removals wait for packs and "Retry pack cleanup", the newest 50
 *       unlisted and public built pools with hide, unhide and delete (what happened said in one
 *       live region that outlives a deleted row), the public pages refresh (for after an
 *       import), and links to add a pool and to every pool. Admins only (sign-in otherwise);
 *       never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { AdminBuiltPoolTable } from "@/components/admin/AdminBuiltPoolTable";
import { BuiltModerationArea } from "@/components/admin/BuiltModerationArea";
import { ImportReportList } from "@/components/admin/ImportReportList";
import { RefreshPagesButton } from "@/components/admin/RefreshPagesButton";
import { RetryPackCleanupButton } from "@/components/admin/RetryPackCleanupButton";
import { RetrySyncButtons } from "@/components/admin/RetrySyncButtons";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/lib/auth-session";
import { countSyncStates } from "@/services/admin";
import { ADMIN_BUILT_LIMIT, listRecentBuiltPools } from "@/services/built-moderation";
import { listImportReports } from "@/services/imports";
import { countPackCleanup } from "@/services/pack-cleanup";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const [reports, states, waiting, built] = await Promise.all([
    listImportReports(20),
    countSyncStates(),
    countPackCleanup(),
    listRecentBuiltPools(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin"
        meta={`Signed in as ${admin.username}`}
        actions={
          <>
            <ButtonLink href="/admin/pools/new" variant="secondary">
              Add a pool
            </ButtonLink>
            <ButtonLink href="/admin/pools" variant="secondary">
              Every pool
            </ButtonLink>
            <SignOutButton />
          </>
        }
      />
      <Card title="Packs sync">
        <p className="mb-3 text-c2 text-sm">
          {Object.entries(states)
            .map(([state, count]) => `${count} ${state === "never" ? "never sent" : state}`)
            .join(" · ")}
        </p>
        <RetrySyncButtons />
        <h3 className="mt-4 mb-1 font-bold text-c1">Pack cleanup</h3>
        <p className="mb-3 text-c2 text-sm">
          {waiting === 1
            ? "1 pack removal waits for packs."
            : `${waiting} pack removals wait for packs.`}{" "}
          A built pool that went private or was deleted while packs didn't answer loses its pack
          here, and every sync run tries a few of these too.
        </p>
        <RetryPackCleanupButton />
      </Card>
      <Card title="Built pools">
        <p className="mb-3 text-c2 text-sm">
          The {ADMIN_BUILT_LIMIT} newest unlisted and public ones (a private pool stays between its
          owner and editors). Hiding one takes it off search, the sitemap and its public page (its
          owner and editors still see it) and unlists its pack on packs. Deleting removes it and its
          pack for good.
        </p>
        <BuiltModerationArea>
          <AdminBuiltPoolTable pools={built} />
        </BuiltModerationArea>
      </Card>
      <Card title="Public pages">
        <p className="mb-3 text-c2 text-sm">
          After an import, refresh them so the home page, the sitemap and llms.txt show it now.
          Otherwise the home page catches up within the hour and the other two within a day.
        </p>
        <RefreshPagesButton />
      </Card>
      <Card title="Imports">
        <ImportReportList reports={reports} />
      </Card>
    </div>
  );
}
