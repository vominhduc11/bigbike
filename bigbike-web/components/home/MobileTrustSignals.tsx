import { ShieldCheck, RefreshCcw, Headset, Truck, Zap } from "lucide-react";
import type { ElementType } from "react";

type TrustItem = {
  Icon: ElementType;
  title: string;
  sub: string;
};

const TRUST: TrustItem[] = [
  { Icon: ShieldCheck, title: "100% Chính hãng",    sub: "Tem & hóa đơn đầy đủ" },
  { Icon: RefreshCcw,  title: "Đổi trả 7 ngày",     sub: "Miễn phí vận chuyển" },
  { Icon: Headset,     title: "Tư vấn size",         sub: "Hotline 24/7" },
  { Icon: Truck,       title: "Giao toàn quốc",      sub: "Nội thành 2h" },
  { Icon: Zap,         title: "Bảo hành chính hãng", sub: "Up to 5 năm" },
];

export function MobileTrustSignals() {
  return (
    <section className="mt-7 pt-5 pb-5 border-t border-b border-border">
      <div className="flex gap-2.5 overflow-x-auto px-3.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TRUST.map(({ Icon, title, sub }) => (
          <div
            key={title}
            className="flex-none w-[138px] border border-border bg-card p-3.5 flex flex-col gap-2"
          >
            <div className="w-9 h-9 bg-brand-soft flex items-center justify-center text-brand shrink-0">
              <Icon size={18} />
            </div>
            <div className="font-cta text-sm font-semibold uppercase leading-[1.15] text-foreground">
              {title}
            </div>
            <div className="text-xs text-muted-foreground leading-tight">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
