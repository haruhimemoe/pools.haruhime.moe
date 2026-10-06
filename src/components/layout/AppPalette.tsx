/**
 * @file src/components/layout/AppPalette.tsx
 * @desc The one CommandPalette for the whole site, mounted once in the root layout: ui's
 *       siteCommands (Navigate from NAV_LINKS, Page, Help) plus pools' own extras (New pool,
 *       Search maps, My pools) and a provider over public pools (GET /api/search, unauthenticated,
 *       cookie-free). Account commands read `useAccount` client-side instead of a server prop:
 *       the root layout renders no session today, and a layout that read it would make every page
 *       dynamic, so sign-in state is read the same way the header's AccountMenu already reads it.
 *       Sign-out has no navigable route here (better-auth's client ends the session, not a GET
 *       page), so it runs the same signOut-then-markSignedOut pools' SignOutButton uses, instead
 *       of siteCommands' href-based default.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import type { Command, Provider } from "@haruhimemoe/ui";
import { CommandPalette, siteCommands } from "@haruhimemoe/ui";
import { useMemo } from "react";
import { NAV_LINKS, SITE } from "@/constants/site";
import { markSignedOut, useAccount } from "@/lib/account";
import { authClient } from "@/lib/auth-client";
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
          await authClient.signOut();
          markSignedOut();
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
