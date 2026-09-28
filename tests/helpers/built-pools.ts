/**
 * @file tests/helpers/built-pools.ts
 * @desc makeBuiltPool(): a valid stored built pool (private, empty, version 1, no pack) with
 *       overrides, for schema, util and database tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { StoredBuiltPool } from "@/schemas/built-pool";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";

const AT = new Date("2026-09-27T12:00:00.000Z");

/**
 * @function makeBuiltPool
 * @param overrides {Partial<StoredBuiltPool>} fields to change
 * @returns {StoredBuiltPool} a stored built pool
 */
export const makeBuiltPool = (overrides: Partial<StoredBuiltPool> = {}): StoredBuiltPool => ({
  _id: "b-a0000001",
  name: "Spring Cup Finals",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2026,
  notes: "",
  visibility: "private",
  ownerId: "0123456789abcdef01234567",
  editors: [],
  slots: [],
  version: 1,
  pack: EMPTY_BUILT_PACK,
  hidden: false,
  startedFrom: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});
