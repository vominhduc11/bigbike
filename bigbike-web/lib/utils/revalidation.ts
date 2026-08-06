/**
 * `pathsForTag` trả về đường dẫn CÔNG KHAI bản tiếng Việt (`/`, `/sp/`…), nhưng mọi
 * trang đều nằm dưới segment `app/[locale]`, nên khoá bộ nhớ đệm mà revalidatePath
 * cần là đường dẫn NỘI BỘ có tiền tố ngôn ngữ. Bản VI công khai không mang tiền tố
 * nên hai dạng này lệch nhau — trước 2026-08-06 hàm chỉ gọi revalidatePath("/"),
 * không khớp khoá `/vi`, nên bắn trượt hoàn toàn: sửa dữ liệu trong admin xong web
 * vẫn phục vụ bản cũ cho tới lần build kế tiếp.
 *
 * QUAN TRỌNG: đường dẫn nội bộ dùng ĐOẠN TIẾNG VIỆT cho cả bản EN — proxy đổi
 * `/en/about/` → `/en/gioi-thieu/`, `/en/products/` → `/en/sp/`. Vì vậy KHÔNG dịch
 * đoạn đường dẫn ở đây; chỉ gắn tiền tố ngôn ngữ. (Xác minh bằng header
 * `x-middleware-rewrite` trên hệ thống thật ngày 2026-08-06.)
 *
 * Trả về cả hai ngôn ngữ vì một thay đổi dữ liệu ảnh hưởng cả trang VI lẫn trang EN.
 * Đường dẫn không tồn tại thì revalidatePath bỏ qua, không gây lỗi.
 */
export function toInternalPaths(viPublicPath: string): string[] {
  const suffix = viPublicPath.replace(/\/+$/, "");
  return [`/vi${suffix}`, `/en${suffix}`];
}
