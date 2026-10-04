/**
 * @file src/constants/llms.ts
 * @desc llms.txt copy: the notes a reader needs first, the site's pages with what each does,
 *       the About links (source, vulnerability reports, security.txt) and the other
 *       haruhime.moe tools, each with its own llms.txt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sat Oct 3, 2026
 */

import type { LlmsLink } from "@haruhimemoe/next-kit/seo";
import { SITE } from "@/constants/site";

const at = (path: string): string => `${SITE.url}${path}`;

/** The paragraphs at the top of llms.txt. */
export const LLMS_NOTES: readonly string[] = [
  "pools is where you build an osu! tournament mappool: sign in with osu!, search every osu! map under a mod (star rating, AR, OD, BPM and length with that mod), put maps in slots, check the pool against the content rules for officially supported tournaments, see where each map was played before, work on it with co-editors, and download it on packs. Pools start private; the owner can make one unlisted or public.",
  "Past osu! tournament mappools are there as reference: the maps in them, and where each map was played before. Past pools come from several places: some from otdb's public export (by Sheppsu), others sent by tournament hosts and community members. Each pool page names its sources. Map details and star ratings come from the hinai mirror, which serves osu! API data; a map the mirror doesn't have keeps what its source gave. Pool slots show star rating, AR, OD, BPM and length under the slot's mods; star ratings with mods come from the hinai mirror and can differ slightly from osu!'s.",
  "Each past pool opens on packs.haruhime.moe as a pack, to download its maps, and each unlisted or public pool built here with maps gets its own pack on packs.haruhime.moe, kept in step with the pool and crediting its owner and editors. pools never hosts beatmap files.",
  "Search can cover past pools, public pools built here, and every osu! map, not only maps played in pools. Sets that can't be used in officially supported tournaments are left out, and graveyard and pending maps carry a warning.",
  `Tournament hosts and community members send past pools in the Discord server (${SITE.discordUrl}) or to ${SITE.contactEmail}. An admin checks each one by hand. The site is in beta.`,
  "The compliance check is guidance, not a ruling: the osu! Tournament Committee decides.",
  "A small public API answers with an hpl_ key from the account page; see /docs/api. /llms-full.txt lists every current past pool, every public pool built here and the most used maps.",
];

/** The public API's docs and OpenAPI document. */
export const LLMS_API: readonly LlmsLink[] = [
  {
    title: "API docs",
    url: at("/docs/api"),
    note: "The public API: hpl_ keys from the account page, rate limits, and GET /api/v1/me.",
  },
  { title: "OpenAPI", url: at("/api/v1/openapi.json"), note: "the API as an OpenAPI 3.1 document" },
];

/** The site's pages, with what each does. */
export const LLMS_PAGES: readonly LlmsLink[] = [
  {
    title: "Home",
    url: at("/"),
    note: "Make a pool, search maps and past pools, and see the pools built and added lately.",
  },
  {
    title: "Search",
    url: at("/search"),
    note: "Search and filter past tournament pools, public pools built here or both, every osu! map (sets not allowed in officially supported tournaments left out) or the maps played in pools; filters, sort and page live in the query string.",
  },
  {
    title: "Check a pool",
    url: at("/check"),
    note: "Paste beatmap IDs or links, a pool, or a pack key to check each map against the content rules for officially supported tournaments.",
  },
  {
    title: "Make a pool",
    url: at("/new"),
    note: "Sign in with osu! to build a pool: its details, maps in slots (built-in and custom, with forced mods or freemod), a map browser that searches osu! maps under a mod (star rating, AR, OD, BPM and length with that mod) and adds them to a slot, pasted IDs or links, targets per slot (a map count and star range, with templates for common rounds), a note on each map, up to 10 candidates per slot (promote, votes and notes, owner and editors only, never on the pool's page, export or pack) and a Your candidates source that reuses them, Find similar on any map (maps that play alike, from BoBERT's embeddings by token03, or a difficulty match for maps it doesn't cover), export (beatmap IDs, !mp lines, CSV), recent changes for its owner and editors, a summary and the content rules check. Pools start private; the owner can make them unlisted or public (then they get a pack on packs), add editors and hand the pool to one of them. Start from this pool, on any pool page, copies its maps into a new pool.",
  },
  {
    title: "Submit a pool",
    url: at("/submit"),
    note: "How tournament hosts and community members send a pool: post in the Discord server or email, with the tournament, round, year and maps.",
  },
  {
    title: "Data",
    url: at("/data"),
    note: "Where pools and map details come from, how the check reads the content rules, and how to send a correction.",
  },
  {
    title: "Credits",
    url: at("/credits"),
    note: "Where the data, similar maps (BoBERT by token03) and the rules come from.",
  },
];

/** The source, vulnerability reports and security.txt. */
export const LLMS_ABOUT: readonly LlmsLink[] = [
  {
    title: "Source on GitHub",
    url: SITE.repoUrl,
    note: "the site's code, MIT licensed",
  },
  {
    title: "Report a vulnerability",
    url: SITE.advisoriesUrl,
    note: "GitHub private vulnerability reporting; SECURITY.md in the repo gives the email too",
  },
  {
    title: "security.txt",
    url: at("/.well-known/security.txt"),
    note: "the security contacts, as RFC 9116 asks",
  },
];

/** The other haruhime.moe tools, each linking its own llms.txt. */
export const LLMS_TOOLS: readonly LlmsLink[] = [
  {
    title: "packs.haruhime.moe",
    url: "https://packs.haruhime.moe/llms.txt",
    note: "osu! beatmap packs: turn a mappool into one download (zip or torrent), where every pool here opens as a pack",
  },
  {
    title: "bb.haruhime.moe",
    url: "https://bb.haruhime.moe/llms.txt",
    note: "osu! BBCode editor with a live preview, templates (a tournament forum post among them) and a collab imagemap maker",
  },
  {
    title: "haruhime.moe",
    url: "https://www.haruhime.moe/llms.txt",
    note: "the parent site: every haruhime.moe tool and package",
  },
];
