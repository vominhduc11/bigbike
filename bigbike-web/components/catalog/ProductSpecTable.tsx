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
    // `leading-relaxed!` neo line-height (1.625) để override reset
    // `.bb-wp-tabs .tab-panel *{line-height:inherit}` (0,2,0); các phần tử con
    // `line-height:inherit` sẽ kéo lại trị số đã neo ở wrapper, tránh bị giãn
    // dòng 2.3 của tab-panel làm loãng.
    <div className="mb-4 leading-relaxed!">
      {/* Tiêu đề chỉ hiện desktop — mobile đã có nhãn section do ProductTabs
          tự chèn qua `before:content-[attr(data-label)]`, không lặp lại. */}
      <h3 className="mb-6 font-body text-xl font-semibold tracking-normal text-[var(--bb-text-primary)] leading-tight! max-md:hidden">
        {tProduct("specifications")}
      </h3>
      <dl className="m-0 border-t border-border">
        {specifications.map((spec, index) => {
          const name = safeText(spec.name, tProduct("specifications"));
          const value = safeText(spec.value, tProduct("stockState.UNKNOWN"));
          return (
            <div
              key={`${name}-${index}`}
              className="flex flex-col gap-1 border-b border-border py-4 md:flex-row md:items-baseline md:gap-8 md:py-5"
            >
              <dt className="shrink-0 font-semibold text-[var(--bb-text-primary)] md:w-[30%] md:max-w-[240px] md:pl-5">
                {name}:
              </dt>
              <dd className="m-0 text-[var(--bb-text-secondary)] md:flex-1">
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
