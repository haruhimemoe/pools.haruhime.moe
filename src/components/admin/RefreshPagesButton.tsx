/**
 * @file src/components/admin/RefreshPagesButton.tsx
 * @desc The refresh button: asks for every public page to be rebuilt on its next visit (after an
 *       import, so the home page, sitemap and llms.txt show it at once), and says whether it
 *       worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { AsyncButton } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";

const refresh = async (): Promise<string> => {
  const response = await fetch("/api/admin/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return response.ok
    ? "Done. Each public page rebuilds on its next visit."
    : `The refresh failed (${response.status}).`;
};

/**
 * @function RefreshPagesButton
 * @returns {JSX.Element} "Refresh public pages" (ui's AsyncButton), with what happened beside it
 */
export function RefreshPagesButton() {
  const t = useTranslations("pools.refreshPagesButton");
  return (
    <AsyncButton
      action={refresh}
      pendingLabel={t("refreshing")}
      failedMessage={t("theRefreshDidnT")}
      wrapperClassName="flex-col items-start gap-2"
    >
      {t("refreshPublicPages")}
    </AsyncButton>
  );
}
