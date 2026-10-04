/**
 * @file src/app/brand/page.tsx
 * @desc /brand: the pools name, how to write it, logo files, colors, type, do's and don'ts and
 *       the contact, from @haruhimemoe/brand's brandPageData rendered by @haruhimemoe/ui's
 *       BrandPage (files in public/brand come from `haruhime-brand pools`). Static. Also the
 *       site's Organization structured data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { brandPageData } from "@haruhimemoe/brand/products";
import { HARUHIME_ORG, ld, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { BrandPage, JsonLd, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";

/** The page's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/brand",
  title: "pools brand assets",
  description:
    "The pools name, logos, icon, colors and type, with the files to download, for tournament staff, wikis and press writing about pools.haruhime.moe.",
});

/**
 * @function BrandRoute
 * @returns {JSX.Element} the page header, the brand sections and the Organization JSON-LD
 */
export default function BrandRoute() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Brand" lead="The pools name, logos, colors and type." />
      <BrandPage {...brandPageData("pools")} />
      <JsonLd
        data={ld.graph(
          ld.organization(HARUHIME_ORG),
          ld.breadcrumbs(SEO_SITE, [
            { name: "pools", path: "/" },
            { name: "Brand", path: "/brand" },
          ]),
        )}
      />
    </div>
  );
}
