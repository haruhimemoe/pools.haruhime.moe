<p align="center"><a href="https://pools.haruhime.moe"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner-on-light.svg"><img alt="pools.haruhime.moe" src="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner.svg" width="640"></picture></a></p>

# pools.haruhime.moe

Build an osu! tournament mappool at **https://pools.haruhime.moe**. Search every osu! map under a mod and see its star rating, AR and OD with it, check the pool against the content rules for officially supported tournaments, see where each map was played before, build it with co-editors, and download it on packs. Past tournament pools are there as reference: search them, see every tournament a map was played in, and start a pool from one.

pools is in beta: things can move around, and some past pools are still missing. Tell us what's wrong in the [Discord server](https://discord.gg/bKy9kjMV4y) or at contact@haruhime.moe.

The site never hosts beatmap files. "Download on packs" and "Open in packs" open the pool on [packs.haruhime.moe](https://packs.haruhime.moe), which downloads each map from the beatmap mirror straight to your browser.

## Features

- **Build a pool:** sign in with osu!, make one at `/new` from a name (and the tournament, round and year if you like), then edit it at `/pools/<id>/edit`. Maps sit in their slots (NM, HD, HR, DT, FM, TB and custom slots with forced mods or freemod), each with buttons to move it up, down or to another slot and to remove it; paste slot lines, IDs or links to add or replace maps, and any line that can't be read is listed. Every change saves at once; if someone else changed the pool first, the editor reloads it and says your last change wasn't saved. Undo (or Ctrl+Z / Cmd+Z outside a text field) takes back your own last changes in this session, up to 20 steps; there's no redo, and an undo that meets someone else's change is dropped with a notice. The summary shows the map count, each slot's star range with its mods, beatmapsets in two slots, the maps past pools played, and the content rules check.
- **Plan a pool:** each slot can have a target: how many maps it should hold (0 to 16) and a star range under its mods. The editor shows a placeholder row for the maps still missing ("2 more NM maps") and a badge on a map whose stars fall outside its slot's range, and the summary lists both. `/new` offers templates (Qualifiers, Group stage, Knockout, Finals) that set the counts only; they're common shapes, and you can change them. Find maps on a slot with a star range puts the range in the star filter.
- **Slot notes:** each map in a pool can carry a short note (up to 280 characters), like "jump aim check" or "replace if ranked late". Notes follow the map when it moves, show under it in the editor and on the pool's page, and go when the map does.
- **Map previews:** each set in the map browser and each map in a pool shows its cover, with a button to play osu!'s preview clip (one at a time). Both load in your browser straight from osu!'s servers; pools never proxies or stores them.
- **Export:** a pool's page and its editor copy the beatmap IDs with their slots, copy the `!mp map <id> 0` and `!mp mods` lines for each slot (None for no mods, the forced mods, or Freemod, as osu!'s tournament commands take them), and download a CSV of the maps with their values under each slot's mods. All of it is made in your browser from what the page shows.
- **Mod lens:** the map browser beside the pool searches osu! maps under a mod lens (NM, HD, HR, DT, EZ, HT, FL, HDHR, HDDT, HRDT, HDHRDT, EZDT and EZHT, each offered only while the hinai mirror lists mod data for it), by text, status, sort, and star rating, BPM, length, AR and OD under that mod. It can hide the pool's own maps and maps past pools played, says how many sets and difficulties it left out, and adds a difficulty to the slot that matches the lens (or asks which). AR, OD and CS the mirror has no mod data for are worked out and marked "no mod data". Qualified and Pending maps have no mod values, so they're searched without mods.
- **Editors:** the owner adds co-editors by osu! username (even someone who hasn't signed in yet), and they edit the pool as the owner does; the owner alone picks who can see it (private, unlisted or public), hands it to an editor who has signed in (typing its name; the old owner stays on as an editor), and deletes it once its name is typed. Editors can leave.
- **Download on packs:** an unlisted or public pool with maps gets its own pack on packs.haruhime.moe, crediting its owner and editors and kept in step within about 30 seconds of a change. The editor shows where the pack stands, with "Update pack now"; the pool's page shows "Download on packs" (the pack's page for a public pool, the pack's key link for an unlisted one), also while a change waits for the next sync. A private or deleted pool loses its pack.
- **Start from this pool:** any past pool or built pool you can see can be copied into a new private pool, maps and slots included.
- **Pool pages:** every map with its slot and its star rating, AR, OD, length and BPM under the slot's mods, a Copy ID button for `!mp map`, and the notes. A built pool's page says who built it and shows the summary; private pools show only to their owner and editors, and unlisted ones only to people with the link. A past pool's page says who it came from (otdb, the tournament's hosts or a community member, with their link) and opens in packs.
- **Pool search:** past tournament pools, public pools built here, or both, by tournament, round or name, year, number of maps or a map the pool contains; past pools also by star rating and whether the tournament was badged (once that's known). Sort by year, name or size.
- **Search every osu! map:** by title, artist or mapper, status (Ranked, Loved, Qualified, Pending or Graveyard), star rating, length and BPM. Sets that can't be used in officially supported tournaments are left out (the page says how many), sets to check first are marked, and graveyard and pending maps carry a warning. Each difficulty says how many pools played it. Explicit maps show only when you ask.
- **Maps played in pools:** by title, artist, set host or difficulty name, star rating, length, BPM, AR, OD, CS, what the map was played as (NM, HD, HR, DT, FM, TB, EZ, HT, FL), how many past pools used it and the last year one did.
- **Map pages:** the map's details and every past pool that played it, newest first.
- **Compliance check:** paste beatmap IDs or links, a pool, or a pack key, and each map's beatmapset is checked against the osu! content rules for officially supported tournaments. It's a guide, not a ruling: the osu! Tournament Committee decides.
- **Home page:** Make a pool, quick map and past pool searches, and the pools built and added lately.
- **Accounts:** anyone with an osu! account can sign in. The header shows your avatar menu (Make a pool, Your pools, Account, Sign out), your account page lists the pools you own and edit, and it deletes the account (with every pool you own and its pack) for good once you type your username. A packs outage never blocks deleting: the packs are removed there once it answers.
- **Moderation:** admins can hide or delete any built pool. A hidden pool leaves search, the sitemap and its public page (its owner and editors see "Hidden by moderation"), and its pack is unlisted on packs.
- **Submit a pool:** tournament hosts and community members send past pools in the Discord server or by email (see [Submit a pool](https://pools.haruhime.moe/submit)). An admin checks each one by hand and adds it; a pool whose maps match one we have joins it instead of making a copy.

Pool slots show star rating, AR, OD, BPM and length under each slot's mods (NM, FM and TB slots without mods). Star ratings with mods come from the hinai mirror and can differ slightly from osu!'s; a map it has no mod data for says so. Searches of maps played in pools and of all osu! maps show ratings without mods.

## Where the data comes from

Some past pools come from the public export of [otdb](https://otdb.sheppsu.me), by Sheppsu, used with his permission. Tournament hosts and community members send others, and each pool page names its sources. To send one, see [Submit a pool](https://pools.haruhime.moe/submit). Map details and star ratings come from the hinai mirror, which serves osu! API data (a map the mirror doesn't have keeps what its source gave), searching every osu! map asks the hinai mirror, and the check reads the osu! API. The [data page](https://pools.haruhime.moe/data) and the [credits page](https://pools.haruhime.moe/credits) have the rest.

## Setup

To run your own copy you need Bun 1.4+, Node 24+ and a MongoDB database. Copy `.env.example` to `.env.local` and fill it in: every variable has a comment there. [CONTRIBUTING.md](CONTRIBUTING.md) has the rest (the dev server, tests and the importer).

- **Database user:** give pools a MongoDB user with readWrite on the `pools` database only. pools reads the user's privileges when it connects and refuses to run if they reach any other database.
- **Sharing a database user:** to run pools on a user another app also uses (like packs), set `POOLS_ALLOW_SHARED_DB_USER=true`. The user still needs readWrite on `pools`, and pools logs a warning naming the other databases it can reach. A bug in pools or a leaked credential could then change the other app's data too, so a user of its own is safer.
- **Beta tag:** set `NEXT_PUBLIC_POOLS_BETA=true` to show a small "beta" tag beside the wordmark on every page. Next.js reads it when it builds the site, so changing it needs a new build.

## Stack

Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4 and MDX, on Bun. MongoDB with Mongoose and zod, and better-auth with osu! sign-in for everyone (admins are listed by osu! ID). Tests run on Vitest, lint and format on Biome.

## Packages

pools uses these shared haruhime.moe packages:

- [`@haruhimemoe/pool`](https://www.npmjs.com/package/@haruhimemoe/pool): the mappool shape, slot and mod rules, pasted-pool parsing, and the pack key codec.
- [`@haruhimemoe/osu`](https://www.npmjs.com/package/@haruhimemoe/osu): osu! API v2 shapes, the osu! sign-in settings, and the server client the check uses.
- [`@haruhimemoe/hinai`](https://www.npmjs.com/package/@haruhimemoe/hinai): the client for the hinai beatmap mirror.
- [`@haruhimemoe/compliance`](https://www.npmjs.com/package/@haruhimemoe/compliance): the content rules for officially supported tournaments.
- [`@haruhimemoe/ui`](https://www.npmjs.com/package/@haruhimemoe/ui): the theme, buttons, cards, form fields, filters, pagination, and the site header, footer and page frame.
- [`@haruhimemoe/brand`](https://www.npmjs.com/package/@haruhimemoe/brand): the wordmark, icons and link preview image.

## License

MIT. See [LICENSE](LICENSE). Not affiliated with or endorsed by ppy Pty Ltd or the osu! Tournament Committee. osu! is a trademark of ppy Pty Ltd.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in [SECURITY.md](SECURITY.md).
