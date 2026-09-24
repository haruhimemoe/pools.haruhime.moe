/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: the library SiteHeader with the pools wordmark and the main nav. Public
 *       pages carry no account area (only admins sign in, at /signin).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SiteHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { NAV_LINKS, SITE } from "@/constants/site";

export function Header() {
  return (
    <SiteHeader
      brand={
        <Link href="/" className="font-extrabold text-c1 text-xl tracking-tight">
          {SITE.name}
          <span className="text-h1">.</span>
        </Link>
      }
      links={NAV_LINKS}
    />
  );
}
