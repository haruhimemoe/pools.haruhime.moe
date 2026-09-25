/**
 * @file src/app/admin/page.tsx
 * @desc /admin: the newest import reports, how many pools sit in each sync state, the retry
 *       buttons, the public pages refresh (for after an import), and a link to every pool. Admins
 *       only (sign-in otherwise); never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { ImportReportList } from "@/components/admin/ImportReportList";
import { RefreshPagesButton } from "@/components/admin/RefreshPagesButton";
import { RetrySyncButtons } from "@/components/admin/RetrySyncButtons";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/lib/auth-session";
import { countSyncStates } from "@/services/admin";
import { listImportReports } from "@/services/imports";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const admin = await requireAdmin("/admin");
  const [reports, states] = await Promise.all([listImportReports(20), countSyncStates()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin"
        meta={`Signed in as ${admin.username}`}
        actions={
          <>
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
