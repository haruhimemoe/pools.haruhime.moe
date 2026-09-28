/**
 * @file src/schemas/session-user.ts
 * @desc Who a request comes from, as the services take it: the signed-in osu! user
 *       (next-kit's OsuSessionUser) and whether ADMIN_OSU_IDS lists them right now. Types only,
 *       so services and src/lib/auth.ts share them without importing each other.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { OsuSessionUser } from "@haruhimemoe/next-kit/auth";

/** The signed-in user, and whether ADMIN_OSU_IDS lists them right now. */
export type SessionUser = OsuSessionUser & { isAdmin: boolean };

/** A signed-in admin. */
export type AdminUser = OsuSessionUser;
