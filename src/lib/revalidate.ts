/**
 * @file src/lib/revalidate.ts
 * @desc Marks the cached public pages an admin change touches as stale (the next visit rebuilds
 *       them): the pools' pages, their maps' pages, the home page, /search (its latest pools),
 *       the sitemap, llms.txt and llms-full.txt (a built pool's change of who sees it marks the
 *       last five). A
 *       badged change can touch many maps' history, so it marks every pool and map page, and so
 *       does the refresh an admin runs after an import. The CDN's copies of /api/search and
 *       /api/check answers can't be marked: they last 5 minutes and are never served stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { revalidatePath } from "next/cache";

const revalidateLists = (): void => {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
  revalidatePath("/llms-full.txt");
};

/**
 * @function revalidateBuiltLists
 * @returns {void} the home page (Recently built), the sitemap and llms.txt marked stale: a built
 *         pool went public, stopped being public, was hidden or was deleted
 */
export const revalidateBuiltLists = (): void => revalidateLists();

/**
 * @function revalidatePoolPages
 * @param poolIds {readonly string[]} pools that changed
 * @param mapIds {readonly number[]} their maps
 * @returns {void}
 */
export const revalidatePoolPages = (
  poolIds: readonly string[],
  mapIds: readonly number[],
): void => {
  for (const id of poolIds) revalidatePath(`/pools/${id}`);
  for (const id of mapIds) revalidatePath(`/maps/${id}`);
  revalidateLists();
};

/**
 * @function revalidateAllPoolAndMapPages
 * @returns {void} marks every pool and map page stale
 */
export const revalidateAllPoolAndMapPages = (): void => {
  revalidatePath("/pools/[id]", "page");
  revalidatePath("/maps/[id]", "page");
  revalidateLists();
};
