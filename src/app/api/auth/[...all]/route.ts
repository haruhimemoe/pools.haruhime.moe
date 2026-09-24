/**
 * @file src/app/api/auth/[...all]/route.ts
 * @desc better-auth handler: sign-in, OAuth callback, session, sign-out under /api/auth/*. Connects
 *       first, so the database privilege check runs before better-auth touches the client.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";

export const { GET, POST } = toNextJsHandler(async (request) => {
  await connectDb();
  return getAuth().handler(request);
});
