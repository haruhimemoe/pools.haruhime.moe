/**
 * @file src/constants/site.ts
 * @desc Site identity, the contact email and Discord server, the source repo, the parent brand
 *       and GitHub org, navigation, the affiliation notice, and the User-Agent our server sends.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

export const SITE = {
  name: "pools",
  title: "pools.haruhime.moe",
  url: "https://pools.haruhime.moe",
  description:
    "Search past osu! tournament mappools and their maps, see where a map was played before, and check a pool against the content rules for officially supported tournaments.",
  contactEmail: "contact@haruhime.moe",
  /** The haruhime.moe Discord server: pool submissions, corrections, the footer's Discord icon. */
  discordUrl: "https://discord.gg/bKy9kjMV4y",
  /** Public source repository, linked from the footer. */
  repoUrl: "https://github.com/haruhimemoe/pools.haruhime.moe",
  /** The parent brand, linked from the footer wordmark. */
  parentUrl: "https://www.haruhime.moe",
  /** The GitHub organization, linked from the footer's GitHub mark. */
  githubOrg: "https://github.com/haruhimemoe",
  trademarkNotice:
    "Not affiliated with or endorsed by ppy Pty Ltd or the osu! Tournament Committee. osu! is a trademark of ppy Pty Ltd.",
} as const;

/** Sent as User-Agent on every request our server makes (osu!, the mirror, otdb, packs). */
export const SERVER_USER_AGENT = `${SITE.title} (+${SITE.url}; ${SITE.contactEmail})`;

export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/check", label: "Check a pool" },
];
