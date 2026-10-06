/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: the library SiteHeader with the pools wordmark, the main nav, the command
 *       palette button and the account menu (client-side, so public pages still read no
 *       cookies). In a beta build a small "beta" tag sits beside the wordmark, outside the link,
 *       so the link's name stays "pools" and screen readers hear "beta" once.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { Badge, CommandPaletteButton, SiteHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { ACCOUNT_MENU_ITEMS, NAV_LINKS, SITE } from "@/constants/site";
import { AccountMenu } from "@/lib/account";

type HeaderProps = {
  /** Show the beta tag (NEXT_PUBLIC_POOLS_BETA, read by the root layout). */
  beta?: boolean;
};

/**
 * @function Header
 * @param props {HeaderProps} whether to show the beta tag
 * @returns {JSX.Element} ui's SiteHeader with the wordmark, the nav and the account menu
 */
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
      actions={
        <div className="flex items-center gap-2">
          <CommandPaletteButton />
          <AccountMenu items={ACCOUNT_MENU_ITEMS} />
        </div>
      }
    />
  );
}
