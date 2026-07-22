import {
  Award,
  BadgeCheck,
  Clock,
  CreditCard,
  Gift,
  Headphones,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ProductCommitment } from "@/lib/contracts/public";

// Bộ icon dựng sẵn cho khối cam kết (V232) — admin chọn theo key, web map ra lucide.
// Web KHÔNG nạp Font Awesome (fa-* vô hình) nên phải dùng lucide. Key lạ → ShieldCheck.
// Exported để ProductTrustCard (khối "Mua tại BigBike.vn") dùng CHUNG map — cùng icon cho
// cùng key ở cả 2 nơi hiển thị commitments trên trang.
export const COMMITMENT_ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  "refresh-cw": RefreshCw,
  "shield-check": ShieldCheck,
  "badge-check": BadgeCheck,
  "credit-card": CreditCard,
  headphones: Headphones,
  package: Package,
  gift: Gift,
  clock: Clock,
  "map-pin": MapPin,
  wrench: Wrench,
  award: Award,
};

// Khối "cam kết" dưới nút mua (V232) — admin quản theo TỪNG sản phẩm: thêm/bớt
// dòng tùy ý, mỗi dòng tự chọn icon (key → lucide qua COMMITMENT_ICON_MAP).
// Dòng không có tiêu đề thì bỏ qua; không dòng nào → ẩn cả khối.
export function CommitmentsList({ commitments }: { commitments: ProductCommitment[] }) {
  if (!commitments.some((c) => c.title)) return null;
  return (
    <ul className="mt-4 divide-y divide-border border border-border">
      {commitments.map((c, i) =>
        c.title ? (
          <li key={i} className="flex items-center gap-3.5 px-5 py-3.5 max-md:gap-3 max-md:px-4 max-md:py-2.5">
            {(() => {
              const Icon = COMMITMENT_ICON_MAP[c.icon] ?? ShieldCheck;
              return <Icon className="size-6 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />;
            })()}
            <div className="min-w-0">
              <strong className="block font-body text-a4-content font-semibold leading-snug text-foreground">{c.title}</strong>
              {c.subtitle ? <span className="mt-1 block text-a5-meta leading-snug text-muted-foreground">{c.subtitle}</span> : null}
            </div>
          </li>
        ) : null,
      )}
    </ul>
  );
}
