/**
 * @file src/components/builder/DetailField.tsx
 * @desc One of a pool's details, edited in place: it saves when it loses focus (or on Enter, for
 *       one-line fields) and only when the value changed and passes the same check the server
 *       runs; otherwise it says what's wrong under the field and sends nothing. It follows the
 *       stored value, so a reload or another editor's change shows up.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Textarea, TextInput } from "@haruhimemoe/ui";
import { type KeyboardEvent, useState } from "react";
import { useStoredField } from "@/hooks/useStoredField";

/** A field's check: the value to send, or why it can't be sent. */
export type FieldCheck = { ok: true; value: unknown } | { ok: false; message: string };

type DetailFieldProps = {
  id: string;
  label: string;
  hint?: string;
  /** The stored value as text. */
  stored: string;
  multiline?: boolean;
  inputMode?: "numeric";
  check: (text: string) => FieldCheck;
  onSave: (value: unknown) => void;
};

export function DetailField({
  stored,
  multiline = false,
  check,
  onSave,
  ...field
}: DetailFieldProps) {
  const [value, setValue] = useStoredField(stored);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (value === stored) {
      setError(null);
      return;
    }
    const checked = check(value);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError(null);
    // Only spaces changed, say: nothing to save.
    if (String(checked.value ?? "") === stored) setValue(stored);
    else onSave(checked.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") save();
  };
  const common = {
    ...field,
    value,
    error: error ?? undefined,
    onBlur: save,
  };
  return multiline ? (
    <Textarea {...common} rows={3} onChange={(event) => setValue(event.target.value)} />
  ) : (
    <TextInput
      {...common}
      autoComplete="off"
      onKeyDown={onKeyDown}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
