/**
 * @file src/app/legal/[doc]/page.tsx
 * @desc Legal document route. Static params come from the registry; unknown slugs 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { MDXContent } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLegalSlug, LEGAL_DOCS, LEGAL_SLUGS, type LegalSlug } from "@/constants/legal";
import { formatIsoDate } from "@/utils/date";

const LOADERS: Record<LegalSlug, () => Promise<{ default: MDXContent }>> = {
  disclaimer: () => import("@content/legal/disclaimer.mdx"),
  privacy: () => import("@content/legal/privacy.mdx"),
  terms: () => import("@content/legal/terms.mdx"),
};

/** Only the legal pages in LEGAL_DOCS exist; any other path is a 404. */
export const dynamicParams = false;

/**
 * @function generateStaticParams
 * @returns {{ doc: string }[]} every legal page, built at deploy
 */
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

/**
 * @function generateMetadata
 * @param props {PageProps<"/legal/[doc]">} the page's slug
 * @returns {Promise<Metadata>} its title and canonical URL
 */
export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalSlug(doc)) return {};
  const { title, description } = LEGAL_DOCS[doc];
  return { title, description, alternates: { canonical: `/legal/${doc}` } };
}

/**
 * @function LegalPage
 * @param props {PageProps<"/legal/[doc]">} the page's slug
 * @returns {Promise<JSX.Element>} the MDX legal page with its last-updated date
 */
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!isLegalSlug(doc)) notFound();
  const { title, lastUpdated } = LEGAL_DOCS[doc];
  const { default: Content } = await LOADERS[doc]();
  return (
    <article>
      <PageHeader title={title} meta={`Last updated ${formatIsoDate(lastUpdated)}`} />
      <Prose className="mt-6">
        <Content />
      </Prose>
    </article>
  );
}
