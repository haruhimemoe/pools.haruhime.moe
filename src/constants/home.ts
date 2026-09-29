/**
 * @file src/constants/home.ts
 * @desc The home page's "What pools is" paragraph and its FAQ (shown on the page and sent as
 *       FAQPage JSON-LD, so both say the same thing). Plain text: no markup, no em dashes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { PACKS_SITE_URL } from "@/constants/pools";
import { SITE } from "@/constants/site";

/** What pools is, in the words people search with. */
export const HOME_INTRO =
  "pools is a free osu! tournament mappool builder. Sign in with osu!, search every osu! map under a mod (star rating, AR and OD with HR or DT on), put maps in slots with co-editors, and run the content rules checker for officially supported tournaments. It also keeps past osu! tournament mappools, so you can see where a map was played before.";

/** One question on the home page, with its answer. */
export type HomeFaq = { q: string; a: string };

/** The home page's questions, in order. */
export const HOME_FAQ: readonly HomeFaq[] = [
  {
    q: "Is pools free?",
    a: "Yes. Searching, the check and building pools cost nothing. Building needs an osu! sign-in; nothing else does. The code is MIT licensed on GitHub.",
  },
  {
    q: "Where does the pool data come from?",
    a: "Past pools come from a few places: a public export of past tournament pools, tournament hosts and community members. Each pool page names its sources, and the Data page has the details. Map details and star ratings come from the hinai mirror, which serves osu! API data.",
  },
  {
    q: "What does the content rules check cover?",
    a: "Each map is checked against the osu! wiki's content usage permissions and official support pages, through the osu! Mappool Compliance project's rules, reading the beatmapset from the osu! API. It's guidance, not a ruling: the osu! Tournament Committee decides.",
  },
  {
    q: "How do I download a pool?",
    a: `Every past pool, and every unlisted or public pool built here with maps, has a pack on ${new URL(PACKS_SITE_URL).host}. The pool's page links it, and packs downloads each map from the mirror straight to your browser. pools never hosts beatmap files.`,
  },
  {
    q: "How do I submit a past pool?",
    a: `Post it in the haruhime.moe Discord server or email ${SITE.contactEmail} with the tournament, round, year and maps (a packs link is easiest). An admin checks every pool by hand before it shows up.`,
  },
];
