import type { ReactNode } from "react";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { cn } from "@/lib/utils";

export function AuthPageFrame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <StaticPageShell title="" breadcrumb={[]} showHero={false} mainClassName="">
      <section className="px-4 py-15 sm:px-6">
        <div className={cn("mx-auto w-full", wide ? "max-w-screen-sm" : "max-w-[370px]")}>
          {children}
        </div>
      </section>
    </StaticPageShell>
  );
}

export function AuthTitleBlock({
  title,
  children,
  centered = false,
}: {
  title: ReactNode;
  children?: ReactNode;
  centered?: boolean;
}) {
  return (
    <header className={cn("mb-8", centered && "text-center")}>
      <h1 className="mb-2 font-cta text-3xl font-bold uppercase leading-tight text-foreground">
        {title}
      </h1>
      {children}
    </header>
  );
}
