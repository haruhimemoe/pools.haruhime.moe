/**
 * @file src/utils/llms-txt.ts
 * @desc /llms.txt (llmstxt.org): title, a one-paragraph summary, the notes a reader needs first
 *       (pools come from otdb, tournament hosts and community members; no-mod stars, no file
 *       hosting, every osu! map searchable, sending a pool, beta, the check is guidance, no API),
 *       then the pages (Make a pool among them), every current pool, the most
 *       used maps and the legal pages.
 *       Link titles and descriptions come from sources, so their markdown is escaped. Sections
 *       with nothing in them are left out. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { mapLabel } from "@/utils/map-record";
import { poolHeadline } from "@/utils/pool-text";
import { usageSummary } from "@/utils/usage";

export type LlmsLink = { title: string; url: string; description?: string };
export type LlmsSection = { heading: string; links: LlmsLink[] };

/** A current pool as llms.txt lists it. */
export type LlmsPool = {
  _id: string;
  name: string;
  tournament: string;
  round: string | null;
  year: number | null;
};

/** A map as llms.txt lists it. */
export type LlmsMap = {
  _id: number;
  artist: string | null;
  title: string | null;
  version: string | null;
  usage: { count: number; lastYear: number | null };
};

/** The most used maps llms.txt lists. */
export const LLMS_MAP_LIMIT = 500;

const at = (path: string): string => `${SITE.url}${path}`;

export const LLMS_NOTES: readonly string[] = [
  "pools lists past osu! tournament mappools, the maps in them, and where each map was played before. Pools come from several places: some past pools from otdb's public export (by Sheppsu), others sent by tournament hosts and community members. Each pool page names its sources. Map details and star ratings come from the hinai mirror, which serves osu! API data; a map the mirror doesn't have keeps what its source gave. Every star rating is without mods.",
  "Each pool opens on packs.haruhime.moe as a pack, to download its maps. pools never hosts beatmap files.",
  "Search can cover every osu! map, not only maps played in pools. Sets that can't be used in officially supported tournaments are left out, and graveyard and pending maps carry a warning.",
  `Tournament hosts and community members send pools in the Discord server (${SITE.discordUrl}) or to ${SITE.contactEmail}. An admin checks each one by hand. The site is in beta.`,
  "The compliance check is guidance, not a ruling: the osu! Tournament Committee decides.",
  "There is no public API.",
];

/**
 * @function llmsSections
 * @param data {{ pools: readonly LlmsPool[]; maps: readonly LlmsMap[] }} current pools and the
 *        most used maps
 * @returns {LlmsSection[]} Pages, Pools, Maps, Legal
 */
export const llmsSections = ({
  pools,
  maps,
}: {
  pools: readonly LlmsPool[];
  maps: readonly LlmsMap[];
}): LlmsSection[] => [
  {
    heading: "Pages",
    links: [
      {
        title: "Home",
        url: at("/"),
        description: "What pools is, with search boxes for pools and maps.",
      },
      {
        title: "Search",
        url: at("/search"),
        description:
          "Search and filter pools, every osu! map (sets not allowed in officially supported tournaments left out) or the maps played in pools; filters, sort and page live in the query string.",
      },
      {
        title: "Check a pool",
        url: at("/check"),
        description:
          "Paste beatmap IDs or links, a pool, or a pack key to check each map against the content rules for officially supported tournaments.",
      },
      {
        title: "Make a pool",
        url: at("/new"),
        description:
          "Sign in with osu! to build a pool: its details, maps in slots (built-in and custom, with forced mods or freemod), a map browser that searches osu! maps under a mod (star rating, AR, OD, BPM and length with that mod) and adds them to a slot, pasted IDs or links, a summary and the content rules check. Pools start private; the owner can make them unlisted or public and add editors.",
      },
      {
        title: "Submit a pool",
        url: at("/submit"),
        description:
          "How tournament hosts and community members send a pool: post in the Discord server or email, with the tournament, round, year and maps.",
      },
      {
        title: "Data",
        url: at("/data"),
        description:
          "Where pools and map details come from, how the check reads the content rules, and how to send a correction.",
      },
      {
        title: "Credits",
        url: at("/credits"),
        description: "Where the data and the rules come from.",
      },
    ],
  },
  {
    heading: "Pools",
    links: pools.map((pool) => ({
      title: pool.name,
      url: at(`/pools/${pool._id}`),
      description: poolHeadline(pool),
    })),
  },
  {
    heading: "Maps",
    links: maps.map((map) => ({
      title: mapLabel(map, map._id),
      url: at(`/maps/${map._id}`),
      description: usageSummary(map.usage),
    })),
  },
  {
    heading: "Legal",
    links: LEGAL_SLUGS.map((slug) => ({
      title: LEGAL_DOCS[slug].title,
      url: at(`/legal/${slug}`),
      description: LEGAL_DOCS[slug].description,
    })),
  },
];

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Markdown that could open, close or add a link: backslashes, brackets, parentheses and <>. */
const LINK_MARKDOWN = /[\\[\]()<>]/g;

/**
 * @function escapeLinkText
 * @param text {string} text from a source (a pool name, a map's difficulty name)
 * @returns {string} one line with every backslash, bracket, parenthesis and angle bracket
 *          backslash-escaped, so it can't add a link or break the one it sits in
 */
export const escapeLinkText = (text: string): string =>
  oneLine(text).replace(LINK_MARKDOWN, (mark) => `\\${mark}`);

const linkLine = ({ title, url, description }: LlmsLink): string =>
  `- [${escapeLinkText(title)}](${url})${description ? `: ${escapeLinkText(description)}` : ""}`;

/**
 * @function buildLlmsTxt
 * @param sections {LlmsSection[]} link sections
 * @param notes {readonly string[]} paragraphs between the summary and the sections
 * @returns {string} the llms.txt body, ending in one newline
 */
export const buildLlmsTxt = (
  sections: LlmsSection[],
  notes: readonly string[] = LLMS_NOTES,
): string => {
  const lines = [
    `# ${SITE.title}`,
    "",
    `> ${oneLine(SITE.description)}`,
    ...notes.flatMap((note) => ["", oneLine(note)]),
    ...sections
      .filter(({ links }) => links.length > 0)
      .flatMap(({ heading, links }) => ["", `## ${heading}`, "", ...links.map(linkLine)]),
  ];
  return `${lines.join("\n")}\n`;
};
