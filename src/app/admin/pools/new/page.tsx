/**
 * @file src/app/admin/pools/new/page.tsx
 * @desc /admin/pools/new: an admin adds a pool a tournament's hosts or a community member sent
 *       (AddPoolForm). Admins only (sign-in otherwise); never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sun Oct 11, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddPoolForm } from "@/components/admin/AddPoolForm";
import { SEO_SITE } from "@/constants/seo";
import { requireAdmin } from "@/lib/auth-session";

/** The add-a-pool page's title; it's never indexed. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/admin/pools/new",
  title: "Add a pool",
  index: false,
});

/**
 * @function AddPoolPage
 * @returns {Promise<JSX.Element>} the admin's form for a host or community pool
 */
export default async function AddPoolPage() {
  const t = await getTranslations("pools.pages.adminPoolsNew");
  await requireAdmin("/admin/pools/new");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("addAPool")} lead={t("aPoolATournament")} />
      <Card title={t("pool")}>
        <AddPoolForm />
      </Card>
    </div>
  );
}
