/**
 * @file src/components/builder/MapPreview.tsx
 * @desc A set's preview beside a map: its cover (lazy, 48 px square, named after the song) with
 *       a button over it that plays or stops its preview clip. Both load straight from osu!'s CDN; one clip
 *       plays at a time (src/hooks/usePreviewPlayer.ts). Nothing until the set is known.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import Image from "next/image";
import { togglePreview, usePlayingSet } from "@/hooks/usePreviewPlayer";
import { coverAlt, previewClipUrl, previewCoverUrl, previewLabel } from "@/utils/map-preview";

type MapPreviewProps = {
  setId: number | null;
  /** "Artist - Title", for the alt text and the button's name. */
  song: string;
};

export function MapPreview({ setId, song }: MapPreviewProps) {
  const playing = usePlayingSet();
  if (setId === null) return null;
  const on = playing === setId;
  return (
    <div className="relative size-12 shrink-0">
      <Image
        src={previewCoverUrl(setId)}
        alt={coverAlt(song)}
        width={48}
        height={48}
        loading="lazy"
        unoptimized
        className="size-12 rounded-md bg-b5 object-cover"
      />
      <button
        type="button"
        aria-label={previewLabel(song, on)}
        onClick={() => togglePreview(setId, previewClipUrl(setId))}
        className={`absolute inset-0 flex items-center justify-center rounded-md text-c1 text-lg transition-colors ${on ? "bg-h2/70" : "bg-b6/45 hover:bg-b6/65"}`}
      >
        <span aria-hidden="true">{on ? "■" : "▶"}</span>
      </button>
    </div>
  );
}
