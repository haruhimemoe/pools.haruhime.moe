/**
 * @file src/lib/osu-budget.ts
 * @desc The osu! budget: a global fixed window (50 calls a minute across every instance) and each
 *       IP's share (20 a minute), counted in rate_limits like the other limits. budgetGate() is
 *       the beforeCall a check hands @haruhimemoe/osu: once it says no, it says no for the rest of
 *       that check, and a counter it can't write counts as no.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import { OSU_API_BUDGET, OSU_API_BUDGET_PER_IP } from "@/constants/compliance";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";

/** Counters outlive their window by a minute, like the ones in src/lib/rate-limit.ts. */
const GRACE_MS = 60_000;

type CounterDoc = { _id: string; count: number; expiresAt: Date };

const windowOf = (scope: string, subject: string, windowSeconds: number, nowMs: number) => {
  const size = windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  return {
    id: `${scope}:${subject}:${start / 1000}`,
    expiresAt: new Date(start + size + GRACE_MS),
  };
};

/**
 * @function osuBudgetWindow
 * @param nowMs {number} current time (ms)
 * @returns {{ id: string; expiresAt: Date }} the global counter for this minute
 */
export const osuBudgetWindow = (nowMs: number) =>
  windowOf(OSU_API_BUDGET.scope, OSU_API_BUDGET.subject, OSU_API_BUDGET.windowSeconds, nowMs);

/**
 * @function osuSubjectWindow
 * @param subject {string} an IP subject
 * @param nowMs {number} current time (ms)
 * @returns {{ id: string; expiresAt: Date }} that subject's counter for this minute
 */
export const osuSubjectWindow = (subject: string, nowMs: number) =>
  windowOf(OSU_API_BUDGET_PER_IP.scope, subject, OSU_API_BUDGET_PER_IP.windowSeconds, nowMs);

const bump = async (
  db: Db,
  { id, expiresAt }: { id: string; expiresAt: Date },
): Promise<number> => {
  const counter = await db
    .collection<CounterDoc>(RATE_LIMITS_COLLECTION)
    .findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    );
  return counter?.count ?? Number.POSITIVE_INFINITY;
};

/**
 * @function takeOsuBudget
 * @param db {Db} the pools database
 * @param nowMs {number} current time (ms)
 * @param subject {string | undefined} the caller's IP subject; when given its share is counted
 *        first, and a subject past its share never touches the global counter
 * @returns {Promise<boolean>} true when this call fits the share and the minute's global budget
 * @throws when a counter can't be written
 */
export const takeOsuBudget = async (db: Db, nowMs: number, subject?: string): Promise<boolean> => {
  if (
    subject !== undefined &&
    (await bump(db, osuSubjectWindow(subject, nowMs))) > OSU_API_BUDGET_PER_IP.limit
  ) {
    return false;
  }
  return (await bump(db, osuBudgetWindow(nowMs))) <= OSU_API_BUDGET.limit;
};

/**
 * @function budgetGate
 * @param db {Db} the pools database
 * @param subject {string | undefined} the caller's IP subject
 * @param now {() => number} clock (tests)
 * @returns {() => Promise<boolean>} a beforeCall: true while the budget allows, false from its
 *          first no (or a counter it can't write) on
 */
export const budgetGate = (db: Db, subject: string | undefined, now: () => number = Date.now) => {
  let refused = false;
  return async (): Promise<boolean> => {
    if (refused) return false;
    try {
      if (await takeOsuBudget(db, now(), subject)) return true;
    } catch (error) {
      console.error("[osu] budget: couldn't count", error);
    }
    refused = true;
    return false;
  };
};
