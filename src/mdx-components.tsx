/**
 * @file src/mdx-components.tsx
 * @desc Global MDX element overrides (required by @next/mdx in the App Router): internal links
 *       use next/link, external http(s) links open in a new tab without an opener.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MDXComponents } from "mdx/types";
import Link from "next/link";

const components: MDXComponents = {
  a: ({ href = "", children }) => {
    if (href.startsWith("/")) return <Link href={href}>{children}</Link>;
    if (href.startsWith("http")) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return <a href={href}>{children}</a>;
  },
};

/**
 * @function useMDXComponents
 * @returns {MDXComponents} the legal pages' elements, styled like the rest of the site
 */
export function useMDXComponents(): MDXComponents {
  return components;
}
