/**
 * @file src/app/docs/api/page.tsx
 * @desc /docs/api: the public API in one page: how to send an hpl_ key, the rate limits,
 *       GET /api/v1/me with a curl example, and a link to the OpenAPI document. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { API_DOCS_PATH, OPENAPI_PATH, RATE_LIMITS } from "@/constants/api";
import { PAGE_SEO, SEO_SITE } from "@/constants/seo";

/** /docs/api's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: API_DOCS_PATH,
  ...PAGE_SEO[API_DOCS_PATH],
});

const LIMITS = [
  ["Requests", RATE_LIMITS.api, "per key owner"],
  ["Writes (POST, PUT, PATCH, DELETE)", RATE_LIMITS.apiWrite, "per key owner"],
  ["Failed calls (missing or bad key)", RATE_LIMITS.authFail, "per IP"],
] as const;

const CURL = `curl -H "Authorization: Bearer hpl_…" ${SEO_SITE.url}/api/v1/me`;
const ANSWER = `{ "user": { "id": "…", "osuId": 2, "username": "peppy" } }`;

/**
 * @function ApiDocsPage
 * @returns {JSX.Element} the API docs
 */
export default function ApiDocsPage() {
  return (
    <article>
      <PageHeader
        title="pools API"
        lead="A small API for scripts and bots. Every call needs a key from your account page."
      />
      <Prose className="mt-6">
        <h2>Authentication</h2>
        <p>
          Make a key on your <Link href="/account">account page</Link>. It starts with{" "}
          <code>hpl_</code> and is shown once. Send it on every call:
        </p>
        <pre>
          <code>Authorization: Bearer hpl_…</code>
        </pre>
        <p>
          A missing, revoked or replaced key gets a 401. Regenerating a key stops the old one at
          once.
        </p>
        <h2>Limits</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">Limit</th>
              <th scope="col">Counted</th>
            </tr>
          </thead>
          <tbody>
            {LIMITS.map(([what, rule, counted]) => (
              <tr key={rule.scope}>
                <td>{what}</td>
                <td>{rule.limit} a minute</td>
                <td>{counted}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Every answer carries <code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code> and{" "}
          <code>RateLimit-Reset</code>. Over the limit you get a 429 with <code>Retry-After</code>.
        </p>
        <h2>GET /api/v1/me</h2>
        <p>Who the key belongs to.</p>
        <pre>
          <code>{CURL}</code>
        </pre>
        <pre>
          <code>{ANSWER}</code>
        </pre>
        <h2>OpenAPI</h2>
        <p>
          The same, as an OpenAPI 3.1 document: <a href={OPENAPI_PATH}>{OPENAPI_PATH}</a>.
        </p>
      </Prose>
    </article>
  );
}
