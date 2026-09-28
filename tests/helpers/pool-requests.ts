/**
 * @file tests/helpers/pool-requests.ts
 * @desc Requests for the pool routes as a browser on this site sends them (JSON, optional
 *       session cookie, extra headers), route contexts, the cast of users a pool test needs
 *       (owner, editor, admin, someone else), and an osu! stand-in for editor lookups.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse, http } from "msw";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import { ADMIN_OSU_ID, createTestAdmin, createTestUser, type TestUser } from "./auth";
import { makeBuiltPool } from "./built-pools";

/**
 * @function poolRequest
 * @param method {string} HTTP method
 * @param path {string} e.g. /api/pools/b-a0000001/ops
 * @param cookie {string | null} the session cookie, or null for a visitor
 * @param body {unknown} JSON body (a string is sent as is; undefined sends none)
 * @param headers {Record<string, string>} extra headers
 * @returns {Request} the request
 */
export const poolRequest = (
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
  headers: Record<string, string> = {},
): Request =>
  new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

/**
 * @function params
 * @param values {T} the route's params
 * @returns {{ params: Promise<T> }} a route context
 */
export const params = <T extends Record<string, string>>(values: T) => ({
  params: Promise.resolve(values),
});

export type Cast = { owner: TestUser; editor: TestUser; admin: TestUser; other: TestUser };

/** osu! ids the cast uses; ADMIN_OSU_IDS must list ADMIN_OSU_ID. */
export const EDITOR_OSU_ID = 20;

/**
 * @function createCast
 * @returns {Promise<Cast>} four signed-in users
 */
export const createCast = async (): Promise<Cast> => ({
  owner: await createTestUser(10, "owner"),
  editor: await createTestUser(EDITOR_OSU_ID, "editor"),
  admin: await createTestAdmin(ADMIN_OSU_ID),
  other: await createTestUser(40, "other"),
});

/**
 * @function insertPool
 * @param cast {Cast} whose owner owns it, with the editor listed
 * @param overrides {Partial<StoredBuiltPool>} fields to change
 * @returns {Promise<StoredBuiltPool>} the stored pool
 */
export const insertPool = async (
  cast: Cast,
  overrides: Partial<StoredBuiltPool> = {},
): Promise<StoredBuiltPool> => {
  const pool = makeBuiltPool({
    ownerId: cast.owner.id,
    editors: [
      { userId: cast.editor.id, osuId: EDITOR_OSU_ID, username: "editor", addedAt: new Date() },
    ],
    ...overrides,
  });
  await (await builtPoolsCollection()).insertOne(pool);
  return pool;
};

/** osu!'s token and user lookup: `users` maps a lower-cased name to its osu! id. */
export const osuUserHandlers = (users: Record<string, number>) => [
  http.post("https://osu.ppy.sh/oauth/token", () =>
    HttpResponse.json({ access_token: "t", token_type: "Bearer", expires_in: 86400 }),
  ),
  http.get("https://osu.ppy.sh/api/v2/users/:user", ({ params: { user } }) => {
    const name = decodeURIComponent(String(user)).replace(/^@/, "");
    const id = users[name.toLowerCase()];
    return id === undefined
      ? HttpResponse.json({ error: null }, { status: 404 })
      : HttpResponse.json({ id, username: name });
  }),
];
