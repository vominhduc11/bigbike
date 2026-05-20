"use client";

import { useTranslations } from "next-intl";
import { safeText } from "@/lib/utils/format";
import type { ProductSpecification } from "@/lib/contracts/public";

/**
 * Two-column technical specification table. Consecutive rows that share a
 * `group` are introduced by a full-width group header row.
 */
export function ProductSpecTable({
  specifications,
}: {
  specifications: ProductSpecification[];
}) {
  const tProduct = useTranslations("Product");
  if (specifications.length === 0) return null;

  return (
    <div className="overflow-hidden border border-border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {specifications.flatMap((spec, index) => {
            const group = spec.group?.trim() || null;
            const prevGroup =
              index > 0 ? specifications[index - 1].group?.trim() || null : "__none__";
            const showHeader = group !== null && group !== prevGroup;
            return [
              ...(showHeader
                ? [
                    <tr key={`group-${index}`}>
                      <th
                        colSpan={2}
                        className="bg-muted px-4 py-2 text-left font-heading text-xs font-semibold uppercase tracking-[0.04em] text-foreground"
                      >
                        {group}
                      </th>
                    </tr>,
                  ]
                : []),
              <tr key={`${index}-${spec.name}`} className="even:bg-muted/40">
                <td className="w-[36%] border-t border-border px-4 py-2.5 align-top font-medium text-muted-foreground">
                  {safeText(spec.name, tProduct("specifications"))}
                </td>
                <td className="border-t border-border px-4 py-2.5 align-top text-foreground">
                  {safeText(spec.value, tProduct("stockState.UNKNOWN"))}
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
