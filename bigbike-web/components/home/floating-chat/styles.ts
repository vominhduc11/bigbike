/**
 * Bó class dùng chung cho khung chat Trợ lý BigBike.
 * Theo tiền lệ `components/layout/search/styles.ts` — không tạo class CSS mới,
 * chỉ gom utility Tailwind để mọi nút trong vùng hội thoại có CÙNG một hệ
 * chiều rộng (owner decision 2026-09-06).
 */

/**
 * Lưới nút trong vùng hội thoại: hai cột bằng nhau, cùng chiều cao; nút lẻ
 * cuối cùng chiếm trọn bề ngang. Đây là hệ chiều rộng DUY NHẤT được phép.
 */
export const chatActionGrid =
  "grid grid-cols-2 gap-2 auto-rows-fr [&>*:last-child:nth-child(odd)]:col-span-2";

/** Nút bên trong `chatActionGrid` — luôn lấp đầy ô lưới. */
export const chatActionButton = "h-full min-h-11 w-full whitespace-normal px-3 text-center";

/** Lưới gợi ý ở màn mở đầu: một cột, mọi nút cùng rộng và cùng cao. */
export const chatSuggestionGrid = "grid auto-rows-fr gap-2";

/** Nút gợi ý ở màn mở đầu. */
export const chatSuggestionButton =
  "h-full min-h-12 w-full justify-start whitespace-normal px-4 py-3 text-left";

/** Ba nút biểu tượng ở đầu khung — cùng kích thước, cùng kiểu. */
export const chatHeaderIconButton =
  "size-11 min-h-11 shrink-0 border border-primary-foreground/60 p-0 text-primary-foreground hover:scale-100 hover:bg-primary-foreground/10";
