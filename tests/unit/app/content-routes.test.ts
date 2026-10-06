/**
 * @file tests/unit/app/content-routes.test.ts
 * @desc /docs and /legal: each page and its .md mirror prerender exactly the registry
 *       (unregistered slugs never build, so they 404), every registered .md answers 200
 *       text/markdown with the entry's title as its H1, unknown slugs answer 404, and the
 *       rewrite maps each .md URL to its route.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { type ContentSection, contentRewrites } from "@haruhimemoe/next-kit/docs";
import { describe, expect, it } from "vitest";
import * as docsMd from "@/app/docs/[slug]/md/route";
import * as docsPage from "@/app/docs/[slug]/page";
import * as legalMd from "@/app/legal/[slug]/md/route";
import * as legalPage from "@/app/legal/[slug]/page";
import { CONTENT } from "@/constants/content";
import nextConfig from "../../../next.config";

const ROUTES = {
  docs: { md: docsMd, page: docsPage },
  legal: { md: legalMd, page: legalPage },
} as const;

const SECTIONS = ["docs", "legal"] as const satisfies readonly ContentSection[];

const params = (slug: string) => ({ params: Promise.resolve({ slug }) }) as never;

describe.each(SECTIONS)("/%s", (section) => {
  const { md, page } = ROUTES[section];
  const slugs = CONTENT.entries[section].map((e) => ({ slug: e.slug }));

  it("prerenders exactly the registry, nothing else", () => {
    expect(page.dynamicParams).toBe(false);
    expect(page.generateStaticParams()).toEqual(slugs);
    expect(md.dynamic).toBe("force-static");
    expect(md.dynamicParams).toBe(false);
    expect(md.generateStaticParams()).toEqual(slugs);
  });

  it.each(CONTENT.entries[section].map((e) => [e.slug, e.title] as const))(
    "serves %s.md as text/markdown",
    async (slug, title) => {
      const response = await md.GET(
        new Request(`https://pools.haruhime.moe/${section}/${slug}.md`),
        params(slug),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/markdown/);
      const body = await response.text();
      expect(body.startsWith(`# ${title}\n\n`)).toBe(true);
    },
  );

  if (section === "legal") {
    it("keeps the legal block tags' words in the .md mirror", async () => {
      const response = await md.GET(
        new Request("https://pools.haruhime.moe/legal/your-privacy-rights.md"),
        params("your-privacy-rights"),
      );
      const body = await response.text();
      expect(body).toContain("Your rights under the GDPR");
      expect(body).not.toMatch(/<YourRights|<DataWeKeep|<Changes|<LegalContact/);
    });
  }

  it.each(["__proto__", "nope"])("404s %j", async (slug) => {
    const response = await md.GET(new Request("https://pools.haruhime.moe/"), params(slug));
    expect(response.status).toBe(404);
    await expect(page.default(params(slug))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/),
    });
  });

  it("gives each page a canonical URL and its registry title", async () => {
    const [first] = CONTENT.entries[section];
    if (!first) throw new Error("empty section");
    await expect(page.generateMetadata(params(first.slug))).resolves.toMatchObject({
      alternates: { canonical: `https://pools.haruhime.moe/${section}/${first.slug}` },
      description: first.description,
      openGraph: { type: "article", modifiedTime: expect.stringContaining(first.lastUpdated) },
    });
  });
});

it("rewrites every section's .md URL to its route", async () => {
  const rewrites = await nextConfig.rewrites?.();
  expect(rewrites).toMatchObject({ afterFiles: contentRewrites() });
});
