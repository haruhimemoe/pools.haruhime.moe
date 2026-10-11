/**
 * @file src/app/not-found.tsx
 * @desc 404 page, titled "Page not found · pools.haruhime.moe" and noindex (a missing pool or map
 *       renders this too, so its title isn't the home page's).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

import { notFoundMetadata } from "@haruhimemoe/next-kit/seo";
import { ButtonLink, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { SEO_SITE } from "@/constants/seo";

/** "Page not found · pools.haruhime.moe", noindex. */
export const metadata: Metadata = notFoundMetadata(SEO_SITE);

/**
 * @function NotFound
 * @returns {JSX.Element} the 404 page with links back
 */
export default function NotFound() {
  const t = useTranslations("pools.pages.rootNotFound");
  return (
    <PageHeader
      title={t("pageNotFound")}
      lead={t("thatPageDoesnT")}
      actions={
        <ButtonLink href="/" variant="secondary">
          {t("backHome")}
        </ButtonLink>
      }
    />
  );
}
