/**
 * @file src/utils/content-markdown.ts
 * @desc The shared `readContentMarkdown` options for every docs, legal and llms-full
 *       Markdown mirror: the site URL plus ui's MDX-to-Markdown transforms (`Figure`,
 *       `Embed`, `MdxLinkCard`), so a mirror shows an image, URL or link line instead of
 *       dropping the tag. `LEGAL_CONTENT_MARKDOWN` adds next-kit's `legalMarkdownTransform`
 *       on top, scoped to the legal section: without it, mdxToMarkdown drops the self-closing
 *       legal block tags (`<YourRights />`, `<Processors />`, ...) instead of rendering their
 *       words into the .md mirror and llms-full.txt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { legalMarkdownTransform } from "@haruhimemoe/next-kit/legal";
import { mdxMarkdownTransforms } from "@haruhimemoe/ui/remark";
import { LEGAL_SITE } from "@/constants/legal-site";
import { SITE } from "@/constants/site";

/** Passed to every `readContentMarkdown` call in place of `{ siteUrl: SITE.url }`. */
export const CONTENT_MARKDOWN = { siteUrl: SITE.url, transforms: mdxMarkdownTransforms } as const;

/** `CONTENT_MARKDOWN` plus `legalMarkdownTransform`, for the legal section's .md mirror and
 * legal entries in llms-full.txt: renders `<YourRights />` and the other legal block tags into
 * the same words as their React components, instead of silently dropping them. */
export const LEGAL_CONTENT_MARKDOWN = {
  siteUrl: SITE.url,
  transforms: [...mdxMarkdownTransforms, legalMarkdownTransform(LEGAL_SITE)],
} as const;
