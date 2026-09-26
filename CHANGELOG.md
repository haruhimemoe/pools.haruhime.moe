# Changelog

All notable changes to pools.haruhime.moe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
