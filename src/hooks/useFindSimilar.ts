/**
 * @file src/hooks/useFindSimilar.ts
 * @desc Who opens the map browser's "Similar to" source: the editor provides it for its slot and
 *       candidate rows, the map browser for its own rows. A row with no provider above it (a
 *       pool's page) shows no Find similar.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { createContext, useContext } from "react";
import type { FindSimilar } from "@/utils/similar-params";

/** The nearest "Find similar" handler, or null for none. */
export const FindSimilarContext = createContext<FindSimilar | null>(null);

/**
 * @function useFindSimilar
 * @returns {FindSimilar | null} the handler above this row, or null
 */
export const useFindSimilar = (): FindSimilar | null => useContext(FindSimilarContext);
