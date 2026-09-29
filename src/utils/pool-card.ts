/**
 * @file src/utils/pool-card.ts
 * @desc Link preview cards for pool pages, drawn by @haruhimemoe/brand's ogCard at
 *       /pools/<id>/og.png: what a past or built pool's card says, and the OgImage its page's
 *       metadata links (versioned by a hash of the card's text, so a rename or new stats get past
 *       caches). Past pools and public built pools get one; the rest keep the site's image. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { OgCardOptions } from "@haruhimemoe/brand";
import type { OgImage } from "@haruhimemoe/next-kit/seo";
import { formatRange, formatStars } from "@haruhimemoe/osu/format";

type CardPool = {
  name: string;
  year: number | null;
  slots: readonly { mod: string | null }[];
  stats?: { srMin: number | null; srMax: number | null } | undefined;
};

// Each bucket code once, in slot order ("NM HD HR DT FM TB").
const mods = (slots: CardPool["slots"]): string =>
  [...new Set(slots.flatMap((slot) => (slot.mod ? [slot.mod] : [])))].join(" ");

/**
 * @function poolCard
 * @param pool {CardPool} a past or built pool: name, year, slots and (past pools) stats
 * @param eyebrow {string} the line over the name (default "osu! tournament mappool")
 * @returns {OgCardOptions} the card: the name, then "2025 · 13 maps · 4.55–5.56★ · NM HD HR"
 *          (year, stars and mods when known)
 */
export const poolCard = (pool: CardPool, eyebrow = "osu! tournament mappool"): OgCardOptions => {
  const { srMin, srMax } = pool.stats ?? { srMin: null, srMax: null };
  const parts = [
    pool.year === null ? null : String(pool.year),
    `${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"}`,
    srMin === null || srMax === null ? null : `${formatRange(srMin, srMax, formatStars)}★`,
    mods(pool.slots) || null,
  ];
  return {
    eyebrow,
    title: pool.name,
    subtitle: parts.filter((part): part is string => part !== null).join(" · "),
  };
};

/**
 * @function poolCardImage
 * @param id {string} the pool's id, past ("otdb-98") or built ("b-…")
 * @param card {OgCardOptions} what its card says (poolCard)
 * @returns {OgImage} /pools/<id>/og.png?v=<hash>, 1200×630 PNG, with the card's text as alt
 */
export const poolCardImage = (id: string, card: OgCardOptions): OgImage => {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(card)) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return {
    url: `/pools/${id}/og.png?v=${hash.toString(36)}`,
    width: 1200,
    height: 630,
    alt: `${card.title}: ${card.subtitle}`,
    type: "image/png",
  };
};
