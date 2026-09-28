/**
 * @file src/lib/pool-client.ts
 * @desc The browser's calls to the pool routes: JSON in and out, and every way one can fail
 *       turned into one shape (the route's message, its code, a paste's bad lines, the current
 *       pool on a 409), so the editor never reads a raw Response. No answer at all is status 0.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { SlotLineError } from "@haruhimemoe/pool";
import { type ClientPool, clientPoolOf } from "@/schemas/built-pool-view";

/** fetch, replaced in tests. */
export type Fetcher = typeof fetch;

/** A pool route's refusal, with the pool on a 409 and a paste's lines. */
export type PoolCallFailure = {
  ok: false;
  /** HTTP status; 0 when no answer came. */
  status: number;
  code: string | null;
  message: string;
  lines?: SlotLineError[];
  /** The pool as it is now (a 409). */
  pool?: ClientPool;
};

/** A pool route's answer: its status and body, or the refusal. */
export type PoolCall<T> = { ok: true; status: number; body: T } | PoolCallFailure;

/** Said when pools can't be reached. */
export const UNREACHABLE = "Couldn't reach pools.";

type ErrorBody = {
  error?: { code?: string; message?: string; lines?: SlotLineError[] };
  pool?: ClientPool;
};

/**
 * @function callPools
 * @param fetcher {Fetcher} fetch (tests pass a fake)
 * @param path {string} a same-site path
 * @param init {{ method?: string; body?: unknown }} the method and a JSON body
 * @returns {Promise<PoolCall<T>>} the parsed answer (an empty body for 204), or the failure
 */
export const callPools = async <T>(
  fetcher: Fetcher,
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<PoolCall<T>> => {
  let response: Response;
  try {
    response = await fetcher(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, status: 0, code: null, message: UNREACHABLE };
  }
  const { status } = response;
  let parsed: unknown = null;
  try {
    parsed = status === 204 ? null : await response.json();
  } catch {
    parsed = null;
  }
  if (response.ok) return { ok: true, status, body: parsed as T };
  const error = (parsed ?? {}) as ErrorBody;
  return {
    ok: false,
    status,
    code: error.error?.code ?? null,
    message: error.error?.message ?? `That didn't work (${status}).`,
    ...(error.error?.lines ? { lines: error.error.lines } : {}),
    ...(error.pool ? { pool: clientPoolOf(error.pool) } : {}),
  };
};
