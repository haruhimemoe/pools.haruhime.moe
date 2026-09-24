/**
 * @file src/app/page.tsx
 * @desc Home page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { PageHeader } from "@haruhimemoe/ui";
import { SITE } from "@/constants/site";

export default function HomePage() {
  return <PageHeader title={SITE.title} lead={SITE.description} />;
}
