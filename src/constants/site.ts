/**
 * @file src/constants/site.ts
 * @desc Site identity, the contact email and Discord server, the source repo, the parent brand
 *       and GitHub org, navigation and the footer's own columns (ui's SiteFooter adds the other
 *       haruhime tools), the home page's builder line, the affiliation notice, the User-Agent our server sends, the haruhime.moe hub's account page and cookie domain, the
 *       shared signed-in marker and sign-in's landing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { SHARED_MARKER_COOKIE } from "@haruhimemoe/next-kit/auth-react";
import { contentPath } from "@haruhimemoe/next-kit/docs";
import type { SiteFooterColumn } from "@haruhimemoe/ui";
import { CONTENT } from "@/constants/content";

/** The site's name, URL, description (the meta description, 160 characters at most) and links. */
export const SITE = {
  name: "pools",
  title: "pools.haruhime.moe",
  url: "https://pools.haruhime.moe",
  description:
    "Build an osu! tournament mappool: search every osu! map under a mod, check the content rules and download it as a pack, with past tournament pools as reference.",
  contactEmail: "haruhime@haruhime.moe",
  /** The haruhime.moe Discord server: pool submissions, corrections, the footer's Discord icon. */
  discordUrl: "https://haruhime.moe/discord",
  /** Public source repository, linked from the footer. */
  repoUrl: "https://github.com/haruhimemoe/pools.haruhime.moe",
  /** GitHub private vulnerability reporting, the first way to report one (SECURITY.md). */
  advisoriesUrl: "https://github.com/haruhimemoe/pools.haruhime.moe/security/advisories/new",
  /** The parent brand, linked from the footer wordmark. */
  parentUrl: "https://www.haruhime.moe",
  /** The GitHub organization, linked from the footer's GitHub mark. */
  githubOrg: "https://github.com/haruhimemoe",
  trademarkNotice:
    "Not affiliated with or endorsed by ppy Pty Ltd or the osu! Tournament Committee. osu! is a trademark of ppy Pty Ltd.",
} as const;

/** Sent as User-Agent on every request our server makes (osu!, the mirror, otdb, packs). */
export const SERVER_USER_AGENT = `${SITE.title} (+${SITE.url}; ${SITE.contactEmail})`;

/** Where sign-in comes back to when `next` is missing or not a safe path. */
export const DEFAULT_AFTER_SIGN_IN = "/account";

/** The haruhime.moe account page: the osu! account, sessions, sign-out and deleting the account. */
export const HUB_ACCOUNT_URL = "https://www.haruhime.moe/account";

/** The hub's sign-in route that goes straight to osu!, with `next` the absolute pools URL. */
export const HUB_SIGN_IN_PATH = "/api/signin/osu";

/** The hub's cookie domain: its session cookie and the marker live on every haruhime.moe host. */
export const HUB_COOKIE_DOMAIN = ".haruhime.moe";

/** The readable "signed in" marker the hub sets on .haruhime.moe: pages ask for the session only
 * when it's there. pools only reads it. */
export const SIGNED_IN_COOKIE = SHARED_MARKER_COOKIE;

/** The header's links. */
export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/check", label: "Check a pool" },
  { href: "/submit", label: "Submit a pool" },
];

/** The header's account menu links, above Sign out. */
export const ACCOUNT_MENU_ITEMS: readonly { href: string; label: string }[] = [
  { href: "/new", label: "Make a pool" },
  { href: "/account#pools", label: "Your pools" },
  { href: "/account", label: "pools settings" },
];

/** What the builder does, in one line. */
export const BUILDER_LINE =
  "Search every osu! map under a mod and see its star rating, AR and OD with it, check the pool against the content rules for officially supported tournaments, see where each map was played before, work on it with co-editors, and download it on packs.";

/** The footer's own link columns: pools, Data, About and Legal (ui adds "haruhime tools"). */
export const FOOTER_COLUMNS: readonly SiteFooterColumn[] = [
  {
    title: "pools",
    items: [
      { href: "/search", label: "Search" },
      { href: "/check", label: "Check a pool" },
      { href: "/submit", label: "Submit a pool" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/data#pools", label: "Pool data" },
      { href: "/data#maps", label: "Map data" },
      { href: "/credits", label: "Credits" },
    ],
  },
  {
    title: "About",
    items: [
      { href: SITE.repoUrl, label: "Source on GitHub" },
      { href: `mailto:${SITE.contactEmail}`, label: SITE.contactEmail },
    ],
  },
  {
    title: "Legal",
    items: CONTENT.entries.legal.map(({ slug, title }) => ({
      href: contentPath("legal", slug),
      label: title,
    })),
  },
];
