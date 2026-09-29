/**
 * @file src/components/home/HomeAbout.tsx
 * @desc The home page's closing section: "What pools is" (one paragraph naming the tasks in the
 *       words people search with) and the FAQ, each question an h3 with its answer. The same
 *       questions go out as FAQPage JSON-LD. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card } from "@haruhimemoe/ui";
import type { HomeFaq } from "@/constants/home";

/**
 * @function HomeAbout
 * @param props {{ intro: string; faq: readonly HomeFaq[] }} the paragraph and the questions
 * @returns {JSX.Element} What pools is, then the questions and answers
 */
export function HomeAbout({ intro, faq }: { intro: string; faq: readonly HomeFaq[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="What pools is">
        <p className="text-c2">{intro}</p>
      </Card>
      <Card title="Questions">
        <div className="flex flex-col gap-4">
          {faq.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-bold text-c1">{q}</h3>
              <p className="mt-1 text-c3 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
