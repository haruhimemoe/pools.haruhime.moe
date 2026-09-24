/**
 * @file src/components/pools/PoolSources.tsx
 * @desc Where a pool came from: a link to it at each source, the sources of earlier versions,
 *       and the credit line for every source involved (otdb by Sheppsu).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SOURCE_CREDITS, type SourceKind } from "@/constants/pools";
import type { FormerSource, PoolSource } from "@/schemas/pool";

const SourceLink = ({ source }: { source: PoolSource }) => (
  <a href={source.url} rel="noreferrer" className="font-bold text-h1 hover:underline">
    {SOURCE_CREDITS[source.kind].label} pool #{source.id}
  </a>
);

export function PoolSources({
  sources,
  formerSources,
}: {
  sources: readonly PoolSource[];
  formerSources: readonly FormerSource[];
}) {
  const kinds = [
    ...new Set<SourceKind>([...sources, ...formerSources].map((source) => source.kind)),
  ];
  return (
    <div className="flex flex-col gap-3 text-sm">
      {sources.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={`${source.kind}:${source.id}`}>
              <SourceLink source={source} />
            </li>
          ))}
        </ul>
      ) : null}
      {formerSources.length > 0 ? (
        <div>
          <p className="text-c3">Earlier versions of this pool came from:</p>
          <ul className="flex flex-col gap-1">
            {formerSources.map((source) => (
              <li key={`${source.kind}:${source.id}:${source.leftAt.toISOString()}`}>
                <SourceLink source={source} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {kinds.map((kind) => (
        <p key={kind} className="text-c3">
          Pool data from{" "}
          <a href={SOURCE_CREDITS[kind].url} rel="noreferrer" className="underline hover:text-c1">
            {SOURCE_CREDITS[kind].label}
          </a>{" "}
          by {SOURCE_CREDITS[kind].author}.
        </p>
      ))}
    </div>
  );
}
