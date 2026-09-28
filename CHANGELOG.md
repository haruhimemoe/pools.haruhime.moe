# Changelog

All notable changes to pools.haruhime.moe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Slot targets: how many maps each slot should hold and a star range under its mods, with placeholder rows, out-of-range badges and a list in the summary. `/new` offers Qualifiers, Group stage, Knockout and Finals templates that set the counts, and Find maps fills in the slot's star range.
- Build a pool: anyone signs in with osu! and makes pools at `/new`, then edits them at `/pools/<id>/edit`: details, maps in slots (built-in and custom, with forced mods or freemod), moving without drag, pasted slot lines, IDs or links, and a summary with the content rules check. Every change saves at once, and a change someone else made first reloads the pool.
- A map browser in the editor that searches osu! maps under a mod lens, with star rating, AR, OD, BPM and length under that mod, and adds a difficulty to the matching slot.
- Pool slots show their values under the slot's mods, on past and built pools.
- Co-editors, added by osu! username; who can see a pool (private, unlisted or public); deleting a pool or the whole account.
- Unlisted and public built pools with maps get their own pack on packs.haruhime.moe, crediting the owner and editors and kept in step after each change. The editor shows the pack's state with "Update pack now", and the pool's page shows "Download on packs".
- "Start from this pool" on past and built pool pages copies a pool's maps into a new private pool.
- Search's pools tab lists past tournament pools, public pools built here, or both; public built pools are in the sitemap and llms.txt, and the home page lists them under Recently built.
- Admins hide, unhide and delete built pools from `/admin`; a hidden pool's pack is unlisted on packs.
- The home page, site description and llms.txt lead with building a pool; past pools stay as reference.
- Past tournament pools from otdb's export, tournament hosts and community members, each with its tournament, round and year, its notes, who it came from (with the link they gave) and a link to open it in packs.
- Admins add pools that hosts and community members send at `/admin/pools/new`: a packs link, a pack key, or slot lines and beatmap IDs. A pool whose maps match one we have joins it instead of making a copy.
- Search every osu! map through the hinai mirror, by text, status, star rating, length and BPM, with explicit maps on request. Sets that can't be used in officially supported tournaments are left out and counted, sets to check first are marked, unranked maps carry a warning, and each difficulty says how many pools played it. The maps tab opens on all maps; Played in pools keeps the old search, and old links still open it.
- Pool search by text, year, star rating, number of maps, badged and a contained map, sorted by year, name or size.
- Search of maps played in pools by text, star rating, length, BPM, AR, OD, CS, what the map was played as, times used and last year used, sorted by use, last use, star rating, length or title.
- Map pages with every pool that played the map.
- A compliance check for pasted beatmap IDs, links, pools and pack keys, against the content rules for officially supported tournaments.
- An admin area for listed osu! accounts: import reports, pool edits, badged tournaments, pack sync retries and a refresh of the public pages after an import.
- Credits, disclaimer and privacy pages, a sitemap and llms.txt.
- `/data` (where pools and map details come from, the content rules, corrections) and `/submit` (how to send a pool in the Discord server or by email).
- A footer with pools, Data, About and Legal columns and the Discord server.
- Recently added on the home page: the 8 pools added last.
- Sign-in errors land on the sign-in page with a plain explanation, including "That osu! account isn't a pools admin."
- `POOLS_ALLOW_SHARED_DB_USER`: set it to `true` to run on a database user that other apps share, like packs'. pools still needs readWrite on `pools` and logs a warning naming the other databases. Unset, pools keeps refusing any user that reaches another database.
- A small "beta" tag beside the wordmark on every page while the site is built with `NEXT_PUBLIC_POOLS_BETA=true`. Pages stay indexable and titles don't change.
