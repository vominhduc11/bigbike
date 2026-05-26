import { Headset, RefreshCcw, ShieldCheck, Truck, Zap } from "lucide-react";
import type { ElementType } from "react";

type TrustItem = {
  Icon: ElementType;
  title: string;
  sub: string;
};

const TRUST: TrustItem[] = [
  { Icon: ShieldCheck, title: "100% Chính hãng", sub: "Tem & hóa đơn đầy đủ" },
  { Icon: RefreshCcw, title: "Đổi trả 7 ngày", sub: "Miễn phí vận chuyển" },
  { Icon: Headset, title: "Tư vấn size", sub: "Hotline 24/7" },
  { Icon: Truck, title: "Giao toàn quốc", sub: "Nội thành 2h" },
  { Icon: Zap, title: "Bảo hành chính hãng", sub: "Up to 5 năm" },
];

export function MobileTrustSignals() {
  return (
    <section className="bb-home-mobile-trust mt-7 border-y border-border py-5">
      <div className="flex gap-2.5 overflow-x-auto px-3.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TRUST.map(({ Icon, title, sub }) => (
          <div
            key={title}
            className="bb-home-mobile-trust-card flex w-[138px] flex-none flex-col gap-2 border border-border bg-card p-3.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-soft text-brand">
              <Icon size={18} />
            </div>
            <div className="font-cta text-sm font-semibold uppercase leading-[1.15] text-foreground">
              {title}
            </div>
            <div className="text-xs leading-tight text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
