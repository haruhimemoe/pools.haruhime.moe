/**
 * @file src/components/builder/KeepDraftHash.tsx
 * @desc On /new signed out: keeps a /new#<key> draft in sessionStorage, since the hash doesn't
 *       survive the hub's sign-in round trip. Renders nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

"use client";

import { useEffect } from "react";
import { keepDraftHash } from "@/utils/draft-key";

/**
 * @function KeepDraftHash
 * @returns {null} nothing; stores the hash once mounted
 */
export function KeepDraftHash() {
  useEffect(keepDraftHash, []);
  return null;
}
