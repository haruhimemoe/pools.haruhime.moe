/**
 * @file src/utils/pool-links.ts
 * @desc Links into the builder that pages share: "Start from this pool" goes to /new?from=<id>,
 *       where a signed-in user makes a private copy of the pool's maps (a visitor is asked to
 *       sign in and comes back). A plain link, so cookie-free pages can carry it. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

/**
 * @function startFromHref
 * @param id {string} a past or built pool's id
 * @returns {string} /new?from=<id>
 */
export const startFromHref = (id: string): string => `/new?from=${encodeURIComponent(id)}`;
