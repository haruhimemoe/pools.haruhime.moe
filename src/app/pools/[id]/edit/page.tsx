/**
 * @file src/app/pools/[id]/edit/page.tsx
 * @desc /pools/<id>/edit: the pool editor, for the pool's owner and editors. A visitor who isn't
 *       signed in is sent to sign in and back (for any id, so nothing about the pool shows);
 *       every other signed-in user, admins included, gets the site 404, as does an id that
 *       isn't a built pool's. Reads the session, so it's rendered per request; never indexed.
 *       Each slot's values under its mods are read with the pool; a pack still waiting to sync
 *       to packs syncs after the page is sent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PoolEditor } from "@/components/builder/PoolEditor";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { requireUser } from "@/lib/auth-session";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { loadBuiltPoolFor } from "@/services/built-pool-maps";
import { builtSlotValues } from "@/services/slot-values";
import { packWaiting } from "@/utils/built-pack";
import { candidateSlots } from "@/utils/candidate-view";

/** The editor's title; it's never indexed. */
export const metadata: Metadata = { title: "Edit a pool", robots: { index: false } };

/**
 * @function EditPoolPage
 * @param props {PageProps<"/pools/[id]/edit">} the built pool's id
 * @returns {Promise<JSX.Element>} the editor for its owner and editors; a visitor goes to sign in,
 *          anyone else gets a 404
 */
export default async function EditPoolPage({ params }: PageProps<"/pools/[id]/edit">) {
  const { id } = await params;
  if (!BUILT_POOL_ID_PATTERN.test(id)) notFound();
  const user = await requireUser(`/pools/${id}/edit`);
  const loaded = await loadBuiltPoolFor(id, user, { candidates: true });
  if (!loaded?.pool.access.canEdit) notFound();
  if (packWaiting(loaded.pool.pack)) schedulePackSync(id);
  // An incomplete read (the mirror failed, met the deadline or is cooling down) is asked again.
  const slots = [...loaded.pool.slots, ...candidateSlots(loaded.pool.candidates)];
  const { values, complete } = await builtSlotValues({ ...loaded.pool, slots }, loaded.maps);
  return (
    <PoolEditor
      initial={loaded.pool}
      maps={loaded.maps}
      values={values}
      valuesComplete={complete}
      me={user.osuId}
      rules={{
        contentUsage: RULE_LINKS.contentUsage,
        officialSupport: RULE_LINKS.officialSupport,
        project: UPSTREAM.repo,
      }}
    />
  );
}
