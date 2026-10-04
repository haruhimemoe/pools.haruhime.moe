/**
 * @file src/app/api/v1/openapi.json/route.ts
 * @desc GET /api/v1/openapi.json: the public API's OpenAPI 3.1 document. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import { SEO_SITE } from "@/constants/seo";

/** Built once at build time. */
export const dynamic = "force-static";

const DOCUMENT = {
  openapi: "3.1.0",
  info: { title: "pools.haruhime.moe API", version: "1" },
  servers: [{ url: `${SEO_SITE.url}/api/v1` }],
  components: {
    securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "hpl_ key" } },
  },
  security: [{ apiKey: [] }],
  paths: {
    "/me": {
      get: {
        summary: "Who the API key belongs to",
        responses: {
          "200": { description: "The key owner" },
          "401": { description: "No or bad key" },
          "429": { description: "Rate limited" },
        },
      },
    },
  },
};

/**
 * @function GET
 * @returns {Response} the OpenAPI document
 */
export const GET = (): Response => Response.json(DOCUMENT);
