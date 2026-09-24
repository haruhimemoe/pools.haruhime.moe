/**
 * @file scripts/import.ts
 * @desc `bun run import otdb [--dry-run] [--file <path>] [--no-sync] [--resync rejected]`:
 *       imports past tournament pools (src/lib/import-runner.ts does the work). Connects with
 *       MONGODB_URI and reaches packs with PACKS_URL and POOLS_SERVICE_TOKEN from the
 *       environment (Bun loads .env.local). Runs with the react-server condition (package.json),
 *       so server-only modules load outside Next.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { closeDb } from "@/lib/db";
import { runImport } from "@/lib/import-runner";

const code = await runImport(process.argv.slice(2));
await closeDb();
process.exit(code);
