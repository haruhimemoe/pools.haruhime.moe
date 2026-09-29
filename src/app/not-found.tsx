/**
 * @file src/app/not-found.tsx
 * @desc 404 page, titled "Page not found · pools.haruhime.moe" and noindex (a missing pool or map
 *       renders this too, so its title isn't the home page's).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata } from "@haruhimemoe/next-kit/seo";
import { ButtonLink, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";

/** "Page not found · pools.haruhime.moe", noindex. */
export const metadata: Metadata = notFoundMetadata(SEO_SITE);

/**
 * @function NotFound
 * @returns {JSX.Element} the 404 page with links back
 */
export default function NotFound() {
  return (
    <PageHeader
      title="Page not found"
      lead="That page doesn't exist, or it moved."
      actions={
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      }
    />
  );
}
