/**
 * @file src/schemas/activity.ts
 * @desc An entry in a built pool's activity log (built_pool_activity): the pool, when, who (osu!
 *       id and name; null and "deleted user" once their account is deleted), the kind of change
 *       and a summary; and the entry as the editor gets it (no pool id, the time as ISO text).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ObjectId } from "mongodb";
import { z } from "zod";
import { ACTIVITY_KINDS, type ActivityKind } from "@/constants/activity";

export const storedActivitySchema = z.object({
  _id: z.instanceof(ObjectId),
  poolId: z.string(),
  at: z.date(),
  osuId: z.number().int().positive().nullable(),
  username: z.string(),
  kind: z.enum(ACTIVITY_KINDS),
  summary: z.string(),
  /** Who an editor or owner entry names; gone once their account is deleted. */
  subject: z.object({ osuId: z.number().int().positive(), username: z.string() }).optional(),
});

export type StoredActivity = z.infer<typeof storedActivitySchema>;

/** What the editor's Recent changes gets. */
export type ClientActivity = {
  id: string;
  at: string;
  osuId: number | null;
  username: string;
  kind: ActivityKind;
  summary: string;
};
