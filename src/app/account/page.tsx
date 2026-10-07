/**
 * @file src/app/account/page.tsx
 * @desc /account, pools' own settings: the signed-in user's osu! name and avatar (linking their
 *       osu! profile), sign out (in place), a link to /admin for admins, Your pools (#pools: counts, then the pools
 *       they own and edit), the API key card, and "Delete my pools data" with the
 *       typed-username confirmation. The haruhime account itself (sessions, deleting it)
 *       lives on haruhime.moe/account, linked once here. Sign-in otherwise; never indexed.
 *       Catches the header up when its store missed the session.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

import { osuAvatarSrc } from "@haruhimemoe/next-kit/auth-react";
import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { userUrl } from "@haruhimemoe/osu/shapes";
import { ButtonLink, Card, PageHeader, TextLink } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Image from "next/image";
import { ApiKeySection } from "@/components/account/ApiKeySection";
import { DeletePoolsDataForm } from "@/components/account/DeletePoolsDataForm";
import { YourPools } from "@/components/account/YourPools";
import { DELETES_POOLS_DATA } from "@/constants/built-pools";
import { SEO_SITE } from "@/constants/seo";
import { HUB_ACCOUNT_URL } from "@/constants/site";
import { RestoreSignedIn, SignOutButton } from "@/lib/account";
import { apiKeys } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth-session";
import { listBuiltPoolsFor } from "@/services/built-pools";

/** The account page's title; it's never indexed. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/account",
  title: "pools settings",
  index: false,
});

/**
 * @function AccountPage
 * @returns {Promise<JSX.Element>} the signed-in user's osu! account, their pools and the
 *          delete-my-pools-data form (a visitor goes to sign in)
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const avatar = osuAvatarSrc(user.avatarUrl);
  const [pools, apiKey] = await Promise.all([listBuiltPoolsFor(user), apiKeys.info(user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <RestoreSignedIn />
      <PageHeader
        title="pools settings"
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
        <p className="mt-3 text-c3 text-sm">
          Your sessions and deleting your haruhime account are on{" "}
          <TextLink href={HUB_ACCOUNT_URL}>haruhime.moe/account</TextLink>.
        </p>
      </Card>
      <Card id="pools" title="Your pools">
        <YourPools {...pools} />
      </Card>
      <ApiKeySection initial={apiKey} />
      <Card title="Delete my pools data">
        <DeletePoolsDataForm username={user.username} deletes={DELETES_POOLS_DATA} />
      </Card>
    </div>
  );
}
