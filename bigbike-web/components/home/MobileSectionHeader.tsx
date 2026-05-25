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
    <div className="flex items-end justify-between px-3.5 mb-3.5 gap-2.5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-4 h-px bg-brand" />
          <span className="font-cta text-[10px] tracking-[0.20em] font-semibold uppercase text-brand">
            {kicker}
          </span>
        </div>
        <h2 className="font-display font-semibold text-2xl uppercase tracking-tight text-foreground m-0 leading-none">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="text-muted-foreground text-xs font-medium flex items-center gap-1 shrink-0 pb-0.5"
        >
          {linkText}
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}
