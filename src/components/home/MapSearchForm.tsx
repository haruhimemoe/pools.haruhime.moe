/**
 * @file src/components/home/MapSearchForm.tsx
 * @desc The home page's maps search: a beatmap ID or link opens the map's page, anything else
 *       searches all osu! maps (the maps tab's default scope). Without JavaScript the form still
 *       submits to /search?tab=maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { mapSearchTarget } from "@/utils/search-links";

export function MapSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(mapSearchTarget(query));
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: the form is the landmark (older screen readers don't map <search>)
    <form
      action="/search"
      method="get"
      onSubmit={onSubmit}
      role="search"
      aria-label="Maps"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="tab" value="maps" />
      <TextInput
        id="home-maps"
        name="q"
        label="Any osu! map: title, artist, mapper, or a beatmap ID or link"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      <Button type="submit" className="self-start">
        Search maps
      </Button>
    </form>
  );
}
