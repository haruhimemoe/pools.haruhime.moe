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
 * @modified Tue Oct 6, 2026
 */

"use client";

import type { Command, Provider } from "@haruhimemoe/ui";
import { CommandPalette, siteCommands } from "@haruhimemoe/ui";
import { useMemo } from "react";
import { NAV_LINKS, SITE } from "@/constants/site";
import { accountStore, signOutHere, useAccount } from "@/lib/account";
import type { SearchResponse } from "@/schemas/search-response";

/** At most this many pools from a provider search. */
const MAX_RESULTS = 8;

/** Searches public pools by name (GET /api/search, cookie-free, 5 minutes cached by the CDN). */
const poolsProvider: Provider = {
  id: "pools.search",
  group: "Pools",
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
        group: "Pools",
        // Built pool ids carry their own "b-" prefix; next.config.ts rewrites /pools/<id>
        // for both kinds, so one href covers past and built pools.
        run: (ctx) => ctx.navigate(`/pools/${pool.id}`),
      }),
    );
  },
};

/**
 * @function AppPalette
 * @returns {JSX.Element} the mounted CommandPalette, empty until opened
 */
export function AppPalette() {
  const account = useAccount();
  const signedIn = account.status === "signed-in";

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "pools.new",
        title: "New pool",
        subtitle: "Start one from scratch, or copy a pool to build on",
        group: "Pools",
        run: (ctx) => ctx.navigate("/new"),
      },
      {
        id: "pools.search-maps",
        title: "Search maps",
        subtitle: "Every osu! map played in a pool, or all of them",
        group: "Pools",
        run: (ctx) => ctx.navigate("/search?tab=maps"),
      },
      {
        id: "pools.my-pools",
        title: "My pools",
        group: "Pools",
        when: () => signedIn,
        run: (ctx) => ctx.navigate("/account#pools"),
      },
      {
        id: "pools.sign-out",
        title: "Sign out",
        group: "Account",
        when: () => signedIn,
        run: async (ctx) => {
          await signOutHere();
          accountStore.markSignedOut();
          ctx.navigate("/");
        },
      },
      ...siteCommands({
        pages: NAV_LINKS,
        tools: "pools",
        repo: SITE.repoUrl,
        account: { signedIn, signInHref: "/signin", accountHref: "/account" },
      }),
    ],
    [signedIn],
  );

  return <CommandPalette storageKey="pools" commands={commands} providers={[poolsProvider]} />;
}
