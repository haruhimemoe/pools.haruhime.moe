/**
 * @file src/app/account/page.tsx
 * @desc /account: the signed-in user's osu! name and avatar (linking their osu! profile), sign
 *       out, a link to /admin for admins, Your pools (#pools: counts, then the pools they own
 *       and edit), the API key card, and "Delete my account" with the typed-username confirmation. Sign-in
 *       otherwise; never indexed. Restores the header's signed-in marker for a session that has
 *       none.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

import { osuAvatarSrc } from "@haruhimemoe/next-kit/auth-react";
import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { userUrl } from "@haruhimemoe/osu/shapes";
import { ButtonLink, Card, PageHeader, TextLink } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Image from "next/image";
import { ApiKeySection } from "@/components/account/ApiKeySection";
import { YourPools } from "@/components/account/YourPools";
import { SEO_SITE } from "@/constants/seo";
import { DeleteAccountForm, RestoreSignedIn, SignOutButton } from "@/lib/account";
import { apiKeys } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth-session";
import { listBuiltPoolsFor } from "@/services/built-pools";

/** The account page's title; it's never indexed. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/account",
  title: "Account",
  index: false,
});

/**
 * @function AccountPage
 * @returns {Promise<JSX.Element>} the signed-in user's osu! account, their pools and the delete
 *          form (a visitor goes to sign in)
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const avatar = osuAvatarSrc(user.avatarUrl);
  const [pools, apiKey] = await Promise.all([listBuiltPoolsFor(user), apiKeys.info(user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <RestoreSignedIn />
      <PageHeader
        title="Account"
        actions={
          <>
            {user.isAdmin ? (
              <ButtonLink href="/admin" variant="secondary">
                Admin
              </ButtonLink>
            ) : null}
            <SignOutButton />
          </>
        }
      />
      <Card title="Your osu! account">
        <div className="flex items-center gap-3">
          {avatar ? (
            <Image src={avatar} alt="" width={48} height={48} className="rounded-full" />
          ) : null}
          <TextLink href={userUrl(user.osuId)} rel="noopener" variant="plain" className="text-lg">
            {user.username}
          </TextLink>
        </div>
      </Card>
      <Card id="pools" title="Your pools">
        <YourPools {...pools} />
      </Card>
      <ApiKeySection initial={apiKey} />
      <Card title="Delete my account">
        <DeleteAccountForm
          username={user.username}
          appName="pools"
          deletes="This deletes your account and every pool you own (with its pack on packs), takes you off the pools you edit, and signs you out everywhere. It can't be undone."
        />
      </Card>
    </div>
  );
}
