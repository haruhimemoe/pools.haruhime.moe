/**
 * @file src/hooks/useStoredField.ts
 * @desc A form field's value that follows its stored value: when the stored value changes (a
 *       save, a reload, another editor's change), the field takes it; otherwise it keeps what
 *       was typed. Client state survives re-renders, so without this a field would keep the
 *       value it mounted with.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { useState } from "react";

/**
 * @function useStoredField
 * @param stored {T} the field's value as the server has it now
 * @returns {[T, (value: T) => void]} the field's value and its setter
 */
export function useStoredField<T>(stored: T): [T, (value: T) => void] {
  const [value, setValue] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (!Object.is(seen, stored)) {
    setSeen(stored);
    setValue(stored);
  }
  return [value, setValue];
}
