/**
 * @file src/components/pools/PoolSources.tsx
 * @desc Where a pool came from: each source (an otdb pool links to its page there; a host or
 *       community pool names who sent it, linking the link they gave, marked nofollow ugc
 *       noopener since an admin typed it for someone else), the sources of earlier versions, and
 *       a credit line for each source with a fixed author (otdb by Sheppsu).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { TextLink } from "@haruhimemoe/ui";
import { SOURCE_CREDITS } from "@/constants/pools";
import type { FormerSource, PoolSource } from "@/schemas/pool";

/** Links someone sent us: no ranking credit, no window.opener. */
const SENT_LINK_REL = "nofollow ugc noopener";

const SourceEntry = ({ source }: { source: PoolSource | FormerSource }) => {
  if (source.kind === "otdb") {
    return (
      <TextLink href={source.url} rel="noreferrer" className="font-bold">
        {SOURCE_CREDITS.otdb.label} pool #{source.id}
      </TextLink>
    );
  }
  const { name, url } = source.credit;
  return (
    <>
      {SOURCE_CREDITS[source.kind].lead}{" "}
      {url ? (
        <TextLink href={url} rel={SENT_LINK_REL} className="font-bold">
          {name}
        </TextLink>
      ) : (
        <span className="font-bold text-c1">{name}</span>
      )}
    </>
  );
};

const keyOf = (source: PoolSource | FormerSource): string =>
  `${source.kind}:${source.id}${"leftAt" in source ? `:${source.leftAt.toISOString()}` : ""}`;

/**
 * @function PoolSources
 * @param props {PoolSourcesProps} the pool's sources and former sources
 * @returns {JSX.Element} each source with its credit and link, and who the data comes from
 */
export function PoolSources({
  sources,
  formerSources,
}: {
  sources: readonly PoolSource[];
  formerSources: readonly FormerSource[];
}) {
  const otdb = [...sources, ...formerSources].some((source) => source.kind === "otdb");
  const credit = SOURCE_CREDITS.otdb;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {sources.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={keyOf(source)}>
              <SourceEntry source={source} />
            </li>
          ))}
        </ul>
      ) : null}
      {formerSources.length > 0 ? (
        <div>
          <p className="text-c3">Earlier versions of this pool came from:</p>
          <ul className="flex flex-col gap-1">
            {formerSources.map((source) => (
              <li key={keyOf(source)}>
                <SourceEntry source={source} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {otdb ? (
        <p className="text-c3">
          Pool data from{" "}
          <TextLink href={credit.url} rel="noreferrer">
            {credit.label}
          </TextLink>{" "}
          by {credit.author}.
        </p>
      ) : null}
    </div>
  );
}
