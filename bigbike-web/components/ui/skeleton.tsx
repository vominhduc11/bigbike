import { cn } from "@/lib/utils";
import { skelBase } from "@/lib/ui-classes";

/**
 * Ô giữ chỗ khi đang tải. Dùng CHUNG một hiệu ứng "vệt sáng chạy ngang"
 * (`skelBase`) với bộ khung chờ ở components/ui/Skeletons.tsx — trước đây file
 * này dùng `animate-pulse`, nên trang Giỏ hàng / Tin tức / Thương hiệu hiện hai
 * kiểu hiệu ứng nối tiếp nhau trong cùng một lần tải.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(skelBase, "rounded-none", className)} {...props} />;
}

export { Skeleton };
