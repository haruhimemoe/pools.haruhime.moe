/**
 * @file src/app/admin/pools/page.tsx
 * @desc /admin/pools?q=&show=&page=: every pool (hidden and superseded included) for admins, 50 a
 *       page, filtered by text and by hidden, superseded or failed syncs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Button, ButtonLink, PageHeader, Select, TextInput } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { AdminPoolTable } from "@/components/admin/AdminPoolTable";
import { MAX_QUERY_LENGTH } from "@/constants/search";
import { requireAdmin } from "@/lib/auth-session";
import { ADMIN_SHOWS, type AdminShow, listPoolsForAdmin } from "@/services/admin-pools";
import { parsePageParam } from "@/utils/search-ranges";

export const metadata: Metadata = { title: "Every pool", robots: { index: false } };

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const SHOW_LABELS: Readonly<Record<AdminShow, string>> = {
  all: "Every pool",
  hidden: "Hidden",
  superseded: "Superseded",
  failed: "Failed or rejected syncs",
};

export default async function AdminPoolsPage({ searchParams }: PageProps<"/admin/pools">) {
  await requireAdmin("/admin/pools");
  const params = await searchParams;
  const q = first(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  const showParam = first(params.show);
  const show: AdminShow = (ADMIN_SHOWS as readonly string[]).includes(showParam)
    ? (showParam as AdminShow)
    : "all";
  const page = parsePageParam(first(params.page) || null);
  const result = await listPoolsForAdmin({ q, show, page });
  const href = (to: number) =>
    `/admin/pools?${new URLSearchParams({ q, show, page: String(to) }).toString()}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Every pool" meta={`${result.total} pools`} />
      <form method="get" className="flex flex-wrap items-end gap-3">
        <TextInput id="admin-q" name="q" label="Search" defaultValue={q} />
        <Select id="admin-show" name="show" label="Show" defaultValue={show}>
          {ADMIN_SHOWS.map((value) => (
            <option key={value} value={value}>
              {SHOW_LABELS[value]}
            </option>
          ))}
        </Select>
        <Button type="submit">Filter</Button>
      </form>
      <AdminPoolTable rows={result.rows} />
      <nav aria-label="Pages" className="flex gap-3">
        {page > 1 ? (
          <ButtonLink href={href(page - 1)} variant="secondary">
            Previous
          </ButtonLink>
        ) : null}
        {page < result.pageCount ? (
          <ButtonLink href={href(page + 1)} variant="secondary">
            Next
          </ButtonLink>
        ) : null}
      </nav>
    </div>
  );
}
