/**
 * @file src/app/check/page.tsx
 * @desc /check: the compliance check. Static; the rules' links come from @haruhimemoe/compliance
 *       on the server, so browsers never load its data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import type { Metadata } from "next";
import { CheckScreen } from "@/components/check/CheckScreen";

/** /check's title, description and canonical URL. */
export const metadata: Metadata = {
  title: "Check a pool",
  description:
    "Check the maps of an osu! pool against the content rules for officially supported tournaments. A guide, not a ruling.",
};

/**
 * @function CheckPage
 * @returns {JSX.Element} the compliance check for pasted maps
 */
export default function CheckPage() {
  return (
    <CheckScreen
      rules={{
        contentUsage: RULE_LINKS.contentUsage,
        officialSupport: RULE_LINKS.officialSupport,
        project: UPSTREAM.repo,
      }}
    />
  );
}
