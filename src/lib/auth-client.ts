/**
 * @file src/lib/auth-client.ts
 * @desc better-auth browser client with typed additional user fields (admin pages only).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
  sessionOptions: { refetchOnWindowFocus: false },
});
