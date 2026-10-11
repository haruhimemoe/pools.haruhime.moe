/**
 * @file src/components/account/ApiKeySection.tsx
 * @desc /account "API key" card: create an hpl_ key, show it once (read-only field, Copy, "I've
 *       saved it"), then only its prefix and dates. Regenerate and revoke each ask first with
 *       @haruhimemoe/ui's InlineConfirm. When a step swaps what the card shows, focus moves to
 *       the revealed key or the next button, and the outcome is announced in a polite live region.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import type { ApiKeyCreated, ApiKeyInfo } from "@haruhimemoe/next-kit/api-keys";
import {
  Button,
  Card,
  CopyField,
  cx,
  InlineConfirm,
  Notice,
  Text,
  TextLink,
  textClasses,
} from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { API_DOCS_PATH } from "@/constants/api";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { formatShortDate } from "@/utils/date";

const PATH = "/api/me/api-key";

type ApiKeySectionProps = {
  initial: ApiKeyInfo | null;
  /** fetch, replaced in tests. */
  fetcher?: Fetcher;
};

/** Where to send focus after the next render: the revealed key, Regenerate, or Create. */
type FocusTarget = "reveal" | "existing" | "empty" | null;

/**
 * @function ApiKeySection
 * @param props {ApiKeySectionProps} the account's key (or null), and a fetch seam
 * @returns {JSX.Element} the API key card
 */
export function ApiKeySection({ initial, fetcher = fetch }: ApiKeySectionProps) {
  const t = useTranslations("pools.apiKeySection");
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(initial);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pendingFocus, setPendingFocus] = useState<FocusTarget>(null);
  const keyFieldId = useId();

  const revealedInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const regenerateRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (pendingFocus === null) return;
    const targets: Record<Exclude<FocusTarget, null>, HTMLElement | null | undefined> = {
      reveal: revealedInputRef.current,
      existing: regenerateRef.current?.querySelector("button"),
      empty: createButtonRef.current,
    };
    targets[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  /** Runs one call at a time; a failure sets the error and rejects, so a confirm stays open. */
  const run = async (action: () => Promise<void>) => {
    // `busy` disables buttons only after a render; two clicks in one frame must not both run.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const result = await callPools<ApiKeyCreated>(fetcher, PATH, { method: "POST" });
      if (!result.ok) {
        setError(result.message);
        throw new Error(result.message);
      }
      setApiKey(result.body.apiKey);
      setRevealed(result.body.key);
      setStatus(t("apiKeyCreatedCopy"));
      setPendingFocus("reveal");
    });

  const revoke = () =>
    run(async () => {
      const result = await callPools<null>(fetcher, PATH, { method: "DELETE" });
      if (!result.ok) {
        setError(result.message);
        throw new Error(result.message);
      }
      setApiKey(null);
      setStatus(t("apiKeyRevoked"));
      setPendingFocus("empty");
    });

  const saved = () => {
    setRevealed(null);
    setStatus(t("keySaved"));
    setPendingFocus("existing");
  };

  return (
    <Card title={t("apiKey")}>
      <Text tone="muted">
        Scripts and bots can use a key to call the pools API as you. Keep it secret.{" "}
        <TextLink href={API_DOCS_PATH}>{t("readTheApiDocs")}</TextLink>
      </Text>
      <div className="mt-3 flex flex-col gap-3">
        {revealed !== null ? (
          <>
            <p className="font-bold text-c1 text-sm">{t("copyYourKeyNow")}</p>
            <CopyField
              id={keyFieldId}
              ref={revealedInputRef}
              label={t("yourNewApiKey")}
              value={revealed}
              copiedMessage={t("keyCopied")}
              failedMessage={t("couldnTCopySelect")}
            />
            <Button variant="ghost" onClick={saved}>
              {t("iVeSavedIt")}
            </Button>
          </>
        ) : apiKey === null ? (
          <Button
            ref={createButtonRef}
            variant="secondary"
            onClick={() => create().catch(() => undefined)}
            disabled={busy}
          >
            {t("createApiKey")}
          </Button>
        ) : (
          <>
            <p className="text-c2 text-sm">
              <code className="font-mono text-c1">{apiKey.prefix}…</code> Created{" "}
              {formatShortDate(apiKey.createdAt)}.{" "}
              {apiKey.lastUsedAt
                ? t("lastUsedLastusedat", { lastUsedAt: formatShortDate(apiKey.lastUsedAt) })
                : t("notUsedYet")}
            </p>
            <div ref={regenerateRef} className="flex flex-wrap items-center gap-2">
              <InlineConfirm
                trigger={t("regenerate")}
                triggerProps={{ disabled: busy }}
                question={t("yourCurrentKeyStops")}
                cancelLabel={t("keepIt")}
                confirmLabel={t("yesRegenerate")}
                confirmVariant="danger"
                onConfirm={create}
              />
              <InlineConfirm
                trigger={t("revoke")}
                triggerProps={{ variant: "ghost", disabled: busy }}
                question={t("revokeThisKeyAnything")}
                cancelLabel={t("keepIt")}
                confirmLabel={t("yesRevoke")}
                confirmVariant="danger"
                onConfirm={revoke}
              />
            </div>
          </>
        )}
      </div>
      <output aria-live="polite" className={cx("mt-2 block", textClasses({ tone: "muted" }))}>
        {status}
      </output>
      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}
