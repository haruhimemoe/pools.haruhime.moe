/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: the library SiteHeader with the pools wordmark, the main nav and the
 *       account menu (client-side, so public pages still read no cookies). In a beta build a small
 *       "beta" tag sits beside the wordmark, outside the link, so the link's name stays "pools"
 *       and screen readers hear "beta" once.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Badge, SiteHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { NAV_LINKS, SITE } from "@/constants/site";

type HeaderProps = {
  /** Show the beta tag (NEXT_PUBLIC_POOLS_BETA, read by the root layout). */
  beta?: boolean;
};

export function Header({ beta = false }: HeaderProps) {
  return (
    <SiteHeader
      brand={
        <div className="flex items-center gap-2">
          <Link href="/" className="font-extrabold text-c1 text-xl tracking-tight">
            {SITE.name}
            <span aria-hidden="true" className="text-h1">
              .
            </span>
          </Link>
          {beta ? <Badge tone="muted">beta</Badge> : null}
        </div>
      }
      links={NAV_LINKS}
      actions={<AccountMenu />}
    />
  );
}
