/**
 * @file src/components/layout/AppPalette.tsx
 * @desc The one CommandPalette for the whole site, mounted once in the root layout: ui's
 *       siteCommands (Navigate from NAV_LINKS, Page, Help) plus pools' own extras (New pool,
 *       Search maps, My pools) and a provider over public pools (GET /api/search, unauthenticated,
 *       cookie-free). Account commands read `useAccount` client-side instead of a server prop:
 *       the root layout renders no session today, and a layout that read it would make every page
 *       dynamic, so sign-in state is read the same way the header's AccountMenu already reads it.
 *       Sign out runs the same POST /api/signout the header's menu uses (signOutHere,
 *       src/lib/account.ts: the hub session ends for every tool, without leaving pools), tells the
 *       store, then goes home.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { uiLabels } from "@haruhimemoe/next-kit/i18n";
import type { Command, Provider } from "@haruhimemoe/ui";
import { CommandPalette, siteCommands } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { navLinks, SITE } from "@/constants/site";
import { accountStore, signOutHere, useAccount } from "@/lib/account";
import type { SearchResponse } from "@/schemas/search-response";

/** At most this many pools from a provider search. */
const MAX_RESULTS = 8;

/** Searches public pools by name (GET /api/search, cookie-free, 5 minutes cached by the CDN). */
const poolsProvider = (group: string): Provider => ({
  id: "pools.search",
  group,
  search: async (query, signal) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return [];
    const data = (await response.json()) as SearchResponse;
    if (data.tab !== "pools") return [];
    return data.results.slice(0, MAX_RESULTS).map(
      (pool): Command => ({
        id: `pools.search.${pool.id}`,
        title: pool.name,
        subtitle: [pool.tournament, pool.round].filter(Boolean).join(" · ") || undefined,
        group,
        // Built pool ids carry their own "b-" prefix; next.config.ts rewrites /pools/<id>
        // for both kinds, so one href covers past and built pools.
        run: (ctx) => ctx.navigate(`/pools/${pool.id}`),
      }),
    );
  },
});

/**
 * @function AppPalette
 * @returns {JSX.Element} the mounted CommandPalette, empty until opened
 */
export function AppPalette() {
  const t = useTranslations("pools");
  const tUi = useTranslations("ui");
  const ui = useMemo(() => uiLabels(tUi), [tUi]);
  const account = useAccount();
  const signedIn = account.status === "signed-in";

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "pools.new",
        title: t("palette.new"),
        subtitle: t("palette.newSub"),
        group: t("palette.pools"),
        run: (ctx) => ctx.navigate("/new"),
      },
      {
        id: "pools.search-maps",
        title: t("palette.searchMaps"),
        subtitle: t("palette.searchMapsSub"),
        group: t("palette.pools"),
        run: (ctx) => ctx.navigate("/search?tab=maps"),
      },
      {
        id: "pools.my-pools",
        title: t("palette.myPools"),
        group: t("palette.pools"),
        when: () => signedIn,
        run: (ctx) => ctx.navigate("/account#pools"),
      },
      {
        id: "pools.sign-out",
        title: ui.account.signOut,
        group: ui.siteCommands.account,
        when: () => signedIn,
        run: async (ctx) => {
          await signOutHere();
          accountStore.markSignedOut();
          ctx.navigate("/");
        },
      },
      ...siteCommands({
        pages: navLinks(t),
        tools: "pools",
        repo: SITE.repoUrl,
        account: { signedIn, signInHref: "/signin", accountHref: "/account" },
        labels: ui.siteCommands,
      }),
    ],
    [signedIn, t, ui],
  );

  const providers = useMemo(() => [poolsProvider(t("palette.pools"))], [t]);
  return (
    <CommandPalette
      storageKey="pools"
      commands={commands}
      providers={providers}
      labels={ui.palette}
      placeholder={ui.paletteProps.placeholder}
      label={ui.paletteProps.label}
    />
  );
}
