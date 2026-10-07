/**
 * @file src/env.ts
 * @desc pools' server environment, wired from @haruhimemoe/next-kit/env: the osu! app's
 *       variables minus BETTER_AUTH_URL (MONGODB_URI, BETTER_AUTH_SECRET shared with the
 *       haruhime.moe hub to verify its session cookie, and OSU_CLIENT_ID/OSU_CLIENT_SECRET for
 *       osu! API client credentials; sign-in itself runs only on the hub), validated with zod on
 *       first use (not at import), so `next build` and the public pages build without them. SKIP_ENV_VALIDATION=true (CI) swaps missing values for
 *       placeholders nothing connects with, and a production server refuses that when a secret
 *       would be one of them. ADMIN_OSU_IDS, PACKS_URL, POOLS_SERVICE_TOKEN,
 *       POOLS_ALLOW_SHARED_DB_USER and HUB_URL are read on every call by their own getters, so a missing or
 *       bad value only breaks what uses it, and a removed admin id stops working at the next
 *       request. Errors name variables and never print values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import {
  createServerEnv,
  OSU_APP_PLACEHOLDERS,
  OSU_APP_SECRET_KEYS,
  optionalSecret,
  osuAppEnvSchema,
  readFlag,
  readIdSet,
  readOptional,
  readOrigin,
} from "@haruhimemoe/next-kit/env";
import type { z } from "zod";

/** next-kit's osu! app schema without BETTER_AUTH_URL: pools runs no better-auth of its own. */
const serverEnvSchema = osuAppEnvSchema.omit({ BETTER_AUTH_URL: true });

/** The variables every server request needs. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const { BETTER_AUTH_URL: _, ...placeholders } = OSU_APP_PLACEHOLDERS;

const serverEnv = createServerEnv({
  schema: serverEnvSchema,
  placeholders,
  secretKeys: OSU_APP_SECRET_KEYS,
});

/** Every variable in ServerEnv, for .env.example's test. */
export const SERVER_ENV_KEYS = serverEnv.keys;

/** The comma-separated osu! ids with admin rights. */
export const ADMIN_OSU_IDS_KEY = "ADMIN_OSU_IDS";
/** packs' origin (packs.haruhime.moe by default). */
export const PACKS_URL_KEY = "PACKS_URL";
/** pools' bearer token for packs' service endpoint. */
export const POOLS_SERVICE_TOKEN_KEY = "POOLS_SERVICE_TOKEN";
/** "true" allows a database user that reaches other databases. */
export const POOLS_ALLOW_SHARED_DB_USER_KEY = "POOLS_ALLOW_SHARED_DB_USER";
/** The haruhime.moe hub's origin: sign-in, the account page and session refreshes live there. */
export const HUB_URL_KEY = "HUB_URL";
/** The hub's account fan-out secret for this app (its ACCOUNT_SECRET_<APP>). */
export const ACCOUNT_FANOUT_SECRET_KEY = "ACCOUNT_FANOUT_SECRET";
/** The variables read on every call, for .env.example's test. */
export const OPTIONAL_ENV_KEYS = [
  ADMIN_OSU_IDS_KEY,
  PACKS_URL_KEY,
  POOLS_SERVICE_TOKEN_KEY,
  POOLS_ALLOW_SHARED_DB_USER_KEY,
  HUB_URL_KEY,
  ACCOUNT_FANOUT_SECRET_KEY,
] as const;

/** packs' origin when PACKS_URL isn't set. */
export const DEFAULT_PACKS_URL = "https://packs.haruhime.moe";

/** The hub's origin when HUB_URL isn't set. */
export const DEFAULT_HUB_URL = "https://www.haruhime.moe";

/** Validates the server variables, trimmed (tests pass their own source). */
export const parseServerEnv = serverEnv.parse;

/** Throws when SKIP_ENV_VALIDATION would put a placeholder secret on a production server. */
export const assertNoPlaceholderSecrets = serverEnv.assertNoPlaceholderSecrets;

/**
 * @function getServerEnv
 * @returns {ServerEnv} process.env, validated once and memoized
 * @throws {EnvError} naming (never printing) each missing or invalid variable
 */
export const getServerEnv = (): ServerEnv => serverEnv.get();

/**
 * @function getDatabaseUri
 * @returns {string} MONGODB_URI from process.env, validated on its own (the importer and the
 *          public pages need nothing else)
 * @throws {EnvError} when it's missing or invalid
 */
export const getDatabaseUri = (): string =>
  serverEnv.pick(process.env, ["MONGODB_URI"]).MONGODB_URI;

/**
 * @function getAdminOsuIds
 * @returns {ReadonlySet<number>} ADMIN_OSU_IDS read now (never memoized); empty when unset
 * @throws {EnvError} naming ADMIN_OSU_IDS when it isn't a comma-separated id list
 */
export const getAdminOsuIds = (): ReadonlySet<number> => readIdSet(ADMIN_OSU_IDS_KEY);

/**
 * @function getHubUrl
 * @returns {string} HUB_URL read now (an origin), or www.haruhime.moe when it's unset
 * @throws {EnvError} naming HUB_URL when it isn't an https origin (http only on localhost)
 */
export const getHubUrl = (): string => readOrigin(HUB_URL_KEY, DEFAULT_HUB_URL);

/** packs' service endpoint: its origin and pools' bearer token. */
export type PacksService = { url: string; token: string };

/**
 * @function getPacksService
 * @returns {PacksService | null} PACKS_URL (default packs.haruhime.moe, an origin only) and
 *          POOLS_SERVICE_TOKEN read now; null while the token isn't set
 * @throws {EnvError} naming PACKS_URL when it isn't an https origin (http only on localhost), or
 *         POOLS_SERVICE_TOKEN when it's shorter than 32 characters
 */
export const getPacksService = (): PacksService | null => {
  const url = readOrigin(PACKS_URL_KEY, DEFAULT_PACKS_URL);
  const token = optionalSecret(POOLS_SERVICE_TOKEN_KEY, 32);
  return token === undefined ? null : { url, token };
};

/**
 * @function getAllowSharedDbUser
 * @returns {boolean} true only when POOLS_ALLOW_SHARED_DB_USER is "true" (read now, trimmed):
 *          the start-up check then allows a database user that reaches other databases too
 */
export const getAllowSharedDbUser = (): boolean => readFlag(POOLS_ALLOW_SHARED_DB_USER_KEY);

/**
 * @function getAccountFanoutSecret
 * @returns {string | undefined} ACCOUNT_FANOUT_SECRET read now; undefined when unset (the
 *          /api/internal/account routes then answer 503 to every call)
 */
export const getAccountFanoutSecret = (): string | undefined =>
  readOptional(ACCOUNT_FANOUT_SECRET_KEY);
