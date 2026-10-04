/**
 * @file src/utils/llms-txt.ts
 * @desc /llms.txt and /llms-full.txt (llmstxt.org), through next-kit's llmsTxt: title, a
 *       one-paragraph summary, the notes a reader needs first (building a pool first; past pools
 *       as reference, from otdb, tournament hosts and community members; star ratings with mods
 *       from the mirror; packs for past and built pools and no file hosting; every osu! map
 *       searchable; sending a pool; beta; the check is guidance; no API), then Docs, API and Legal
 *       from the content registry, then the pages (Make a pool among them). /llms.txt stays short: the latest LLMS_SHORT_POOLS past pools and
 *       public built pools, a link to the full lists, the legal pages, the source, and the other
 *       haruhime.moe tools. /llms-full.txt lists every current past pool, every public built
 *       pool with who built it and the most used maps. Link notes come from sources and
 *       builders, so their markdown is escaped (next-kit escapes the link titles). Sections with
 *       nothing in them are left out. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { contentLlmsTxt } from "@haruhimemoe/next-kit/docs";
import { llmsTxt } from "@haruhimemoe/next-kit/seo";
import { CONTENT } from "@/constants/content";
import { LLMS_ABOUT, LLMS_API, LLMS_NOTES, LLMS_PAGES, LLMS_TOOLS } from "@/constants/llms";
import { SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";
import { mapLabel } from "@/utils/map-record";
import { builtHeadline, poolHeadline } from "@/utils/pool-text";
import { usageSummary } from "@/utils/usage";

/** One link in llms.txt, with a short note. */
export type LlmsLink = { title: string; url: string; note?: string };
/** A heading and its links. */
export type LlmsSection = { heading: string; links: readonly LlmsLink[] };

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

/** A public built pool as llms.txt lists it. */
export type LlmsBuiltPool = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  maps: number;
  builtBy: string | null;
};

/** The most used maps /llms-full.txt lists. */
export const LLMS_MAP_LIMIT = 500;

/** Past pools and built pools /llms.txt lists (the latest); /llms-full.txt has them all. */
export const LLMS_SHORT_POOLS = 50;

const at = (path: string): string => `${SITE.url}${path}`;

/** Markdown that could open, close or add a link: backslashes, brackets, parentheses and <>. */
const LINK_MARKDOWN = /[\\[\]()<>]/g;

/**
 * @function escapeLinkText
 * @param text {string} text from a source (a pool's tournament, a builder's name)
 * @returns {string} one line with every backslash, bracket, parenthesis and angle bracket
 *          backslash-escaped, so a link note can't add a link or break the one before it
 */
export const escapeLinkText = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .replace(LINK_MARKDOWN, (mark) => `\\${mark}`);

const builtLine = (pool: LlmsBuiltPool): string =>
  [
    builtHeadline(pool),
    `${pool.maps} ${pool.maps === 1 ? "map" : "maps"}`,
    pool.builtBy ? `Built by ${pool.builtBy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

const poolLinks = (pools: readonly LlmsPool[]): LlmsLink[] =>
  pools.map((pool) => ({
    title: pool.name,
    url: at(`/pools/${pool._id}`),
    note: escapeLinkText(poolHeadline(pool)),
  }));

const builtLinks = (built: readonly LlmsBuiltPool[]): LlmsLink[] =>
  built.map((pool) => ({
    title: pool.name,
    url: at(`/pools/${pool.id}`),
    note: escapeLinkText(builtLine(pool)),
  }));

/** What llms.txt is given: current past pools, public built pools and the most used maps. */
export type LlmsData = {
  pools: readonly LlmsPool[];
  built?: readonly LlmsBuiltPool[];
  maps: readonly LlmsMap[];
};

/**
 * @function llmsSections
 * @param data {LlmsData} current past pools (newest year first), public built pools (newest
 *        change first) and the most used maps
 * @returns {LlmsSection[]} the full lists: Pages, Pools, Built pools, Maps, About,
 *          haruhime.moe tools
 */
export const llmsSections = ({ pools, built = [], maps }: LlmsData): LlmsSection[] => [
  { heading: "Pages", links: LLMS_PAGES },
  { heading: "Pools", links: poolLinks(pools) },
  { heading: "Built pools", links: builtLinks(built) },
  {
    heading: "Maps",
    links: maps.map((map) => ({
      title: mapLabel(map, map._id),
      url: at(`/maps/${map._id}`),
      note: escapeLinkText(usageSummary(map.usage)),
    })),
  },
  { heading: "About", links: LLMS_ABOUT },
  { heading: "haruhime.moe tools", links: LLMS_TOOLS },
];

/**
 * @function shortLlmsSections
 * @param data {Omit<LlmsData, "maps">} current past pools and public built pools
 * @returns {LlmsSection[]} the short index: Pages, the latest LLMS_SHORT_POOLS past and built
 *          pools, a link to /llms-full.txt, About, haruhime.moe tools
 */
export const shortLlmsSections = ({ pools, built = [] }: Omit<LlmsData, "maps">): LlmsSection[] => [
  { heading: "Pages", links: LLMS_PAGES },
  { heading: "Latest pools", links: poolLinks(pools.slice(0, LLMS_SHORT_POOLS)) },
  { heading: "Latest built pools", links: builtLinks(built.slice(0, LLMS_SHORT_POOLS)) },
  {
    heading: "Full lists",
    links: [
      {
        title: "llms-full.txt",
        url: at("/llms-full.txt"),
        note: `every current past pool (${pools.length}), every public pool built here (${built.length}) and the ${LLMS_MAP_LIMIT} most used maps`,
      },
      { title: "Sitemap", url: at("/sitemap.xml"), note: "every indexed page" },
    ],
  },
  { heading: "About", links: LLMS_ABOUT },
  { heading: "haruhime.moe tools", links: LLMS_TOOLS },
];

/**
 * @function llmsSectionsMarkdown
 * @param sections {readonly LlmsSection[]} link sections
 * @returns {string} just the sections, in llms.txt form (next-kit's llmsTxt escaping), each
 *          after a blank line; empty sections left out, "" when all are
 */
export const llmsSectionsMarkdown = (sections: readonly LlmsSection[]): string =>
  llmsTxt({ title: "-", summary: "-", sections }).split("\n").slice(3).join("\n");

/**
 * @function buildLlmsTxt
 * @param sections {readonly LlmsSection[]} pools' own link sections, after the registry's
 * @param notes {readonly string[]} paragraphs between the summary and the sections
 * @returns {string} the llms.txt body: title, summary and notes, then Docs, API and Legal from
 *          the content registry (next-kit's contentLlmsTxt, each page linking its .md mirror),
 *          then the non-empty sections given; ending in one newline
 */
export const buildLlmsTxt = (
  sections: readonly LlmsSection[],
  notes: readonly string[] = LLMS_NOTES,
): string =>
  `${contentLlmsTxt({
    site: SEO_SITE,
    title: SITE.title,
    summary: SITE.description,
    notes,
    content: CONTENT,
    api: LLMS_API,
  }).replace(/\n$/, "")}\n${llmsSectionsMarkdown(sections)}`;
