/**
 * @file src/utils/content-markdown.ts
 * @desc The shared `readContentMarkdown` options for every docs, legal and llms-full
 *       Markdown mirror: the site URL plus ui's MDX-to-Markdown transforms (`Figure`,
 *       `Embed`, `MdxLinkCard`), so a mirror shows an image, URL or link line instead of
 *       dropping the tag.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { mdxMarkdownTransforms } from "@haruhimemoe/ui/remark";
import { SITE } from "@/constants/site";

/** Passed to every `readContentMarkdown` call in place of `{ siteUrl: SITE.url }`. */
export const CONTENT_MARKDOWN = { siteUrl: SITE.url, transforms: mdxMarkdownTransforms } as const;
