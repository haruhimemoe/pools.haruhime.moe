/**
 * @file src/app/pools/[id]/edit/page.tsx
 * @desc /pools/<id>/edit: the pool editor, for the pool's owner and editors. A visitor who isn't
 *       signed in is sent to sign in and back (for any id, so nothing about the pool shows);
 *       every other signed-in user, admins included, gets the site 404, as does an id that
 *       isn't a built pool's. Reads the session, so it's rendered per request; never indexed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PoolEditor } from "@/components/builder/PoolEditor";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { requireUser } from "@/lib/auth-session";
import { loadBuiltPoolFor } from "@/services/built-pool-maps";

export const metadata: Metadata = { title: "Edit a pool", robots: { index: false } };

export default async function EditPoolPage({ params }: PageProps<"/pools/[id]/edit">) {
  const { id } = await params;
  if (!BUILT_POOL_ID_PATTERN.test(id)) notFound();
  const user = await requireUser(`/pools/${id}/edit`);
  const loaded = await loadBuiltPoolFor(id, user);
  if (!loaded?.pool.access.canEdit) notFound();
  return (
    <PoolEditor
      initial={loaded.pool}
      maps={loaded.maps}
      me={user.osuId}
      rules={{
        contentUsage: RULE_LINKS.contentUsage,
        officialSupport: RULE_LINKS.officialSupport,
        project: UPSTREAM.repo,
      }}
    />
  );
}
