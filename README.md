<p align="center"><a href="https://pools.haruhime.moe"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner-on-light.svg"><img alt="pools.haruhime.moe" src="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner.svg" width="640"></picture></a></p>

# pools.haruhime.moe

Past osu! tournament mappools at **https://pools.haruhime.moe**. Search pools and the maps in them, search every osu! map for ones you can pool, see every tournament a map was played in, and check a pool you're building against the content rules for officially supported tournaments.

pools is in beta: things can move around, and some pools are still missing. Tell us what's wrong in the [Discord server](https://discord.gg/bKy9kjMV4y) or at contact@haruhime.moe.

The site never hosts beatmap files. "Open in packs" opens the pool on [packs.haruhime.moe](https://packs.haruhime.moe), which downloads each map from the beatmap mirror straight to your browser.

## Features

- **Pool search:** by tournament, round or name, year, star rating, number of maps, whether the tournament was badged (once that's known), or a map the pool contains. Sort by year, name or size.
- **Search every osu! map:** by title, artist or mapper, status (Ranked, Loved, Qualified, Pending or Graveyard), star rating, length and BPM. Sets that can't be used in officially supported tournaments are left out (the page says how many), sets to check first are marked, and graveyard and pending maps carry a warning. Each difficulty says how many pools played it. Explicit maps show only when you ask.
- **Maps played in pools:** by title, artist, set host or difficulty name, star rating, length, BPM, AR, OD, CS, what the map was played as (NM, HD, HR, DT, FM, TB, EZ, HT, FL), how many pools used it and the last year one did.
- **Pool pages:** every map with its slot, star rating, length and BPM, a Copy ID button for `!mp map`, the pool's notes, who it came from (otdb, the tournament's hosts or a community member, with their link), and Open in packs.
- **Map pages:** the map's details and every pool that played it, newest first.
- **Compliance check:** paste beatmap IDs or links, a pool, or a pack key, and each map's beatmapset is checked against the osu! content rules for officially supported tournaments. It's a guide, not a ruling: the osu! Tournament Committee decides.
- **Home page:** counts, quick pool and map searches, and the pools added last.
- **Submit a pool:** tournament hosts and community members send pools in the Discord server or by email (see [Submit a pool](https://pools.haruhime.moe/submit)). An admin checks each one by hand and adds it; a pool whose maps match one we have joins it instead of making a copy.

Every star rating on the site is without mods.

## Where the data comes from

Some past pools come from the public export of [otdb](https://otdb.sheppsu.me), by Sheppsu, used with his permission. Tournament hosts and community members send others, and each pool page names its sources. To send one, see [Submit a pool](https://pools.haruhime.moe/submit). Map details and star ratings come from the hinai mirror, which serves osu! API data (a map the mirror doesn't have keeps what its source gave), searching every osu! map asks the hinai mirror, and the check reads the osu! API. The [data page](https://pools.haruhime.moe/data) and the [credits page](https://pools.haruhime.moe/credits) have the rest.

## Setup

To run your own copy you need Bun 1.4+, Node 24+ and a MongoDB database. Copy `.env.example` to `.env.local` and fill it in: every variable has a comment there. [CONTRIBUTING.md](CONTRIBUTING.md) has the rest (the dev server, tests and the importer).

- **Database user:** give pools a MongoDB user with readWrite on the `pools` database only. pools reads the user's privileges when it connects and refuses to run if they reach any other database.
- **Sharing a database user:** to run pools on a user another app also uses (like packs), set `POOLS_ALLOW_SHARED_DB_USER=true`. The user still needs readWrite on `pools`, and pools logs a warning naming the other databases it can reach. A bug in pools or a leaked credential could then change the other app's data too, so a user of its own is safer.
- **Beta tag:** set `NEXT_PUBLIC_POOLS_BETA=true` to show a small "beta" tag beside the wordmark on every page. Next.js reads it when it builds the site, so changing it needs a new build.

## Stack

Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4 and MDX, on Bun. MongoDB with Mongoose and zod, and better-auth with osu! sign-in for admins. Tests run on Vitest, lint and format on Biome.

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
