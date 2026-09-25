/**
 * @file src/lib/beta.ts
 * @desc The beta flag: NEXT_PUBLIC_POOLS_BETA="true" marks the site as a beta, shown as a tag
 *       beside the wordmark on every page. It's a public variable, so Next.js writes its value
 *       into the build: changing it needs a new build. Pages stay indexable either way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

/**
 * @function isBeta
 * @returns {boolean} true only when NEXT_PUBLIC_POOLS_BETA is "true" (trimmed); unset, blank or
 *          any other value is off
 */
export const isBeta = (): boolean => process.env.NEXT_PUBLIC_POOLS_BETA?.trim() === "true";
