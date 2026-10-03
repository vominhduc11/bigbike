"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { trackSearch } from "@/lib/analytics";

/**
 * Ô nhập từ khoá của riêng trang kết quả (SEARCH_RULE_006). Trước đây trang chỉ in dòng
 * "Nhập từ khoá để tìm kiếm sản phẩm." mà không có chỗ nào để nhập, và khách muốn sửa từ khoá
 * phải quay lên kính lúp ở đầu trang.
 */
export function SearchPageForm({
  initialQuery,
  resultCount,
  resultsAvailable,
}: {
  initialQuery: string;
  resultCount: number;
  resultsAvailable: boolean;
}) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
  const router = useRouter();
  // Trang gắn key={initialQuery} nên khi từ khoá trên URL đổi (kể cả bằng nút lùi/tiến của
  // trình duyệt) component được dựng lại và ô nhập tự bám theo — không cần effect đồng bộ.
  const [value, setValue] = useState(initialQuery);
  const lastTrackedResultRef = useRef<string | null>(null);

  useEffect(() => {
    const query = initialQuery.trim();
    if (!resultsAvailable || !query) return;
    const key = `${locale}:${query}`;
    if (lastTrackedResultRef.current === key) return;
    lastTrackedResultRef.current = key;
    trackSearch(query, resultCount, "results_page");
  }, [initialQuery, locale, resultCount, resultsAvailable]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 100) return;
    router.push(`${toSearchPath(locale)}?s=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="mb-6 flex w-full max-w-[560px] items-stretch gap-2"
      data-search-page-form
    >
      <Input
        type="search"
        name="s"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("inputPlaceholder")}
        aria-label={t("inputAriaLabel")}
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1"
      />
      <Button type="submit" className="shrink-0 gap-2">
        <Search size={18} aria-hidden />
        {t("submitLabel")}
      </Button>
    </form>
  );
}
