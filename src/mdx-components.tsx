/**
 * @file src/mdx-components.tsx
 * @desc Global MDX element overrides (required by @next/mdx in the App Router): the docs
 *       and legal pages' links, headings, tables and callouts come from @haruhimemoe/ui/mdx's shared
 *       mdxComponents (internal links via next/link, external http(s) links in a new tab,
 *       heading anchors, a focusable named table wrapper, GitHub-style callouts); code fences
 *       (content/docs/api.mdx) render plain: no shiki highlighter is registered. Also binds
 *       next-kit's seven legal blocks to LEGAL_SITE, so content/legal/*.mdx writes
 *       `<DataWeKeep />` with no import and no props.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import {
  Changes,
  DataWeKeep,
  DmcaNotice,
  LegalContact,
  NoWarranty,
  Processors,
  YourRights,
} from "@haruhimemoe/next-kit/legal";
import { mdxComponents } from "@haruhimemoe/ui/mdx";
import type { MDXComponents } from "mdx/types";
import { LEGAL_SITE } from "@/constants/legal-site";

/**
 * @function useMDXComponents
 * @returns {MDXComponents} the content pages' elements, styled like the rest of the site, plus
 *          the legal blocks bound to LEGAL_SITE
 */
export function useMDXComponents(): MDXComponents {
  return {
    ...mdxComponents,
    LegalContact: () => <LegalContact site={LEGAL_SITE} />,
    DataWeKeep: () => <DataWeKeep site={LEGAL_SITE} />,
    Processors: () => <Processors site={LEGAL_SITE} />,
    YourRights: () => <YourRights site={LEGAL_SITE} />,
    DmcaNotice: () => <DmcaNotice site={LEGAL_SITE} />,
    NoWarranty: () => <NoWarranty site={LEGAL_SITE} />,
    Changes: (props: { date?: string }) => <Changes site={LEGAL_SITE} date={props.date} />,
  };
}
