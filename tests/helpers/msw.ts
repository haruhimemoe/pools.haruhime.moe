/**
 * @file tests/helpers/msw.ts
 * @desc setupMsw(...handlers): an msw server for the file, listening before the tests with every
 *       unhandled request an error (so nothing reaches osu!, the mirror, otdb or packs), reset
 *       after each test, closed after the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { RequestHandler } from "msw";
import { type SetupServer, setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * @function setupMsw
 * @param handlers {RequestHandler[]} the file's default handlers
 * @returns {SetupServer} the server (use server.use() to add handlers in a test)
 */
export const setupMsw = (...handlers: RequestHandler[]): SetupServer => {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
};
