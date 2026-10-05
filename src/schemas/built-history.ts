/**
 * @file src/schemas/built-history.ts
 * @desc PUT /api/pools/<id>/history: the owner turns the pool's history public or private.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { z } from "zod";

/** PUT /api/pools/<id>/history. */
export const historyBodySchema = z.strictObject({ historyPublic: z.boolean() });
