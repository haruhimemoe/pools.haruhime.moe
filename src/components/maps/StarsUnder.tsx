/**
 * @file src/components/maps/StarsUnder.tsx
 * @desc A star rating and what it's under: ui's StarRating pill ("5.23 stars" to screen readers,
 *       "–" when the rating isn't known) followed by the mods, "no mod", or any other note, since
 *       every star rating on pools says what it's under.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { StarRating } from "@haruhimemoe/ui";

type StarsUnderProps = {
  /** The rating, or null when it isn't known. */
  stars: number | null;
  /** What it's under: "no mod", "HR", "DT"... */
  under: string;
};

/**
 * @function StarsUnder
 * @param props {StarsUnderProps} the rating and what it's under
 * @returns {JSX.Element} the pill (or "–") and the note, on one line
 */
export function StarsUnder({ stars, under }: StarsUnderProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {stars === null ? <span>–</span> : <StarRating value={stars} />}
      <span className="text-c3 text-xs">{under}</span>
    </span>
  );
}
