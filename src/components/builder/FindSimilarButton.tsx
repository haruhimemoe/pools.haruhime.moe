/**
 * @file src/components/builder/FindSimilarButton.tsx
 * @desc "Find similar" on a map row (the browser's results, slots, candidates, Your candidates):
 *       opens the map browser's "Similar to" source for that map, through the handler the editor
 *       or the browser provides (useFindSimilar); with none above it, nothing. Its accessible
 *       name starts with the visible words, then names the map.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useFindSimilar } from "@/hooks/useFindSimilar";

type FindSimilarButtonProps = {
  beatmapId: number;
  /** "Artist - Title [Difficulty]". */
  label: string;
};

/**
 * @function FindSimilarButton
 * @param props {FindSimilarButtonProps} the map
 * @returns {JSX.Element | null} the button, or nothing with no handler above it
 */
export function FindSimilarButton({ beatmapId, label }: FindSimilarButtonProps) {
  const onFindSimilar = useFindSimilar();
  if (!onFindSimilar) return null;
  return (
    <Button
      variant="ghost"
      aria-label={`Find similar: ${label}`}
      onClick={() => onFindSimilar({ id: beatmapId, label })}
    >
      Find similar
    </Button>
  );
}
