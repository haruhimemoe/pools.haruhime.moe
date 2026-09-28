/**
 * @file src/constants/mod-values.ts
 * @desc Values under mods from the hinai mirror's precomputed rosu-pp data: its batch endpoint,
 *       how many ids one call takes, its timeout, how long a page's slot values wait for it, and
 *       how long the mod_values cache keeps a row.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

/** GET ?ids=<comma-separated>&mods=<combo>: stars, AR, OD, CS and BPM under the combo. */
export const PP_BATCH_URL = "https://mirror.hinamizawa.ai/v3/osu/pp/batch";
/** The mirror answers at most this many ids a call. */
export const PP_BATCH_SIZE = 100;
export const PP_BATCH_TIMEOUT_MS = 10_000;
/** A page's slot values wait at most this long for the mirror, over all combos at once. */
export const SLOT_VALUES_DEADLINE_MS = 8_000;

/** A map's values under a combo only change when osu! reworks difficulty: keep them 30 days. */
export const MOD_VALUES_TTL_SECONDS = 30 * 86_400;
