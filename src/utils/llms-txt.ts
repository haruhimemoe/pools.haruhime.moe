/**
 * @file src/utils/llms-txt.ts
 * @desc /llms.txt (llmstxt.org): title, a one-paragraph summary, the notes a reader needs first
 *       (where the data comes from, no-mod stars, no file hosting, the check is guidance, no
 *       API), then the pages, every current pool, the most used maps and the legal pages.
 *       Link titles and descriptions come from sources, so their markdown is escaped. Sections
 *       with nothing in them are left out. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
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
  "pools lists past osu! tournament mappools, the maps in them, and where each map was played before. Pool data comes from otdb, by Sheppsu. Map details and star ratings come from the hinai mirror. Every star rating is without mods.",
  "Each pool opens on packs.haruhime.moe as a pack, to download its maps. pools never hosts beatmap files.",
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
          "Search and filter pools and maps; filters, sort and page live in the query string.",
      },
      {
        title: "Check a pool",
        url: at("/check"),
        description:
          "Paste beatmap IDs or links, a pool, or a pack key to check each map against the content rules for officially supported tournaments.",
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
