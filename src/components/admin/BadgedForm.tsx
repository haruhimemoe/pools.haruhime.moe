/**
 * @file src/components/admin/BadgedForm.tsx
 * @desc Sets badged for every pool of this pool's tournament: this year's pools (or the pools with
 *       no year, when this one has none) or every year's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Button, Select } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const VALUES = { unknown: null, yes: true, no: false } as const;

/**
 * @function BadgedForm
 * @param props {BadgedFormProps} the tournament and its years
 * @returns {JSX.Element} the form that sets badged for a tournament's pools
 */
export function BadgedForm({
  tournamentKey,
  year,
}: {
  tournamentKey: string;
  year: number | null;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<"year" | "all">("year");
  const [value, setValue] = useState<keyof typeof VALUES>("unknown");
  const [message, setMessage] = useState("");
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/admin/badged", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentKey,
        year: scope === "all" ? "all" : year,
        badged: VALUES[value],
      }),
    });
    const body = (await response.json()) as { matched?: number; error?: { message?: string } };
    setMessage(
      response.ok
        ? `Set ${body.matched ?? 0} ${body.matched === 1 ? "pool" : "pools"}.`
        : (body.error?.message ?? "It didn't save."),
    );
    if (response.ok) router.refresh();
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Select
        id="badged-scope"
        label="Which pools"
        value={scope}
        onChange={(event) => setScope(event.target.value as "year" | "all")}
      >
        <option value="year">
          {year === null
            ? "This tournament's pools with no year"
            : `This tournament's ${year} pools`}
        </option>
        <option value="all">Every year of this tournament</option>
      </Select>
      <Select
        id="badged-value"
        label="Badged"
        value={value}
        onChange={(event) => setValue(event.target.value as keyof typeof VALUES)}
      >
        <option value="unknown">Not known</option>
        <option value="yes">Badged</option>
        <option value="no">Not badged</option>
      </Select>
      <Button type="submit">Set badged</Button>
      <output className="text-c2 text-sm" aria-live="polite">
        {message}
      </output>
    </form>
  );
}
