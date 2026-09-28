/**
 * @file src/app/admin/pools/new/page.tsx
 * @desc /admin/pools/new: an admin adds a pool a tournament's hosts or a community member sent
 *       (AddPoolForm). Admins only (sign-in otherwise); never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { AddPoolForm } from "@/components/admin/AddPoolForm";
import { requireAdmin } from "@/lib/auth-session";

/** The add-a-pool page's title; it's never indexed. */
export const metadata: Metadata = { title: "Add a pool", robots: { index: false } };

/**
 * @function AddPoolPage
 * @returns {Promise<JSX.Element>} the admin's form for a host or community pool
 */
export default async function AddPoolPage() {
  await requireAdmin("/admin/pools/new");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add a pool"
        lead="A pool a tournament's hosts or a community member sent. If its maps match a pool we have, the source joins that pool instead of making a second one."
      />
      <Card title="Pool">
        <AddPoolForm />
      </Card>
    </div>
  );
}
