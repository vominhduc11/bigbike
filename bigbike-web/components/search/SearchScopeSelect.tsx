"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "all";

export function SearchScopeSelect({ current }: { current: string }) {
  const t = useTranslations("Search");
  const [value, setValue] = useState(current || ALL_VALUE);
  const formValue = value === ALL_VALUE ? "" : value;

  return (
    <>
      <input type="hidden" name="post_type" value={formValue} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="bb-query-select">
          <SelectValue placeholder={t("scopeAll")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t("scopeAll")}</SelectItem>
          <SelectItem value="product">{t("scopeProduct")}</SelectItem>
          <SelectItem value="article">{t("scopeArticle")}</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
