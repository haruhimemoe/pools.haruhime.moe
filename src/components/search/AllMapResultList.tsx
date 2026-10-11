/**
 * @file src/components/search/AllMapResultList.tsx
 * @desc All-maps results: one card per beatmapset (artist, title, mapper, the status as osu!
 *       names it: Ranked, Approved, Loved, Qualified, Pending, WIP or Graveyard; an Unranked tag
 *       for graveyard, pending and WIP sets, and "Check first" with the reason for sets that
 *       need a closer look), each osu!standard difficulty with its no-mod stars, length and BPM
 *       and how many pools played it (a link to its map page when some did), and a link to the
 *       set on osu!. The set and its difficulties are @haruhimemoe/ui's shared MapSetCard.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sun Oct 11, 2026
 */

import { Badge, MapSetCard, type MapSetDifficulty, TextLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { AllMapDifficulty, AllMapSet } from "@/schemas/search-response";

type T = ReturnType<typeof useTranslations>;

const playedText = (t: T, map: AllMapDifficulty) => {
  if (map.playedIn === null) return <span>{t("poolHistoryUnavailable")}</span>;
  if (map.playedIn === 0) return <span>{t("notPlayedInA")}</span>;
  return <TextLink href={`/maps/${map.id}`}>{t("playedIn", { count: map.playedIn })}</TextLink>;
};

/**
 * @function AllMapResultList
 * @param props {{ results: readonly AllMapSet[] }} one page of sets
 * @returns {JSX.Element} each set with its tags and difficulties
 */
export function AllMapResultList({ results }: { results: readonly AllMapSet[] }) {
  const t = useTranslations("pools.allMapResultList");
  return (
    <ul className="flex flex-col gap-3">
      {results.map((set) => (
        <MapSetCard
          as="li"
          key={set.setId}
          beatmapsetId={set.setId}
          artist={set.artist}
          title={set.title}
          creator={set.creator}
          status={set.status}
          badges={
            <>
              {set.unranked ? <Badge tone="warning">{t("unranked")}</Badge> : null}
              {set.check ? <Badge tone="warning">{t("checkFirst")}</Badge> : null}
            </>
          }
          note={set.check?.text}
          difficulties={set.maps.map(
            (map): MapSetDifficulty => ({
              beatmapId: map.id,
              version: map.version,
              stars: map.stars,
              starsNote: "no mod",
              stats: { bpm: map.bpm, lengthSeconds: map.length },
              details: playedText(t, map),
            }),
          )}
        />
      ))}
    </ul>
  );
}
