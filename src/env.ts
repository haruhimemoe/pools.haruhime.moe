/**
 * @file src/env.ts
 * @desc Server environment, validated with zod on first use (not at import), so `next build` and
 *       the public pages build without auth variables. SKIP_ENV_VALIDATION=true (CI) swaps
 *       missing values for placeholders nothing connects with; a production server
 *       (VERCEL_ENV=production when VERCEL_ENV is set, else NODE_ENV=production; never during
 *       `next build`) refuses that when a secret would be one of these public placeholders.
 *       ADMIN_OSU_IDS, PACKS_URL, POOLS_SERVICE_TOKEN and POOLS_ALLOW_SHARED_DB_USER are read on
 *       every call by their own getters, so a missing or bad value only breaks what uses it, and
 *       a removed admin id stops working at the next request.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  OSU_CLIENT_ID: z.string().regex(/^\d+$/),
  OSU_CLIENT_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const SERVER_ENV_KEYS = Object.keys(serverEnvSchema.shape) as (keyof ServerEnv)[];

export const ADMIN_OSU_IDS_KEY = "ADMIN_OSU_IDS";
export const PACKS_URL_KEY = "PACKS_URL";
export const POOLS_SERVICE_TOKEN_KEY = "POOLS_SERVICE_TOKEN";
export const POOLS_ALLOW_SHARED_DB_USER_KEY = "POOLS_ALLOW_SHARED_DB_USER";
/** Read on every call by their own getters, never part of getServerEnv. */
export const OPTIONAL_ENV_KEYS = [
  ADMIN_OSU_IDS_KEY,
  PACKS_URL_KEY,
  POOLS_SERVICE_TOKEN_KEY,
  POOLS_ALLOW_SHARED_DB_USER_KEY,
] as const;

export const DEFAULT_PACKS_URL = "https://packs.haruhime.moe";

/** Used only under SKIP_ENV_VALIDATION=true. Nothing connects with these. */
const PLACEHOLDERS: ServerEnv = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  BETTER_AUTH_SECRET: "skip-env-validation-placeholder-secret-000",
  BETTER_AUTH_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "0",
  OSU_CLIENT_SECRET: "placeholder",
};

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

const invalid = (key: string): EnvError =>
  new EnvError(`Missing or invalid environment variables: ${key}. See .env.example.`);

type SecretKey = "BETTER_AUTH_SECRET" | "OSU_CLIENT_SECRET" | "MONGODB_URI";
/** The variables whose placeholder, being in public source, would be a known secret. */
const SECRET_KEYS: readonly SecretKey[] = [
  "BETTER_AUTH_SECRET",
  "OSU_CLIENT_SECRET",
  "MONGODB_URI",
];
/** Set in process.env by `next build` for the whole build, prerendering included. */
const BUILD_PHASE = "phase-production-build";

const isProductionServer = (source: Record<string, string | undefined>): boolean => {
  if (source.NEXT_PHASE === BUILD_PHASE) return false;
  if (source.VERCEL_ENV) return source.VERCEL_ENV === "production";
  return source.NODE_ENV === "production";
};

/**
 * @function assertNoPlaceholderSecrets
 * @param source {Record<string, string | undefined>} usually process.env
 * @param keys {readonly SecretKey[]} the secrets this caller would use (default: all three)
 * @returns {void} nothing unless SKIP_ENV_VALIDATION=true on a production server with one of
 *          those secrets missing or equal to its placeholder
 * @throws {EnvError} naming (never printing) each such secret
 */
export const assertNoPlaceholderSecrets = (
  source: Record<string, string | undefined>,
  keys: readonly SecretKey[] = SECRET_KEYS,
): void => {
  if (source.SKIP_ENV_VALIDATION !== "true") return;
  if (!isProductionServer(source)) return;
  const placeholders = keys.filter((key) => {
    const value = source[key]?.trim();
    return !value || value === PLACEHOLDERS[key];
  });
  if (placeholders.length === 0) return;
  throw new EnvError(
    `SKIP_ENV_VALIDATION is set on a production server, so ${placeholders.join(", ")} would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.`,
  );
};

/**
 * @function parseServerEnv
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {ServerEnv} the server variables, trimmed
 * @throws {EnvError} naming (never printing) each missing or invalid variable
 */
export const parseServerEnv = (source: Record<string, string | undefined>): ServerEnv => {
  const present: Partial<Record<keyof ServerEnv, string>> = {};
  for (const key of SERVER_ENV_KEYS) {
    const value = source[key]?.trim();
    if (value) present[key] = value;
  }
  if (source.SKIP_ENV_VALIDATION === "true") {
    assertNoPlaceholderSecrets(source);
    return { ...PLACEHOLDERS, ...present };
  }
  const parsed = serverEnvSchema.safeParse(present);
  if (parsed.success) return parsed.data;
  const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  throw new EnvError(
    `Missing or invalid environment variables: ${names.join(", ")}. See .env.example.`,
  );
};

const databaseEnvSchema = serverEnvSchema.pick({ MONGODB_URI: true });

/**
 * @function parseDatabaseEnv
 * @param source {Record<string, string | undefined>} usually process.env
 * @returns {{ MONGODB_URI: string }} just the database URI, trimmed (the importer and the public
 *          pages need nothing else)
 * @throws {EnvError} naming (never printing) MONGODB_URI when it's missing or invalid
 */
export const parseDatabaseEnv = (
  source: Record<string, string | undefined>,
): Pick<ServerEnv, "MONGODB_URI"> => {
  const value = source.MONGODB_URI?.trim() || undefined;
  if (source.SKIP_ENV_VALIDATION === "true") {
    assertNoPlaceholderSecrets(source, ["MONGODB_URI"]);
    return { MONGODB_URI: value ?? PLACEHOLDERS.MONGODB_URI };
  }
  const parsed = databaseEnvSchema.safeParse({ MONGODB_URI: value });
  if (parsed.success) return parsed.data;
  throw invalid("MONGODB_URI");
};

/**
 * @function getDatabaseUri
 * @returns {string} MONGODB_URI from process.env, validated on its own
 * @throws {EnvError} when it's missing or invalid
 */
export const getDatabaseUri = (): string => parseDatabaseEnv(process.env).MONGODB_URI;

let cached: ServerEnv | null = null;

/**
 * @function getServerEnv
 * @returns {ServerEnv} process.env, validated once and memoized
 * @throws {EnvError} when a variable is missing or invalid
 */
export const getServerEnv = (): ServerEnv => {
  cached ??= parseServerEnv(process.env);
  return cached;
};

/**
 * @function isEnvValidationSkipped
 * @returns {boolean} true in CI builds (SKIP_ENV_VALIDATION=true), where nothing may query the
 *          database: public pages then prerender empty
 */
export const isEnvValidationSkipped = (): boolean => process.env.SKIP_ENV_VALIDATION === "true";

const readOptional = (key: string): string | undefined => process.env[key]?.trim() || undefined;

const ADMIN_IDS = /^\d+(\s*,\s*\d+)*$/;

/**
 * @function getAdminOsuIds
 * @returns {ReadonlySet<number>} ADMIN_OSU_IDS read now (never memoized); empty when unset
 * @throws {EnvError} naming (never printing) ADMIN_OSU_IDS when it isn't a comma-separated id list
 */
export const getAdminOsuIds = (): ReadonlySet<number> => {
  const raw = readOptional(ADMIN_OSU_IDS_KEY);
  if (raw === undefined) return new Set();
  if (!ADMIN_IDS.test(raw)) throw invalid(ADMIN_OSU_IDS_KEY);
  return new Set(raw.split(",").map((part) => Number(part.trim())));
};

/** Where pools reaches packs and the token it sends. */
export type PacksService = { url: string; token: string };

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

const packsOrigin = (raw: string | undefined): string => {
  if (raw === undefined) return DEFAULT_PACKS_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid(PACKS_URL_KEY);
  }
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw invalid(PACKS_URL_KEY);
  }
  return url.origin;
};

/**
 * @function getPacksService
 * @returns {PacksService | null} PACKS_URL (default packs.haruhime.moe, an origin only) and
 *          POOLS_SERVICE_TOKEN read now; null while the token isn't set
 * @throws {EnvError} naming (never printing) PACKS_URL when it isn't an https origin (http only on
 *         localhost), or POOLS_SERVICE_TOKEN when it's shorter than 32 characters
 */
export const getPacksService = (): PacksService | null => {
  const url = packsOrigin(readOptional(PACKS_URL_KEY));
  const token = readOptional(POOLS_SERVICE_TOKEN_KEY);
  if (token === undefined) return null;
  if (token.length < 32) throw invalid(POOLS_SERVICE_TOKEN_KEY);
  return { url, token };
};

/**
 * @function getAllowSharedDbUser
 * @returns {boolean} true only when POOLS_ALLOW_SHARED_DB_USER is "true" (read now, trimmed):
 *          the start-up check then allows a database user that reaches other databases too.
 *          Unset, blank or any other value keeps the strict check.
 */
export const getAllowSharedDbUser = (): boolean =>
  readOptional(POOLS_ALLOW_SHARED_DB_USER_KEY) === "true";
