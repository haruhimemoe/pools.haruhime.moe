/**
 * @file tests/components/builder/BucketSection.test.tsx
 * @desc A bucket short of its target shows the EmptyState placeholder, not the old dashed box.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BucketSection } from "@/components/builder/BucketSection";
import type { SlotGroup } from "@/utils/built-editor";

const noop = vi.fn();

const GROUP: SlotGroup = {
  code: "NM",
  entry: { code: "NM", color: 0, mods: { kind: "free" } },
  slots: [],
};

describe("BucketSection", () => {
  it("shows the missing-slots placeholder as an EmptyState, not a p box", () => {
    render(
      <BucketSection
        group={GROUP}
        maps={{}}
        values={{}}
        targets={[]}
        plan={{ count: 2 }}
        notes={{}}
        onFind={noop}
        onRemoveBucket={noop}
        onMove={noop}
        onMoveTo={noop}
        onRemove={noop}
        onNote={noop}
      />,
    );
    const placeholder = screen.getByText("2 more NM maps");
    expect(placeholder.tagName).toBe("DIV");
    expect(placeholder.className).toContain("rounded-[10px]");
    expect(placeholder.className).toContain("border-dashed");
    expect(placeholder.className).toContain("border-b2");
    expect(placeholder.className).toContain("px-3");
    expect(placeholder.className).toContain("py-2");
    expect(placeholder.className).toContain("mt-2");
  });
});
