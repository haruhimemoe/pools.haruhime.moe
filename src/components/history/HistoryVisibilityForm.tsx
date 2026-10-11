/**
 * @file src/components/history/HistoryVisibilityForm.tsx
 * @desc The owner's "Who can see this pool's history": owner and editors, or anyone who can see
 *       the pool. Saved on change (PUT /api/pools/<id>/history); a failure rolls the control back
 *       and says so in a live Notice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { Notice, SegmentedControl } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { HISTORY_COPY } from "@/constants/history";
import { callPools, type Fetcher } from "@/lib/pool-client";

type Choice = "private" | "public";

type HistoryVisibilityFormProps = {
  poolId: string;
  historyPublic: boolean;
  fetcher?: Fetcher;
};

/**
 * @function HistoryVisibilityForm
 * @param props {HistoryVisibilityFormProps} the pool, whether its history is public now, and a
 *        fetcher (tests)
 * @returns {JSX.Element} the segmented control, with a live status for "Saved." or an error
 */
export function HistoryVisibilityForm({
  poolId,
  historyPublic,
  fetcher = fetch,
}: HistoryVisibilityFormProps) {
  const t = useTranslations("pools.historyVisibilityForm");
  const [value, setValue] = useState<Choice>(historyPublic ? "public" : "private");
  const [message, setMessage] = useState("");
  const onChange = async (next: Choice) => {
    setValue(next);
    const answer = await callPools(fetcher, `/api/pools/${poolId}/history`, {
      method: "PUT",
      body: { historyPublic: next === "public" },
    });
    if (answer.ok) {
      setMessage(t("saved"));
    } else {
      setValue(next === "public" ? "private" : "public");
      setMessage(answer.message);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label={HISTORY_COPY.publicLabel}
        value={value}
        onChange={onChange}
        options={[
          { value: "private", label: t("ownerAndEditors") },
          { value: "public", label: t("anyoneWhoCanSee") },
        ]}
      />
      <Notice tone={message !== "" && message !== t("saved") ? "error" : "info"} live>
        {message}
      </Notice>
    </div>
  );
}
