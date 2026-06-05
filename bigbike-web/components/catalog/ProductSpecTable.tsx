"use client";

import { useTranslations } from "next-intl";
import { safeText } from "@/lib/utils/format";
import type { ProductSpecification } from "@/lib/contracts/public";

export function ProductSpecTable({
  specifications,
}: {
  specifications: ProductSpecification[];
}) {
  const tProduct = useTranslations("Product");

  return (
    <ul className="mb-4 pl-5">
      {specifications.map((spec, index) => {
        const name = safeText(spec.name, tProduct("specifications"));
        const value = safeText(spec.value, tProduct("stockState.UNKNOWN"));
        return (
          <li key={`${name}-${index}`} className="mb-1">
            {name}: {value}
          </li>
        );
      })}
    </ul>
  );
}
