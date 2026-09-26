# Contributing

Bug reports and fixes are welcome. For anything bigger than a fix, open an [issue](https://github.com/haruhimemoe/pools.haruhime.moe/issues) first so we can agree on it.

Read [AGENTS.md](./AGENTS.md) before changing code. It has the layout, code style and data rules.

## Setup

Requires Bun 1.4+ and Node 24+.

```sh
bun install
cp .env.example .env.local
bun run dev
```

The dev server runs on http://localhost:3000. The site needs a MongoDB database: set `MONGODB_URI` in `.env.local` (a local `mongod` works). Admin sign-in and the check also need an osu! OAuth app: fill in the first five variables (each one has a comment in `.env.example`).

To fill a local database, run the importer against a copy of otdb's export without touching packs:

```sh
bun run import otdb --file mappools-export.json --no-sync
```

Add `--dry-run` to see the plan without writing anything. The importer reads otdb only; host and community pools are added one at a time by a signed-in admin at `/admin/pools/new`.

Searching every osu! map calls the hinai mirror from the server, so the maps tab's All osu! maps needs network access in dev; Played in pools reads only your database.

`bun install` also sets up a lefthook pre-commit hook that runs Biome on staged files.

## Making a change

1. Branch from `main` (`feat/<topic>`, `fix/<topic>`).
2. Write a failing test in `tests/`, make it pass, and keep commits small.
3. If people will see the change, update the copy that describes it in the same PR: the README, `/data`, `/submit`, the credits page, the legal pages or llms.txt. AGENTS.md section 7 lists them.
4. Run the full check before opening a PR:

   ```sh
   bun run check && bun run typecheck && bun run test && SKIP_ENV_VALIDATION=true bun run build
   ```

5. Open a PR using the template. CI must be green before merge.

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

## Tests

`bun run test` runs three Vitest projects. Run one with `bun run test:unit`, `test:components` or `test:integration`.

- `tests/unit/`: pure code, in Node, with `TZ=America/Los_Angeles`.
- `tests/components/`: React components in jsdom.
- `tests/integration/`: route handlers, services and the importer against an in-memory MongoDB (mongodb-memory-server). The first run downloads the MongoDB binary.

Tests never reach osu!, the mirror (its batch lookup and its search), otdb or packs: msw stands in for them (`tests/helpers/*-server.ts`, `tests/helpers/mirror-search.ts`), with recorded fixtures in `tests/fixtures/`.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run build` | Production build |
| `bun run check` / `check:fix` | Biome lint, format and import order |
| `bun run typecheck` | Route type generation, then `tsc` |
| `bun run test` | All Vitest projects |
| `bun run test:coverage` | Tests with v8 coverage; fails under 90% on `src/utils/` and `src/schemas/` |
| `bun run import otdb` | The importer: `--dry-run`, `--file <path>`, `--no-sync`, `--resync rejected` |

CI runs the same checks, with `test:coverage` in place of `test`.
