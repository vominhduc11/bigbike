"use client";

import { useTranslations } from "next-intl";
import { safeText } from "@/lib/utils/format";
import type { ProductSpecification } from "@/lib/contracts/public";

function groupSpecifications(specifications: ProductSpecification[]) {
  const groups: Array<{ group: string | null; items: ProductSpecification[] }> = [];
  for (const spec of specifications) {
    const group = spec.group?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.group === group) {
      last.items.push(spec);
    } else {
      groups.push({ group, items: [spec] });
    }
  }
  return groups;
}

export function ProductSpecTable({
  specifications,
}: {
  specifications: ProductSpecification[];
}) {
  const tProduct = useTranslations("Product");
  const groups = groupSpecifications(specifications);

  return (
    <div className="thong-so-ki-thuat">
      {groups.map((group, index) => (
        <div key={`${group.group ?? "default"}-${index}`}>
          {group.group && (
            <p>
              <strong>{group.group}</strong>
            </p>
          )}
          <ul>
            {group.items.map((spec, specIndex) => {
              const name = safeText(spec.name, tProduct("specifications"));
              const value = safeText(spec.value, tProduct("stockState.UNKNOWN"));
              return (
                <li key={`${name}-${specIndex}`}>
                  {name}: {value}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
