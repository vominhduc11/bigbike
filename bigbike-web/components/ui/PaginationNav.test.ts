import { describe, expect, it } from "vitest";

import { buildCompactPageList, buildPageList } from "@/components/ui/PaginationNav";

describe("PaginationNav page lists", () => {
  it("giữ dãy đầy đủ hiện tại cho màn hình rộng", () => {
    expect(buildPageList(8, 15)).toEqual([1, "...", 6, 7, 8, 9, 10, "...", 15]);
  });

  it("thu gọn trang đầu trên màn hình hẹp", () => {
    expect(buildCompactPageList(1, 15)).toEqual([1, 2, "...", 15]);
  });

  it("thu gọn trang giữa trên màn hình hẹp", () => {
    expect(buildCompactPageList(8, 15)).toEqual([1, "...", 8, "...", 15]);
  });

  it("giữ trang áp chót khi đang ở cuối", () => {
    expect(buildCompactPageList(15, 15)).toEqual([1, "...", 14, 15]);
  });

  it("không thêm dấu chấm lửng khi chỉ có tối đa bốn trang", () => {
    expect(buildCompactPageList(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
