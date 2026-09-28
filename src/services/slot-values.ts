/**
 * @file src/services/slot-values.ts
 * @desc Values under each pool slot's mods, for built and past pool pages: NM, FM and TB slots
 *       keep the map's no-mod values; other slots (HD, HR, DT, EZ, HT, FL, forced custom
 *       combos) take stars, AR, OD and CS from the mirror's pp/batch under the
 *       combo (src/lib/mod-values.ts: one call per combo, all at once, cached 30 days) and BPM
 *       and length from the mod math. The mirror gets one deadline for all combos
 *       (SLOT_VALUES_DEADLINE_MS, 8 s): what hasn't come by then is the math, marked incomplete. A map the mirror lacks keeps its no-mod rating with AR, OD, CS, BPM
 *       and length computed ("math": the page says "no mod data"). A failed mirror call still
 *       answers, marked incomplete. The math and the shared types are in
 *       src/utils/slot-values.ts; pastSlotValues follows a past pool's source slots, and
 *       builtSlotValues keys a built pool's values by map and combo.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { SLOT_VALUES_DEADLINE_MS } from "@/constants/mod-values";
import { getModValues, type ModValuesDeps } from "@/lib/mod-values";
import type { ModValues } from "@/schemas/mod-values";
import { modsCode, valueModsOf } from "@/utils/mod-values";
import {
  builtSlotCode,
  noModOf,
  pastSlotCodes,
  type SlotMapValues,
  type SlotValueAnswer,
  type SlotValueMap,
  slotAnswer,
  slotValueKey,
} from "@/utils/slot-values";

export type { SlotMapValues, SlotValueAnswer };

/** A slot: its map, its mods (src/utils/slot-mods.ts slotModsCode) and the map's no-mod values. */
export type SlotValueRequest = { beatmapId: number; mods: string; noMod: SlotMapValues };

/** getModValues' deps, and how long all combos may take (tests shorten it). */
export type SlotValuesDeps = Omit<ModValuesDeps, "signal"> & { deadlineMs?: number };

/** Whether the work ended before the deadline aborted (a rejection counts as not). */
const beforeDeadline = (work: Promise<unknown>, deadline: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (deadline.aborted) resolve(false);
    deadline.addEventListener("abort", () => resolve(false), { once: true });
    work.then(
      () => resolve(true),
      () => resolve(false),
    );
  });

/**
 * @function slotValues
 * @param slots {readonly SlotValueRequest[]} a pool's slots
 * @param deps {SlotValuesDeps} fetch, timeout, clock and deadline (tests)
 * @returns {Promise<{ values: SlotValueAnswer[]; complete: boolean }>} each slot's values in
 *          order, and false when a mirror call failed or the deadline came first
 */
export const slotValues = async (
  slots: readonly SlotValueRequest[],
  { deadlineMs = SLOT_VALUES_DEADLINE_MS, ...deps }: SlotValuesDeps = {},
): Promise<{ values: SlotValueAnswer[]; complete: boolean }> => {
  const modsOf = slots.map((slot) => valueModsOf(slot.mods));
  const idsByCode = new Map<string, number[]>();
  slots.forEach((slot, i) => {
    const mods = modsOf[i] ?? [];
    if (mods.length === 0) return;
    const code = modsCode(mods);
    idsByCode.set(code, [...(idsByCode.get(code) ?? []), slot.beatmapId]);
  });
  const found = new Map<string, Map<number, ModValues>>();
  let failed = false;
  const deadline = AbortSignal.timeout(deadlineMs);
  const asks = [...idsByCode].map(async ([code, ids]) => {
    const result = await getModValues(ids, code, { ...deps, signal: deadline });
    found.set(code, result.values);
    if (result.failed) failed = true;
  });
  const complete = (await beforeDeadline(Promise.all(asks), deadline)) && !failed;
  const values = slots.map((slot, i) => {
    const mods = modsOf[i] ?? [];
    return slotAnswer(slot.noMod, mods, found.get(modsCode(mods))?.get(slot.beatmapId));
  });
  return { values, complete };
};

/**
 * @function pastSlotValues
 * @param pool {Parameters<typeof pastSlotCodes>[0]} a past pool
 * @param maps {ReadonlyMap<number, Partial<SlotMapValues>>} its maps' stored details
 * @param deps {SlotValuesDeps} fetch, timeout, clock and deadline (tests)
 * @returns {Promise<{ values: SlotValueAnswer[]; complete: boolean }>} one per source slot, in
 *          order
 */
export const pastSlotValues = (
  pool: Parameters<typeof pastSlotCodes>[0],
  maps: ReadonlyMap<number, Partial<SlotMapValues>>,
  deps: SlotValuesDeps = {},
) => {
  const codes = pastSlotCodes(pool);
  return slotValues(
    pool.sourceSlots.map(({ beatmapId }, i) => ({
      beatmapId,
      mods: codes[i] ?? "NM",
      noMod: noModOf(maps.get(beatmapId)),
    })),
    deps,
  );
};

/**
 * @function builtSlotValues
 * @param pool {{ buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] }} a built pool
 * @param maps {Readonly<Record<number, Partial<SlotMapValues> | null>>} its maps' details
 * @param deps {SlotValuesDeps} fetch, timeout, clock and deadline (tests)
 * @returns {Promise<{ values: SlotValueMap; complete: boolean }>} each slot's values by map and
 *          combo (slotValueKey)
 */
export const builtSlotValues = async (
  pool: { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] },
  maps: Readonly<Record<number, Partial<SlotMapValues> | null>>,
  deps: SlotValuesDeps = {},
): Promise<{ values: SlotValueMap; complete: boolean }> => {
  const requests = pool.slots.map((slot) => ({
    beatmapId: slot.beatmapId,
    mods: builtSlotCode(slot, pool.buckets),
    noMod: noModOf(maps[slot.beatmapId]),
  }));
  const { values, complete } = await slotValues(requests, deps);
  const byKey: Record<string, SlotValueAnswer> = {};
  values.forEach((value, i) => {
    const request = requests[i];
    if (request) byKey[slotValueKey(request.beatmapId, value.mods)] = value;
  });
  return { values: byKey, complete };
};
