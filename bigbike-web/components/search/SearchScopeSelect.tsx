"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "all";

export function SearchScopeSelect({ current }: { current: string }) {
  const [value, setValue] = useState(current || ALL_VALUE);
  const formValue = value === ALL_VALUE ? "" : value;

  return (
    <>
      <input type="hidden" name="post_type" value={formValue} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="bb-query-select">
          <SelectValue placeholder="Tất cả nội dung" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Tất cả nội dung</SelectItem>
          <SelectItem value="product">Sản phẩm</SelectItem>
          <SelectItem value="article">Bài viết</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
