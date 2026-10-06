/**
 * @file src/constants/legal-site.ts
 * @desc The LegalSite config next-kit's legal blocks render from: what pools stores, who
 *       processes it, the cookies it sets, and the contact for legal questions. Kept in step
 *       with content/legal/privacy.mdx and disclaimers.mdx; update both when either changes.
 *       siteName and contactEmail are repeated from @/constants/site rather than imported: site.ts
 *       reads the Legal footer column from CONTENT, which reads this file, so importing SITE
 *       here would cycle back to it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { LegalSite } from "@haruhimemoe/next-kit/legal";

/** pools' facts for `<LegalContact />`, `<DataWeKeep />`, `<Processors />`, `<YourRights />`, `<DmcaNotice />` and `<NoWarranty />`. */
export const LEGAL_SITE: LegalSite = {
  siteName: "pools.haruhime.moe",
  operator: "haruhime.moe",
  contactEmail: "contact@haruhime.moe",
  effectiveDate: "2026-10-05",
  stores: [
    {
      what: "Your osu! account link: user ID, username, avatar URL and country, and the record linking it to osu! (never your osu! tokens)",
      why: "Signing you in and showing who owns or edits a pool",
    },
    {
      what: "Sign-in sessions, with the IP address and browser User-Agent each one started from",
      why: "Keeping you signed in for up to 7 days after you last use the site",
    },
    {
      what: "The pools you make: their name, details, notes, maps, owner and editors",
      why: "The pool builder you asked for",
    },
    {
      what: "A pool's candidates, activity log (its last 200 changes, each kept at most 180 days) and saved version history",
      why: "Letting its owner and editors review and restore its past",
    },
    {
      what: "Short-lived rate-limit counters, keyed by IP address or account",
      why: "Stopping floods and abuse; deleted automatically within minutes or hours",
    },
    {
      what: "What the osu! API says about a beatmapset, kept for 24 hours",
      why: "Making the content rules check faster on the next request",
    },
  ],
  processors: [
    {
      name: "Vercel",
      purpose: "hosts the site and keeps request logs.",
      link: "https://vercel.com",
    },
    {
      name: "MongoDB Atlas",
      purpose: "stores pools, accounts and sessions.",
      link: "https://www.mongodb.com/atlas",
    },
    {
      name: "osu! (ppy Pty Ltd)",
      purpose: "runs sign-in and supplies your profile.",
      link: "https://osu.ppy.sh",
    },
    {
      name: "the hinai mirror (mirror.hinamizawa.ai)",
      purpose: "runs the all-maps search and supplies star ratings with mods.",
      link: "https://mirror.hinamizawa.ai",
    },
  ],
  cookies: [
    "A short-lived cookie while sign-in runs.",
    "pools-signed-in, which pages can read. It only says this browser may be signed in; pages ask who you are only when it's there.",
    "A session cookie lasting until 7 days after you last use the site.",
  ],
  hosting:
    "pools never hosts beatmap files: a pool holds only its name, details, notes and the maps on it.",
};
