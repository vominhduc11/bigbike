package com.bigbike.bigbike_backend.domain.catalog;

import java.util.List;

/**
 * Cấu hình một tab trên trang chi tiết sản phẩm (PDP), quản lý theo TỪNG sản phẩm (V231).
 *
 * <p>Admin có thể ẩn/hiện, đổi thứ tự, đổi tên nhãn, và thêm tab tự do (nội dung dựng bằng khối).
 *
 * <p>Quy ước nội dung (giống {@link ProductSpecification}): {@code label}/{@code blocks} mang nội
 * dung ĐÃ resolve theo ngôn ngữ yêu cầu trên public read (vi, hoặc en-có-fallback-vi). Các field
 * {@code labelEn}/{@code blocksEn} mang nguyên bản tiếng Anh, chỉ có trên admin read (để trình soạn
 * hiển thị song ngữ); {@code null} trên public read. Trong JSON lưu trữ thì {@code label}/{@code blocks}
 * là bản tiếng Việt (canonical).
 */
public record ProductTab(
        /** Khoá ổn định của tab (vd "description", "reviews", hoặc id sinh cho tab tự do). */
        String id,
        /** Loại tab: description | reviews | specs | installation | faq | custom. */
        String type,
        /** Có hiển thị tab này không. */
        boolean enabled,
        /** Thứ tự hiển thị (tăng dần). */
        Integer sortOrder,
        /** Nhãn hiển thị — đã resolve theo locale (public) hoặc bản vi (lưu trữ/admin). Trống = dùng nhãn mặc định. */
        String label,
        /** Nhãn tiếng Anh nguyên bản — chỉ trên admin read; null trên public. */
        String labelEn,
        /** Nội dung khối cho tab tự do — đã resolve theo locale (public) hoặc bản vi (lưu trữ/admin). */
        List<DescriptionBlock> blocks,
        /** Nội dung khối tiếng Anh nguyên bản (tab tự do) — chỉ trên admin read; null trên public. */
        List<DescriptionBlock> blocksEn
) {
}
