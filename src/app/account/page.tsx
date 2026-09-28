/**
 * @file src/app/account/page.tsx
 * @desc /account: the signed-in user's osu! name and avatar (linking their osu! profile), sign
 *       out, a link to /admin for admins, Your pools (#pools: counts, then the pools they own
 *       and edit), and "Delete my account" with the typed-username confirmation. Sign-in
 *       otherwise; never indexed. Restores the header's signed-in marker for a session that has
 *       none.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { userUrl } from "@haruhimemoe/osu/shapes";
import { ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Image from "next/image";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { YourPools } from "@/components/account/YourPools";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RestoreSignedIn } from "@/lib/account";
import { requireUser } from "@/lib/auth-session";
import { listBuiltPoolsFor } from "@/services/built-pools";
import { avatarSrc } from "@/utils/avatar";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const avatar = avatarSrc(user.avatarUrl);
  const pools = await listBuiltPoolsFor(user);
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
          <a
            href={userUrl(user.osuId)}
            rel="noopener"
            className="font-bold text-c1 text-lg underline-offset-2 hover:underline"
          >
            {user.username}
          </a>
        </div>
      </Card>
      <Card id="pools" title="Your pools">
        <YourPools {...pools} />
      </Card>
      <Card title="Delete my account">
        <DeleteAccountForm username={user.username} />
      </Card>
    </div>
  );
}
