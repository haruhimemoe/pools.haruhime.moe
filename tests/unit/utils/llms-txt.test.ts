/**
 * @file tests/unit/utils/llms-txt.test.ts
 * @desc /llms.txt: title, summary, the notes a reader needs first (otdb credit, no-mod stars, no
 *       file hosting, guidance not rulings, no API), the pages, every current pool and the most
 *       used maps it's given, the legal pages; empty sections left out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { buildLlmsTxt, llmsSections } from "@/utils/llms-txt";

describe("buildLlmsTxt", () => {
  it("lists the pages, the pools and maps it's given, and the legal pages", () => {
    const text = buildLlmsTxt(
      llmsSections({
        pools: [
          {
            _id: "otdb-657",
            name: "osu! World Cup 2023 Grand Finals",
            tournament: "osu! World Cup",
            round: "Grand Finals",
            year: 2023,
          },
        ],
        maps: [
          {
            _id: 129891,
            artist: "xi",
            title: "FREEDOM DiVE",
            version: "FOUR DIMENSIONS",
            usage: { count: 3, lastYear: 2023 },
          },
        ],
      }),
    );
    expect(text.startsWith("# pools.haruhime.moe\n\n> ")).toBe(true);
    expect(text).toContain("otdb");
    expect(text).toContain("without mods");
    expect(text).toContain("guidance, not a ruling");
    expect(text).toContain("- [Search](https://pools.haruhime.moe/search)");
    expect(text).toContain(
      "- [osu! World Cup 2023 Grand Finals](https://pools.haruhime.moe/pools/otdb-657): osu! World Cup · Grand Finals · 2023",
    );
    expect(text).toContain(
      "- [xi - FREEDOM DiVE [FOUR DIMENSIONS]](https://pools.haruhime.moe/maps/129891): Used in 3 pools (latest 2023)",
    );
    expect(text).toContain("- [Privacy](https://pools.haruhime.moe/legal/privacy)");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).not.toContain("—");
  });

  it("leaves out empty sections", () => {
    const text = buildLlmsTxt(llmsSections({ pools: [], maps: [] }));
    expect(text).not.toContain("## Pools");
    expect(text).not.toContain("## Maps");
    expect(text).toContain("## Pages");
  });
});
