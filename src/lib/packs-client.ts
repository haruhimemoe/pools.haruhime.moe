/**
 * @file src/lib/packs-client.ts
 * @desc pools' calls to packs' service endpoint, all with POOLS_SERVICE_TOKEN as a Bearer
 *       token and our User-Agent: PUT /api/service/pools/{id} with a pack input, DELETE
 *       /api/service/pools/{ref} for a built pool's pack (204 removed and packs' own 404, code
 *       not_found, are both done, so is 410, a pack packs' moderators already removed; a 404
 *       without that code comes from something else, a wrong PACKS_URL or a proxy, and is an
 *       error), and POST
 *       /api/service/pools/stats for one stats backfill batch. Each answer is sorted into what
 *       pools does next: 401, or 503 with code not_configured, is a configuration problem;
 *       410 is gone; 429, any other 5xx, a timeout or a network error is a retryable error
 *       (with packs' Retry-After); any other 4xx is a rejection with packs' message. Error
 *       bodies may be { error: { code, message } }, { code, message }, or not JSON at all.
 *       Never throws. The token is never logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { parseRetryAfter } from "@haruhimemoe/hinai";
import { z } from "zod";
import { SERVER_USER_AGENT } from "@/constants/site";
import type { PacksService } from "@/env";
import type { PackInput } from "@/utils/pack-input";
import type { SyncAnswer } from "@/utils/sync";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** A PUT validates, writes and revalidates on packs: a few seconds at most. */
export const PACKS_TIMEOUT_MS = 15_000;
/** One stats batch looks up to 20 ratings on osu!. */
export const STATS_TIMEOUT_MS = 60_000;

const okSchema = z.object({
  slug: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/),
  state: z.enum(["created", "updated", "unchanged"]),
  listed: z.boolean(),
});

const statsSchema = z.object({
  updated: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});

const errorBodySchema = z.object({
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

type ErrorInfo = { code: string | null; message: string | null };

const errorInfo = (body: unknown): ErrorInfo => {
  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success) return { code: null, message: null };
  return {
    code: parsed.data.error?.code ?? parsed.data.code ?? null,
    message: parsed.data.error?.message ?? parsed.data.message ?? null,
  };
};

const readBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const headersFor = (service: PacksService, json: boolean): Record<string, string> => ({
  Authorization: `Bearer ${service.token}`,
  Accept: "application/json",
  "User-Agent": SERVER_USER_AGENT,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

/** "packs answered 500: Oops." (one closing period, whether or not packs' message has one). */
const answeredWith = (status: number, message: string | null): string => {
  const text = message ? `packs answered ${status}: ${message}` : `packs answered ${status}`;
  return /[.!?]$/u.test(text) ? text : `${text}.`;
};

/** A non-2xx answer's class, or null for a 2xx. */
const failureOf = (
  response: Response,
  info: ErrorInfo,
): Exclude<SyncAnswer, { kind: "ok" }> | null => {
  const { status } = response;
  if (status === 401) {
    return {
      kind: "config",
      message: "packs refused the service token (401). Check POOLS_SERVICE_TOKEN in both apps.",
    };
  }
  if (status === 503 && info.code === "not_configured") {
    return { kind: "config", message: "packs has no service token set up (503 not_configured)." };
  }
  if (status === 410) return { kind: "gone" };
  if (status === 429 || status >= 500) {
    return {
      kind: "error",
      message: answeredWith(status, info.message),
      retryAfterMs: parseRetryAfter(response.headers.get("retry-after"), Date.now()),
    };
  }
  if (status >= 400) {
    return { kind: "rejected", status, message: info.message ?? `packs answered ${status}.` };
  }
  return null;
};

/**
 * @function putPoolPack
 * @param service {PacksService} packs' address and the token
 * @param id {string} the pool id (packs' ref for it)
 * @param input {PackInput} the pack input
 * @param options {{ fetch?: Fetch; timeoutMs?: number }} fetch and timeout (tests)
 * @returns {Promise<SyncAnswer>} what packs said, sorted
 */
export const putPoolPack = async (
  service: PacksService,
  id: string,
  input: PackInput,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = PACKS_TIMEOUT_MS,
  }: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<SyncAnswer> => {
  let response: Response;
  try {
    response = await doFetch(`${service.url}/api/service/pools/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: headersFor(service, true),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      kind: "error",
      message: `Couldn't reach packs: ${messageOf(error)}`,
      retryAfterMs: null,
    };
  }
  const body = await readBody(response);
  const failure = failureOf(response, errorInfo(body));
  if (failure) return failure;
  const parsed = okSchema.safeParse(body);
  if ((response.status === 200 || response.status === 201) && parsed.success) {
    return { kind: "ok", ...parsed.data };
  }
  return {
    kind: "error",
    message: `packs answered ${response.status} with a body pools can't read.`,
    retryAfterMs: null,
  };
};

export type BackfillAnswer =
  | { kind: "ok"; updated: number; remaining: number }
  | { kind: "error"; message: string }
  | { kind: "config"; message: string };

/**
 * @function postStatsBackfill
 * @param service {PacksService} packs' address and the token
 * @param options {{ fetch?: Fetch; timeoutMs?: number }} fetch and timeout (tests)
 * @returns {Promise<BackfillAnswer>} one stats batch's counts, or why not
 */
export const postStatsBackfill = async (
  service: PacksService,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = STATS_TIMEOUT_MS,
  }: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<BackfillAnswer> => {
  let response: Response;
  try {
    response = await doFetch(`${service.url}/api/service/pools/stats`, {
      method: "POST",
      headers: headersFor(service, false),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { kind: "error", message: `Couldn't reach packs: ${messageOf(error)}` };
  }
  const body = await readBody(response);
  const failure = failureOf(response, errorInfo(body));
  if (failure?.kind === "config") return failure;
  if (failure) {
    return {
      kind: "error",
      message: "message" in failure ? failure.message : `packs answered ${response.status}.`,
    };
  }
  const parsed = statsSchema.safeParse(body);
  if (parsed.success) return { kind: "ok", ...parsed.data };
  return {
    kind: "error",
    message: `packs answered ${response.status} with a body pools can't read.`,
  };
};

export type DeleteAnswer =
  | { kind: "ok" }
  | { kind: "error"; message: string }
  | { kind: "config"; message: string };

/** Statuses that mean the pack is gone: removed now, or removed by a moderator. */
const DELETED_STATUSES: ReadonlySet<number> = new Set([204, 410]);

/**
 * @function deletePack
 * @param service {PacksService} packs' address and the token
 * @param ref {string} the pool id (packs' ref for its pack)
 * @param options {{ fetch?: Fetch; timeoutMs?: number }} fetch and timeout (tests)
 * @returns {Promise<DeleteAnswer>} ok once packs has no pack for the ref, or why not
 */
export const deletePack = async (
  service: PacksService,
  ref: string,
  {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = PACKS_TIMEOUT_MS,
  }: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<DeleteAnswer> => {
  let response: Response;
  try {
    response = await doFetch(`${service.url}/api/service/pools/${encodeURIComponent(ref)}`, {
      method: "DELETE",
      headers: headersFor(service, false),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { kind: "error", message: `Couldn't reach packs: ${messageOf(error)}` };
  }
  if (DELETED_STATUSES.has(response.status)) return { kind: "ok" };
  const info = errorInfo(await readBody(response));
  // Only packs' own 404 says there's no pack; any other 404 never reached packs' route.
  if (response.status === 404 && info.code === "not_found") return { kind: "ok" };
  const failure = failureOf(response, info);
  if (failure?.kind === "config") return failure;
  return { kind: "error", message: answeredWith(response.status, info.message) };
};
