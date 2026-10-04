/**
 * @file src/mdx-components.tsx
 * @desc Global MDX element overrides (required by @next/mdx in the App Router): the docs
 *       and legal pages' links, headings, tables and callouts come from @haruhimemoe/ui/mdx's shared
 *       mdxComponents (internal links via next/link, external http(s) links in a new tab,
 *       heading anchors, a focusable named table wrapper, GitHub-style callouts); code fences
 *       (content/docs/api.mdx) render plain: no shiki highlighter is registered.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { mdxComponents } from "@haruhimemoe/ui/mdx";
import type { MDXComponents } from "mdx/types";

/**
 * @function useMDXComponents
 * @returns {MDXComponents} the content pages' elements, styled like the rest of the site
 */
export function useMDXComponents(): MDXComponents {
  return { ...mdxComponents };
}
