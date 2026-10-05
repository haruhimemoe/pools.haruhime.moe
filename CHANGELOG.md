# Changelog

All notable changes to pools.haruhime.moe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `/brand`: the pools name, logos, colors and type with the files to download, from `@haruhimemoe/brand` 0.7.0's `brandPageData("pools")` rendered by `@haruhimemoe/ui` 0.11.0's `BrandPage`.
- `/docs` and `/legal` index pages with a section nav, and a Markdown copy of every docs and legal page at `<page>.md` (a "Copy as Markdown" button on each page).
- Version history: every save of a built pool is kept; restore any version from `/pools/<id>/history`, which lists each one's changes; the owner can make the history public.

### Changed

- Depends on `@haruhimemoe/ui` 0.16.0: map rows in the editor, search and built pools use the shared map cards (cover, stars under the slot's mods, stats), the built pool page has a Copy ID button per map instead of the ID as text, map sets in the browser and all-maps search share one set card, and the map page's banner is the kit's cover.
- `@haruhimemoe/next-kit` 0.7.0 and `@haruhimemoe/vcs` 0.1.0 for pool history.
- Two editors saving at once no longer lose a change: saves merge, and only real conflicts reload the editor.
- Docs and legal pages share one content registry (`src/constants/content.ts`, `@haruhimemoe/next-kit` 0.6.1's `defineContent`), the same layout packs uses. The API docs moved from a TSX page to `content/docs/api.mdx`; `/docs/api` keeps its URL. Legal page titles now read "pools Terms" and so on.
- `/llms.txt` lists Docs, API and Legal from the registry, each page linking its `.md` copy, before the pages and pools. `/llms-full.txt` is now Markdown with the text of every docs and legal page, then the full lists.
- The sitemap adds `/brand`, `/docs` and `/legal`.
- `@haruhimemoe/ui` 0.11.1: decorative alt on brand page previews.
- `@haruhimemoe/ui` 0.11.2: Copy as Markdown works on Safari and iOS.
- Depends on `@haruhimemoe/ui` 0.12.0: buttons and form fields are 44px tall on touch screens, motion stops when your system asks for reduced motion, colors get stronger when it asks for more contrast, warnings use the same amber as the notices, your pools' names are white, and the links on the home, sign-in and pool source pages use the accent color.
- Depends on `@haruhimemoe/ui` 0.13.0: pool search results, the docs and legal index cards and the empty-slot hint in the builder have rounder corners, and map detail labels are smaller and lighter, like packs and haruhime.moe.
- Depends on `@haruhimemoe/ui` 0.14.0 and `@haruhimemoe/next-kit` 0.8.0: deleting a pool, handing it to an editor and deleting your account each open a dialog where you type the name, removing an editor asks first, admins confirm deleting a built pool in a dialog, and the regenerate and revoke buttons for API keys are red.
- Depends on `@haruhimemoe/ui` 0.15.0: in the pool editor the drag handle is a button you can reach with Tab and pick up with Space, maps and candidates move by mouse, touch or keyboard with each step read out, a dashed outline marks where a drop lands and says why a candidate can't go somewhere, and the dragged row keeps its full brightness.
- Depends on `@haruhimemoe/ui` 0.17.0: dates on docs and legal pages read like Oct 4, 2026, and legal text is a size smaller.

## [0.1.0] - 2026-10-04

### Added

- API keys: make an `hpl_` key on your account page and call `/api/v1/me` with it. The [API docs](https://pools.haruhime.moe/docs/api) page lists the endpoints. Keys and the `/api/v1` guard come from `@haruhimemoe/next-kit` 0.5.0, shared with packs and bb.

### Changed

- Depends on `@haruhimemoe/ui` 0.9.0: the legal pages' MDX elements (links, heading anchors, the table wrapper, GitHub-style callouts) now come from its shared `mdxComponents` and `@haruhimemoe/ui/remark` instead of a local override; `src/mdx-components.tsx` is a thin pass-through. The legal content has no fenced code, so no shiki highlighter is wired in.
- `/data`'s first two sections are headed "Pool data" and "Map data", as the footer links read; a section named "Pools" doubled the footer's pools column for screen readers.
- Depends on `@haruhimemoe/ui` 0.7.0, its accessibility release: one footer nav with headed columns, field errors read as polite status messages instead of alerts, a visible focus ring on fields, 24px slider thumbs and chips, lighter accent links, and beatmap stats that read their full names ("Circle size") to screen readers.

- "Leaderboard maps only" in "Similar to <map>" now shows the 20 closest maps that have a leaderboard instead of filtering the 20 closest of all maps, which were mostly graveyard (map 129891 kept 2 of 18). `scripts/similar` stores a second list per map (`nl`, `sl`: the top 20 among ranked, approved and loved maps, by BoBERT's `status` column), which `?status=leaderboard` reads; rows imported before it existed still get the filter. The "left out" line shows only when the filter drops something. The import grows from about 80 MB to about 137 MB.

### Added

- "Similar to <map>" has a "Leaderboard maps only (ranked, approved, loved)" switch, on by default, so pattern matches (mostly graveyard maps) show poolable maps first. It says how many of the similar maps it left out, and turning it off is kept in the browser's URL state. `GET /api/maps/<id>/similar?status=leaderboard` applies it; the answer adds `unranked` and `total`.
- Past pools and public built pools have their own link preview: the pool's name with its year, map count, star range and mods (`/pools/<id>/og.png`, drawn by `@haruhimemoe/brand` 0.6.0). Unlisted and private pools keep the site's image.
- A long pool or map title ends in "· pools" instead of "· pools.haruhime.moe", so search results show it whole (`@haruhimemoe/next-kit` 0.4.0).
- The footer's tools column is now ui 0.6.0's shared "haruhime tools" column (packs, bb, All tools), the same on every haruhime.moe site.

- A "What pools is" paragraph and five questions on the home page, with the same questions as FAQPage structured data. Structured data on the home page (the haruhime.moe organization, the site with its search, the app), on past pool pages (a Dataset) and map pages, with breadcrumbs.
- `/search` sends a real page before its script loads: the heading, what can be searched, common searches and the 20 latest past pools.
- `/llms-full.txt` with every current past pool, every public built pool and the 500 most used maps; `/llms.txt` is now a short index that links it.
- Map pages say in one line how often and how a map was played, and where last. The footer links the other haruhime.moe tools.
- Find similar on every map in the map browser, each slot and candidate in the editor, and Your candidates: a "Similar to <map>" source with up to 20 maps that play alike and how similar each is, under the current mod lens and the slot's target star range, with the content rules applied and the pool's own maps left out. Pattern matches come from the embeddings [BoBERT](https://github.com/token03/bobert) by token03 publishes (MIT, credited next to the results and on /credits); maps it doesn't cover get a difficulty match on stars, BPM, length, AR, OD and CS, labelled as such. `GET /api/maps/<id>/similar` answers it (rate limited and cached like search). `scripts/similar/` precomputes the table offline.
- Candidates per slot: up to 10 maps a slot is still considering besides its pick (100 per pool). Add them from the map browser with "Add as candidate" (choose the slot, or a new one); each slot's "N candidates" list shows their stars under the slot's mods, who added them, a note and votes ("2 of 3 editors", yours as a toggle), with Promote and Remove. A pick can be demoted ("Demote") to a candidate and its slot stays. Drag a candidate onto a pick to promote it, a pick onto a list to demote it, or a candidate to another slot of the same bucket. Undo covers them, and the activity log records every candidate change but votes. Only the owner and editors ever see candidates: the pool's page, the API for anyone else, exports, the pack on packs, targets, the summary and the content rules check go by picks alone.
- "Your candidates" in the map browser: every candidate (and, if you like, every pick) from the pools you own or edit, newest first, filtered by slot and text, with stars under the current bucket's mods. Add or Add as candidate copies one into the pool you're editing, with its note.
- Drag and drop in the editor: drag a map by its handle onto another row or slot, with a mouse or on a touch screen. The Up, Down and Move buttons stay for the keyboard.
- An activity log for built pools: every change records who made it, when and what, and the editor shows the last 20 under Recent changes (owner and editors only). A pool keeps its last 200 entries for up to 180 days; deleting an account renames its entries to "deleted user".
- Export on built pool pages and in the editor: copy beatmap IDs, copy `!mp map` and `!mp mods` lines per slot, and download a CSV with values under each slot's mods.
- Undo in the editor (and Ctrl+Z / Cmd+Z outside text fields): takes back your own last changes in this session, up to 20 steps, by sending their inverse. No redo.
- Map previews: covers and osu!'s preview clips (one at a time) in the map browser, the editor and built pool pages, loaded straight from osu!'s servers. The Content-Security-Policy now names the image and media hosts.
- Notes on slots: a short note on each map (up to 280 characters), shown under it in the editor and on the pool's page.
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
- /llms.txt ends with an About section: the source on GitHub, GitHub private vulnerability reporting and security.txt.

### Changed

- Titles, descriptions, canonicals, link previews, robots.txt and the sitemap now come from `@haruhimemoe/next-kit/seo` (0.3.0). The home page is titled "osu! tournament mappool builder", past pools "<name> mappool", and every public page has its own canonical and og:url (every `/search` query string shares `/search`). robots.txt names each AI crawler and allows them all, as before.
- Map pages used in only one pool are no longer indexed or in the sitemap (they stay reachable and followable). Superseded pools' pages aren't indexed. Missing pools and maps are titled "not found".
- The site description is shorter (160 characters), and the legal pages have fuller descriptions.
- Removing a pick from a slot that has candidates keeps the slot (with no pick) instead of closing the bucket up, and adding a map to such a slot makes it the pick. Moving a map within its bucket moves its slot's candidates with it; moving it to another bucket leaves them. A custom slot with candidates can't be removed.
- Deleting an account also takes its votes and its name off the candidates of pools it edited.
- `@haruhimemoe/next-kit` 0.2.1.
- Adding an editor looks the osu! username up with `@haruhimemoe/osu` 0.4.0's `getUser` on the shared client, inside the same osu! budget, instead of pools' own token and request. `@haruhimemoe/hinai` is 0.3.1, on the same osu.
- Sign in, sign out, the account menu and Delete my account now come from `@haruhimemoe/next-kit/auth-react` 0.2.0, and the pool's visibility picker from `@haruhimemoe/ui` 0.5.0 (`VisibilitySelect`), instead of pools' own copies. They look and work as before; the account page's delete button now goes home with a full page load, and the avatar in the header menu is a plain image.
- The shared packages move to ui 0.4.0, osu 0.3.0, hinai 0.3.0, pool 0.2.0, compliance 0.1.1 and brand 0.4.0. Duration, star, BPM and stat text now comes from `@haruhimemoe/osu/format` (the same text as before). Past pools keep their slots in the order their source lists them.
- The content filter, the mods that change a star rating, DT and HT speeds, and the packs service contract come from `@haruhimemoe/pool` 0.2.0, the same definitions packs uses. Tests check every pack input pools builds against that contract, the 500-character description limit included.
- The server plumbing (JSON route helpers, the same-origin guard, rate limits and the osu! budget, env parsing, the MongoDB client and its indexes, osu! sign-in, the signed-in marker, `useAccount` and `RestoreSignedIn`, security.txt) comes from `@haruhimemoe/next-kit` 0.1.0, which packs uses too. Behavior stays the same, except that the privilege check at connect now runs after Mongoose is attached (a failed check still refuses the connect), the osu! budget retries once on a duplicate key like rate limits, and its failure log reads `[osu-api] budget`.
- The chips, radios and confirmations come from `@haruhimemoe/ui` 0.4.0: `ChoiceChips` for the pool type and map status, `RadioGroup` for visibility and the new owner, `TypeToConfirm` for deleting a pool or your account and handing a pool over (after a delete the form stays gone while the page moves on, as before), and `InlineConfirm` for an admin deleting a built pool, which now puts focus on Cancel when it asks.
- Tags, links, tab strips and tables use ui 0.4.0's `Badge`, `TextLink`, `LinkTabs` and table primitives. Links in running text are underlined at rest, and the Pools / Maps switch on /search is a row of pill tabs like the maps scope.
- Star ratings on pool pages, the map browser, all-maps results and map pages are ui's `StarRating` pills (read as "5.23 stars"), slot labels are `ModBadge` pills colored by mod, and the map browser and map pages list CS, AR, OD, HP, BPM and length with `BeatmapStats`, which leaves out a value that isn't known instead of showing "?" or "–".
- The admin buttons that run something (Refresh public pages, Retry pack cleanup, the two sync retries) are ui's `AsyncButton`, each with its own result (while one sync retry runs the other is off, as before, so two runs never send the same pools twice); the account menu is ui's `HeaderMenu` (it now also closes when focus leaves it); the map browser pages with ui's `Pagination` in button mode.
- SECURITY.md and /.well-known/security.txt name GitHub private vulnerability reporting first, then the email.
- Inside: no source file over about 250 lines, no import cycles, a doc comment on every export (with a test that keeps it so), GitHub Actions pinned to commit SHAs, and components that export only components.

[unreleased]: https://github.com/haruhimemoe/pools.haruhime.moe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haruhimemoe/pools.haruhime.moe/releases/tag/v0.1.0
