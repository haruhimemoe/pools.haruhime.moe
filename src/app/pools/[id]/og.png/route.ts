/**
 * @file src/app/pools/[id]/og.png/route.ts
 * @desc GET /pools/<id>/og.png: a pool's link preview card (1200×630 PNG), drawn at request time
 *       by @haruhimemoe/brand's ogCard (resvg, Node.js runtime). Past pools that aren't hidden
 *       and public, unhidden built pools (b- ids; the /pools/<b- id> rewrite matches the page
 *       only) get one; anything else is a 404, and its page keeps the site's image. Reads no
 *       cookies. Pages link it with ?v=<hash of the card's text>, so the CDN keeps it a week.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ogCard, PRODUCTS } from "@haruhimemoe/brand";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { getBuiltPoolFor } from "@/services/built-pool-read";
import { getPublicPool } from "@/services/pools";
import { poolCard } from "@/utils/pool-card";

/** Node.js, not edge: ogCard loads resvg's native binary. */
export const runtime = "nodejs";

// A card for the id, or null when there's no public pool behind it.
const cardFor = async (id: string) => {
  if (!BUILT_POOL_ID_PATTERN.test(id)) {
    const pool = await getPublicPool(id);
    return pool ? poolCard(pool) : null;
  }
  const answer = await getBuiltPoolFor(id, null);
  if (!answer.ok || answer.value.visibility !== "public" || answer.value.hidden) return null;
  return poolCard(answer.value);
};

/**
 * @function GET
 * @param _request {Request} unused
 * @param context {RouteContext<"/pools/[id]/og.png">} the pool's id
 * @returns {Promise<Response>} 200 image/png for a past or public built pool; 404 otherwise
 */
export async function GET(_request: Request, { params }: RouteContext<"/pools/[id]/og.png">) {
  const card = await cardFor((await params).id);
  if (!card) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  }
  return new Response(ogCard(PRODUCTS.pools, card).slice().buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
