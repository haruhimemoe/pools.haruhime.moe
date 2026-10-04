/**
 * @file tests/unit/utils/llms-txt.test.ts
 * @desc /llms.txt: title, summary, the notes a reader needs first (building a pool first; past
 *       pools from otdb, hosts and
 *       community members, no-mod stars, no file hosting, guidance not rulings, no API), the
 *       pages (Make a pool, Submit a pool and Data among them), every current pool, every public
 *       built pool with who built it and the most used maps it's given, the legal pages; markdown in imported names escaped so a name can't add a
 *       link or break one; empty sections left out; the short index keeps the latest 50 pools,
 *       links /llms-full.txt and the other haruhime.moe tools, and lists no maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import { buildLlmsTxt, LLMS_SHORT_POOLS, llmsSections, shortLlmsSections } from "@/utils/llms-txt";

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
    expect(text).toContain("star ratings with mods come from the hinai mirror");
    expect(text).toContain("guidance, not a ruling");
    expect(text).toContain("- [Search](https://pools.haruhime.moe/search)");
    expect(text).toContain("- [Make a pool](https://pools.haruhime.moe/new): ");
    expect(text).toContain("a map browser that searches osu! maps under a mod");
    expect(text).toContain("- [Submit a pool](https://pools.haruhime.moe/submit): ");
    expect(text).toContain("- [Data](https://pools.haruhime.moe/data): ");
    expect(text).toContain(
      "- [osu! World Cup 2023 Grand Finals](https://pools.haruhime.moe/pools/otdb-657): osu! World Cup · Grand Finals · 2023",
    );
    expect(text).toContain(
      "- [xi - FREEDOM DiVE \\[FOUR DIMENSIONS\\]](https://pools.haruhime.moe/maps/129891): Used in 3 pools \\(latest 2023\\)",
    );
    expect(text).toContain("- [Privacy](https://pools.haruhime.moe/legal/privacy.md)");
    expect(text).toContain("- [Terms](https://pools.haruhime.moe/legal/terms.md)");
    expect(text).toContain(
      "- [Report a vulnerability](https://github.com/haruhimemoe/pools.haruhime.moe/security/advisories/new): ",
    );
    expect(text).toContain("- [security.txt](https://pools.haruhime.moe/.well-known/security.txt)");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).not.toContain("—");
  });

  it("says pools come from otdb, tournament hosts and community members, not otdb alone", () => {
    const text = buildLlmsTxt(llmsSections({ pools: [], maps: [] }));
    expect(text).toContain("otdb");
    expect(text).toContain("Sheppsu");
    expect(text).toContain("tournament hosts");
    expect(text).toContain("community members");
    expect(text).not.toMatch(/pool data comes from otdb/i);
  });

  it("escapes brackets, parentheses and angle brackets in imported names", () => {
    const text = buildLlmsTxt(
      llmsSections({
        pools: [
          {
            _id: "otdb-9",
            name: "OWC](https://evil.example/x) [",
            tournament: "OWC](https://evil.example/y) <https://evil.example/z>",
            round: null,
            year: null,
          },
        ],
        maps: [
          {
            _id: 5,
            artist: "a\\b",
            title: "Song",
            version: "[Extra",
            usage: { count: 1, lastYear: null },
          },
        ],
      }),
    );
    expect(text).toContain(
      "- [OWC\\](https://evil.example/x) \\[](https://pools.haruhime.moe/pools/otdb-9): OWC\\]\\(https://evil.example/y\\) \\<https://evil.example/z\\>",
    );
    expect(text).toContain("- [a\\\\b - Song \\[\\[Extra\\]](https://pools.haruhime.moe/maps/5): ");
    expect(text).not.toMatch(/(?<!\\)\]\(https:\/\/evil\.example/);
  });

  it("leaves out empty sections", () => {
    const text = buildLlmsTxt(llmsSections({ pools: [], maps: [] }));
    expect(text).not.toContain("## Pools");
    expect(text).not.toContain("## Built pools");
    expect(text).not.toContain("## Maps");
    expect(text).toContain("## Pages");
  });

  it("leads with building a pool and lists public built pools with who built them", () => {
    const text = buildLlmsTxt(
      llmsSections({
        pools: [],
        built: [
          {
            id: "b-a0000001",
            name: "My Cup [Finals]",
            tournament: "My Cup",
            round: "",
            year: null,
            maps: 3,
            builtBy: "peppy",
          },
        ],
        maps: [],
      }),
    );
    const [, , first, second] = text.split("\n\n");
    expect(first).toMatch(/^pools is where you build an osu! tournament mappool/);
    expect(second).toMatch(/^Past osu! tournament mappools are there as reference/);
    expect(text).toContain("its own pack on packs.haruhime.moe");
    expect(text).toContain("## Built pools");
    expect(text).toContain(
      "- [My Cup \\[Finals\\]](https://pools.haruhime.moe/pools/b-a0000001): My Cup · 3 maps · Built by peppy",
    );
  });

  it("keeps the short index short: the latest pools, the full lists' link, the other tools", () => {
    const pools = Array.from({ length: 120 }, (_, i) => ({
      _id: `otdb-${i + 1}`,
      name: `Cup ${i + 1}`,
      tournament: "Cup",
      round: null,
      year: 2020,
    }));
    const text = buildLlmsTxt(shortLlmsSections({ pools }));
    expect(text).toContain("## Latest pools");
    expect(text).toContain(`(https://pools.haruhime.moe/pools/otdb-${LLMS_SHORT_POOLS})`);
    expect(text).not.toContain(`(https://pools.haruhime.moe/pools/otdb-${LLMS_SHORT_POOLS + 1})`);
    expect(text).toContain(
      "- [llms-full.txt](https://pools.haruhime.moe/llms-full.txt): every current past pool (120)",
    );
    expect(text).toContain("- [packs.haruhime.moe](https://packs.haruhime.moe/llms.txt): ");
    expect(text).toContain("- [bb.haruhime.moe](https://bb.haruhime.moe/llms.txt): ");
    expect(text).not.toContain("/maps/");
    expect(text.length).toBeLessThan(20_000);
  });
});
