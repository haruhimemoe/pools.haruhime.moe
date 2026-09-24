/**
 * @file src/lib/api.ts
 * @desc Shared pieces for our JSON route handlers: { error: { code, message } } responses,
 *       no-store, body parsing (application/json only, so a cross-site form can't send it
 *       without a CORS preflight, and at most 16 KB), and the same-origin guard every admin
 *       mutation runs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { z } from "zod";
import { SITE } from "@/constants/site";

/** An admin edit is well under 3 KB of JSON. */
export const MAX_BODY_BYTES = 16_384;

/** Stable machine codes per status. Messages are for people and may change; codes don't. */
export const ERROR_CODES = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
  500: "internal_error",
  502: "upstream_error",
  503: "unavailable",
} as const satisfies Record<number, string>;

/**
 * @function errorCodeFor
 * @param status {number} HTTP status
 * @returns {string} its code from ERROR_CODES; otherwise "internal_error" for 5xx, "bad_request"
 */
export const errorCodeFor = (status: number): string =>
  (ERROR_CODES as Record<number, string>)[status] ??
  (status >= 500 ? "internal_error" : "bad_request");

/**
 * @function jsonError
 * @param status {number} HTTP status
 * @param message {string} shown to the person
 * @param code {string} machine code (default: from the status)
 * @returns {Response} `{ error: { code, message } }` JSON
 */
export const jsonError = (
  status: number,
  message: string,
  code: string = errorCodeFor(status),
): Response => Response.json({ error: { code, message } }, { status });

/**
 * @function noStore
 * @param response {Response} a response with mutable headers
 * @returns {Response} the same response, never cached
 */
export const noStore = (response: Response): Response => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

/**
 * @function parseJsonBody
 * @param request {Request} incoming request
 * @param schema {z.ZodType} what the body must be
 * @param options {{ tooLarge?: string }} the 413 message
 * @returns {Promise<{ ok: true; data } | { ok: false; response }>} parsed data or a ready
 *          error response
 */
export const parseJsonBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
  { tooLarge = "That request is too large." }: { tooLarge?: string } = {},
): Promise<{ ok: true; data: z.output<T> } | { ok: false; response: Response }> => {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("application/json")) {
    return { ok: false, response: jsonError(415, "Send the request as JSON.") };
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, tooLarge) };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "That request wasn't valid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, parsed.error.issues[0]?.message ?? "That request isn't valid."),
    };
  }
  return { ok: true, data: parsed.data };
};

export const CROSS_SITE_REFUSED = `This request has to come from ${SITE.title} itself.`;

const SITE_ORIGIN = new URL(SITE.url).origin;
/** Sec-Fetch-Site values that mean another site (or a sibling *.haruhime.moe host) sent it. */
const FOREIGN_FETCH_SITES: ReadonlySet<string> = new Set(["cross-site", "same-site"]);

/**
 * @function refuseCrossSite
 * @param request {Request} an admin mutation (cookie-authenticated)
 * @returns {Response | null} 403 when Origin is present and isn't this request's own origin or
 *          the site's, or when Sec-Fetch-Site says cross-site or same-site (packs.haruhime.moe is
 *          another site for us); otherwise null
 */
export const refuseCrossSite = (request: Request): Response | null => {
  const origin = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;
  const foreignOrigin = origin !== null && origin !== ownOrigin && origin !== SITE_ORIGIN;
  const fetchSite = request.headers.get("sec-fetch-site");
  const foreignFetch = fetchSite !== null && FOREIGN_FETCH_SITES.has(fetchSite);
  return foreignOrigin || foreignFetch ? jsonError(403, CROSS_SITE_REFUSED) : null;
};
