/**
 * @file src/components/admin/AdminBuiltPoolTable.tsx
 * @desc The newest unlisted and public pools built here, for admins: name (linking its page;
 *       a private one, which admins can't open, is never listed but would show no link), id,
 *       owner, who can see it, hidden, map count, pack state and when it was made, each with
 *       Hide or Unhide and Delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

import { Table, TBody, Td, Text, TextLink, THead, Th } from "@haruhimemoe/ui";
import { BuiltPoolModeration } from "@/components/admin/BuiltPoolModeration";
import { VISIBILITY_TEXT } from "@/constants/built-pools";
import type { AdminBuiltPool } from "@/services/built-moderation";

const HEADINGS = ["Pool", "Owner", "Seen by", "Maps", "Pack", "Made", "Moderation"] as const;

/**
 * @function AdminBuiltPoolTable
 * @param props {{ pools: readonly AdminBuiltPool[] }} the newest unlisted and public built pools
 * @returns {JSX.Element} the moderation table: owner, visibility, hidden, maps, pack and the
 *          buttons
 */
export function AdminBuiltPoolTable({ pools }: { pools: readonly AdminBuiltPool[] }) {
  if (pools.length === 0) {
    return <Text tone="muted">No unlisted or public pool has been built yet.</Text>;
  }
  return (
    <Table>
      <THead>
        <tr>
          {HEADINGS.map((heading) => (
            <Th key={heading}>{heading}</Th>
          ))}
        </tr>
      </THead>
      <TBody>
        {pools.map((pool) => (
          <tr key={pool.id} className="align-top">
            <Td>
              {pool.visibility === "private" ? (
                <span className="font-bold text-c1">{pool.name}</span>
              ) : (
                <TextLink href={`/pools/${pool.id}`} variant="plain">
                  {pool.name}
                </TextLink>
              )}
              <div className="text-c3 text-xs">{pool.id}</div>
            </Td>
            <Td>{pool.owner ?? "unknown"}</Td>
            <Td>
              {VISIBILITY_TEXT[pool.visibility].label}
              {pool.hidden ? (
                <Text as="div" tone="error" bold size="xs">
                  hidden
                </Text>
              ) : null}
            </Td>
            <Td>{pool.maps}</Td>
            <Td>{pool.pack}</Td>
            <Td>{pool.createdAt.toISOString().slice(0, 10)}</Td>
            <Td>
              <BuiltPoolModeration id={pool.id} name={pool.name} hidden={pool.hidden} />
            </Td>
          </tr>
        ))}
      </TBody>
    </Table>
  );
}
