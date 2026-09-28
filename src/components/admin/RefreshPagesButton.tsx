/**
 * @file src/components/admin/RefreshPagesButton.tsx
 * @desc The refresh button: asks for every public page to be rebuilt on its next visit (after an
 *       import, so the home page, sitemap and llms.txt show it at once), and says whether it
 *       worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { AsyncButton } from "@haruhimemoe/ui";

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
  return (
    <AsyncButton
      action={refresh}
      pendingLabel="Refreshing…"
      failedMessage="The refresh didn't reach the server."
      wrapperClassName="flex-col items-start gap-2"
    >
      Refresh public pages
    </AsyncButton>
  );
}
