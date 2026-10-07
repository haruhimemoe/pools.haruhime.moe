/**
 * @file src/constants/legal-site.ts
 * @desc The LegalSite config next-kit's legal blocks render from: what pools stores, who
 *       processes it (haruhime.moe for sign-in), the cookies it reads, and the contact for legal questions. Kept in step
 *       with content/legal/privacy.mdx and disclaimers.mdx; update both when either changes.
 *       siteName and contactEmail are repeated from @/constants/site rather than imported: site.ts
 *       reads the Legal footer column from CONTENT, which reads this file, so importing SITE
 *       here would cycle back to it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Tue Oct 6, 2026
 */

import type { LegalSite } from "@haruhimemoe/next-kit/legal";

/** pools' facts for `<LegalContact />`, `<DataWeKeep />`, `<Processors />`, `<YourRights />`, `<DmcaNotice />` and `<NoWarranty />`. */
export const LEGAL_SITE: LegalSite = {
  siteName: "pools.haruhime.moe",
  operator: "haruhime.moe",
  contactEmail: "haruhime@haruhime.moe",
  effectiveDate: "2026-10-06",
  stores: [
    {
      what: "Your haruhime account's user ID, next to the pools you own and the API key you make",
      why: "Showing who owns or edits a pool (the account itself, with your osu! name and sessions, lives on haruhime.moe)",
    },
    {
      what: "Your API key, if you make one: a hash of it, its first characters and when it was made and last used",
      why: "So the API knows the key is yours",
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
      purpose: "stores pools and the data listed above.",
      link: "https://www.mongodb.com/atlas",
    },
    {
      name: "haruhime.moe",
      purpose: "runs sign-in and keeps the account and sessions pools reads to know who you are.",
      link: "https://www.haruhime.moe",
    },
    {
      name: "osu! (ppy Pty Ltd)",
      purpose:
        "confirms sign-in for haruhime.moe and answers the player and beatmap lookups pools makes.",
      link: "https://osu.ppy.sh",
    },
    {
      name: "the hinai mirror (mirror.hinamizawa.ai)",
      purpose: "runs the all-maps search and supplies star ratings with mods.",
      link: "https://mirror.hinamizawa.ai",
    },
  ],
  cookies: [
    "haruhime.moe's session cookie (on .haruhime.moe) keeps you signed in; pools only reads it. It's HttpOnly, so page scripts can't read it.",
    "haruhime-signed-in, also set by haruhime.moe, which pages can read. It only says this browser may be signed in; pages ask who you are only when it's there.",
  ],
  hosting:
    "pools never hosts beatmap files: a pool holds only its name, details, notes and the maps on it.",
};
