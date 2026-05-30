import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Props = {
  kicker: string;
  title: string;
  href?: string;
  linkText?: string;
};

export function MobileSectionHeader({ kicker, title, href, linkText = "Xem tất cả" }: Props) {
  return (
    <div className="bb-mobile-section-header flex items-end justify-between gap-2.5 px-6 mb-3.5">
      <div>
        <div className="bb-mobile-section-kicker flex items-center gap-2 mb-1">
          <span className="inline-block h-px w-4 bg-brand" />
          <span className="font-cta text-[10px] font-semibold uppercase tracking-display text-brand">
            {kicker}
          </span>
        </div>
        <h2 className="m-0 font-display text-2xl font-semibold uppercase leading-none tracking-normal text-foreground">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 pb-0.5 text-xs font-medium text-muted-foreground"
        >
          {linkText}
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}
