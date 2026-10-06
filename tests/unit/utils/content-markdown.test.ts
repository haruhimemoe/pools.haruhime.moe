/**
 * @file tests/unit/utils/content-markdown.test.ts
 * @desc `CONTENT_MARKDOWN` turns ui's MDX components into Markdown in the docs, legal and
 *       llms-full mirrors. `LEGAL_CONTENT_MARKDOWN` also turns next-kit's legal block tags
 *       into their words, so the legal section's mirror doesn't drop them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { mdxToMarkdown } from "@haruhimemoe/next-kit/docs";
import { expect, it } from "vitest";
import { CONTENT_MARKDOWN, LEGAL_CONTENT_MARKDOWN } from "@/utils/content-markdown";

it("turns ui's MDX components into Markdown in the mirrors", () => {
  const md = mdxToMarkdown('<Figure src="/a.png" alt="A" width={1} height={1} caption="C" />', {
    title: "T",
    ...CONTENT_MARKDOWN,
  });
  expect(md).toContain(`![A](${CONTENT_MARKDOWN.siteUrl}/a.png "C")`);
});

it("also turns next-kit's legal block tags into their words", () => {
  const md = mdxToMarkdown("<YourRights />", { title: "T", ...LEGAL_CONTENT_MARKDOWN });
  expect(md).toContain("Your rights under the GDPR");
  expect(md).not.toContain("<YourRights");
});
