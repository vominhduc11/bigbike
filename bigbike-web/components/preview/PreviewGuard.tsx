"use client";

import { useEffect } from "react";

/**
 * Khoá điều hướng cho khung xem trước của admin.
 *
 * Iframe preview chỉ có dữ liệu của ĐÚNG một sản phẩm/bài viết (bơm vào qua
 * postMessage), nên bất kỳ thao tác điều hướng nào — bấm link header/giỏ hàng/
 * breadcrumb/footer, hay submit ô tìm kiếm — đều dẫn sang trang KHÔNG có dữ liệu
 * và làm hỏng phiên xem trước. Mục tiêu của tính năng là "xem trước", không phải
 * duyệt web, nên ta vô hiệu hoá điều hướng.
 *
 * Chặn ở capture phase trên `document`:
 * - Phủ cả chrome render từ root layout (header/footer), không chỉ phần nội dung.
 * - Chạy trước listener của React ở root container → vô hiệu cả Next `<Link>`
 *   (client nav) lẫn thẻ `<a>` thường.
 *
 * KHÔNG đụng tới tương tác tại chỗ (chọn biến thể, xem gallery, mở modal…) vì đó
 * là `<button>`/anchor neo `#...`, không phải điều hướng — chúng vẫn hoạt động,
 * và trang vẫn cuộn bình thường.
 */
export function PreviewGuard() {
  useEffect(() => {
    const blockNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // Cho phép anchor neo trong trang / hành vi JS tại chỗ (#, #section); chỉ chặn
      // điều hướng thật sự sang URL/đường dẫn khác.
      if (href === "" || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const blockSubmit = (event: Event) => {
      // Form duy nhất đáng kể là ô tìm kiếm ở header → điều hướng sang trang search.
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", blockNavigation, true);
    document.addEventListener("submit", blockSubmit, true);
    return () => {
      document.removeEventListener("click", blockNavigation, true);
      document.removeEventListener("submit", blockSubmit, true);
    };
  }, []);

  return null;
}
