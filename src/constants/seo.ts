/**
 * @file src/constants/seo.ts
 * @desc Search and link-preview copy: the one next-kit `Site` every seo helper reads (home
 *       keyword title, the 160-character description, the static link preview, haruhime.moe as
 *       the organization and parent), each static page's title and description, the
 *       WebApplication features, the search URL template for the WebSite SearchAction, and the
 *       /search default state's common starts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { HARUHIME_ORG, type Site } from "@haruhimemoe/next-kit/seo";
import { SITE } from "@/constants/site";

/** The site as @haruhimemoe/next-kit/seo reads it: "osu! tournament mappool builder · host". */
export const SEO_SITE: Site = {
  name: SITE.name,
  url: SITE.url,
  title: "osu! tournament mappool builder",
  // A long pool or map name ends " · pools" instead, so the title stays within 60 characters.
  shortTitleSuffix: "pools",
  description: SITE.description,
  ogImages: [
    {
      url: "/opengraph-image.png",
      width: 1200,
      height: 630,
      alt: "pools: osu! mappools for tournament hosts",
      type: "image/png",
    },
  ],
  organization: HARUHIME_ORG,
  parent: { name: "haruhime.moe", url: SITE.parentUrl },
};

/** A static page's title (before " · host") and its 140 to 160 character description. */
export type PageSeo = { title: string; description: string };

/** The static public pages' titles and descriptions, by path. */
export const PAGE_SEO = {
  "/search": {
    title: "Search osu! tournament mappools and maps",
    description:
      "Search past osu! tournament mappools, pools built on pools, the maps they played and every osu! map, filtered by year, star rating, length, BPM, AR and OD.",
  },
  "/check": {
    title: "osu! mappool content rules checker",
    description:
      "Paste beatmap IDs, links or a pack key and check each map against the osu! content rules for officially supported tournaments. Guidance, not a ruling.",
  },
  "/submit": {
    title: "Submit a past osu! tournament mappool",
    description:
      "How tournament hosts and community members send a past osu! tournament mappool: post in the Discord server or email, with the round, year, maps and credit.",
  },
  "/data": {
    title: "Where pool and map data comes from",
    description:
      "Where the past pools and map details on pools come from, how star ratings with mods and the content rules check work, and how to send a correction.",
  },
  "/credits": {
    title: "Credits",
    description:
      "Who pools is built on: otdb by Sheppsu, tournament hosts and community members, the hinai mirror, BoBERT by token03 and the osu! Mappool Compliance project.",
  },
} as const satisfies Record<string, PageSeo>;

/** What the WebApplication node lists as features. */
export const APP_FEATURES: readonly string[] = [
  "Mappool builder with slots, co-editors and candidates",
  "Search every osu! map under a mod (star rating, AR, OD, BPM and length)",
  "Content rules check for officially supported tournaments",
  "Past osu! tournament mappools and where each map was played",
  "Find similar maps",
  "Export beatmap IDs, !mp lines and CSV; download as a pack on packs.haruhime.moe",
];

/** The WebSite SearchAction's URL: the pools tab reads `q`. */
export const SEARCH_URL_TEMPLATE = "/search?q={search_term_string}";

/** A map page is indexed, and in the sitemap, once this many current pools use it. */
export const MAP_INDEX_MIN_POOLS = 2;

/** Past pools the /search default state lists. */
export const SEARCH_LATEST_POOLS = 20;

/** Where the /search default state suggests starting: a label and its search link. */
export const SEARCH_STARTS: readonly { label: string; href: string }[] = [
  { label: "osu! World Cup pools", href: "/search?q=osu!%20World%20Cup" },
  { label: "Pools built on pools", href: "/search?type=built" },
  { label: "Pools with the most maps", href: "/search?sort=maps" },
  { label: "Every osu! map", href: "/search?tab=maps" },
  { label: "Maps played in 10 or more pools", href: "/search?tab=maps&scope=played&used=10-" },
  { label: "Maps played most recently", href: "/search?tab=maps&scope=played&sort=last" },
];

/** The /search default state's intro: what can be searched, before the page loads. */
export const SEARCH_INTRO =
  "Search past osu! tournament mappools by tournament, round or year, pools people built here, the maps those pools played (by star rating, AR, OD, length, BPM and how often they were picked), or every osu! map on the hinai mirror. Maps officially supported tournaments can't use are left out.";
