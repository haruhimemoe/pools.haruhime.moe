/**
 * @file src/app/.well-known/security.txt/route.ts
 * @desc GET /.well-known/security.txt (RFC 9116), from next-kit's buildSecurityTxt: GitHub
 *       private vulnerability reporting first, then the email, as SECURITY.md orders them.
 *       Static: built on deploy, so Expires is a year from the last deploy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { buildSecurityTxt } from "@haruhimemoe/next-kit/server";
import { SITE } from "@/constants/site";

/** Built on deploy: Expires is a year from the last deploy. */
export const dynamic = "force-static";

/**
 * @function GET
 * @returns {Response} the security.txt body as plain text
 */
export function GET() {
  const body = buildSecurityTxt({
    contactEmail: SITE.contactEmail,
    siteUrl: SITE.url,
    policyUrl: `${SITE.repoUrl}/blob/main/SECURITY.md`,
    now: new Date(),
  });
  // RFC 9116 lists contacts in order of preference: GitHub's private reporting comes first.
  return new Response(`Contact: ${SITE.advisoriesUrl}\n${body}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
