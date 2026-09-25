/**
 * @file src/components/admin/RefreshPagesButton.tsx
 * @desc The refresh button: asks for every public page to be rebuilt on its next visit (after an
 *       import, so the home page, sitemap and llms.txt show it at once), and says whether it
 *       worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";

export function RefreshPagesButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setMessage(
        response.ok
          ? "Done. Each public page rebuilds on its next visit."
          : `The refresh failed (${response.status}).`,
      );
    } catch {
      setMessage("The refresh didn't reach the server.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <Button className="self-start" onClick={refresh} disabled={pending}>
        Refresh public pages
      </Button>
      <output className="text-c2 text-sm" aria-live="polite">
        {message}
      </output>
    </div>
  );
}
