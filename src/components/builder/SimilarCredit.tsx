/**
 * @file src/components/builder/SimilarCredit.tsx
 * @desc BoBERT's credit beside similar maps: "Similar maps by BoBERT from token03, MIT", the name
 *       linking its repository. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { TextLink } from "@haruhimemoe/ui";
import { BOBERT_CREDIT } from "@/constants/similar";

/**
 * @function SimilarCredit
 * @returns {JSX.Element} the credit line
 */
export function SimilarCredit() {
  return (
    <p className="text-c3 text-xs">
      Similar maps by{" "}
      <TextLink href={BOBERT_CREDIT.url} rel="noreferrer">
        {BOBERT_CREDIT.name}
      </TextLink>{" "}
      from {BOBERT_CREDIT.author}, {BOBERT_CREDIT.license}.
    </p>
  );
}
