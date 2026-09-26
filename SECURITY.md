# Security

Please report vulnerabilities privately to **contact@haruhime.moe** instead of opening an issue or posting in the Discord server. Include steps to reproduce and the impact you expect. You'll get a reply within 7 days.

In scope: this repository and the live site at https://pools.haruhime.moe (in beta), its JSON routes (`/api/search`, including the all-maps search it passes to the mirror, and `/api/check`), its admin sign-in and admin routes (including adding a pool at `/api/admin/pools`). Pool credit links are typed by admins and open with `rel="nofollow ugc noopener"`; report one that could harm visitors the same way. Only the current `main` branch and the live site are supported.

The `@haruhimemoe` packages pools uses have their own repositories and SECURITY.md files; report problems with them there. Report problems in third-party services (osu!, the beatmap mirror, otdb) to those services.

## Database user

pools expects a MongoDB user with readWrite on the `pools` database only, and refuses to run when its user can reach any other database. Setting `POOLS_ALLOW_SHARED_DB_USER=true` turns that off, for example to share one user with packs.haruhime.moe. The user must still have readWrite on `pools`, and pools logs a warning naming the other databases (never the connection string). The risk: a bug in pools, or a leaked pools credential, could then read and change packs' data (or any other database that user reaches), not only pools'. Leave it unset unless you accept that.
