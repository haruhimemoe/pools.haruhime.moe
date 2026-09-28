/**
 * @file src/env.ts
 * @desc pools' server environment, wired from @haruhimemoe/next-kit/env: the osu! app's five
 *       variables, validated with zod on first use (not at import), so `next build` and the
 *       public pages build without them. SKIP_ENV_VALIDATION=true (CI) swaps missing values for
 *       placeholders nothing connects with, and a production server refuses that when a secret
 *       would be one of them. ADMIN_OSU_IDS, PACKS_URL, POOLS_SERVICE_TOKEN and
 *       POOLS_ALLOW_SHARED_DB_USER are read on every call by their own getters, so a missing or
 *       bad value only breaks what uses it, and a removed admin id stops working at the next
 *       request. Errors name variables and never print values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import {
  createServerEnv,
  OSU_APP_PLACEHOLDERS,
  OSU_APP_SECRET_KEYS,
  type OsuAppEnv,
  optionalSecret,
  osuAppEnvSchema,
  readFlag,
  readIdSet,
  readOrigin,
} from "@haruhimemoe/next-kit/env";

/** The variables every server request needs. */
export type ServerEnv = OsuAppEnv;

const serverEnv = createServerEnv({
  schema: osuAppEnvSchema,
  placeholders: OSU_APP_PLACEHOLDERS,
  secretKeys: OSU_APP_SECRET_KEYS,
});

/** Every variable in ServerEnv, for .env.example's test. */
export const SERVER_ENV_KEYS = serverEnv.keys;

export const ADMIN_OSU_IDS_KEY = "ADMIN_OSU_IDS";
export const PACKS_URL_KEY = "PACKS_URL";
export const POOLS_SERVICE_TOKEN_KEY = "POOLS_SERVICE_TOKEN";
export const POOLS_ALLOW_SHARED_DB_USER_KEY = "POOLS_ALLOW_SHARED_DB_USER";
/** The variables read on every call, for .env.example's test. */
export const OPTIONAL_ENV_KEYS = [
  ADMIN_OSU_IDS_KEY,
  PACKS_URL_KEY,
  POOLS_SERVICE_TOKEN_KEY,
  POOLS_ALLOW_SHARED_DB_USER_KEY,
] as const;

export const DEFAULT_PACKS_URL = "https://packs.haruhime.moe";

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
