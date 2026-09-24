/**
 * @file src/lib/revalidate.ts
 * @desc Marks the cached public pages an admin change touches as stale (the next visit rebuilds
 *       them): the pools' pages, their maps' pages, the home page, the sitemap and llms.txt. A
 *       badged change can touch many maps' history, so it marks every pool and map page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { revalidatePath } from "next/cache";

const revalidateLists = (): void => {
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
};

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
