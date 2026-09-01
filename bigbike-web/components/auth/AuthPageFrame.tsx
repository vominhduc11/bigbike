import Image from "next/image";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuthBrandPanel = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  benefits: readonly ReactNode[];
  imageAlt: string;
};

function AuthBenefitsPanel({ panel }: { panel: AuthBrandPanel }) {
  return (
    <aside
      data-auth-brand-panel
      className="relative hidden min-h-0 overflow-hidden bg-surface-dark p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-center"
    >
      <Image
        src="/brand/page-title-bg.png"
        alt={panel.imageAlt}
        fill
        priority
        sizes="(min-width: 1024px) 600px, 0px"
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-surface-dark/70" />
      <div className="relative max-w-md">
        <p className="mb-4 font-cta text-b5-label font-semibold uppercase tracking-wide text-brand-inverse">
          {panel.eyebrow}
        </p>
        <h2 className="text-a1-title font-bold leading-heading text-primary-foreground">
          {panel.title}
        </h2>
        <p className="mt-4 text-a4-content leading-body text-primary-foreground">
          {panel.description}
        </p>
        <ul className="mt-8 grid gap-4 p-0">
          {panel.benefits.map((benefit, index) => (
            <li
              key={index}
              className="flex items-start gap-3 text-a4-content leading-body text-primary-foreground"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-brand-inverse text-brand-inverse">
                <Check className="size-4" aria-hidden="true" />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export type AuthPageKind = "login" | "register" | "forgot" | "verify";

/** Shared white canvas for the four authentication routes. */
export function AuthPageFrame({
  children,
  wide = false,
  primary = false,
  brandPanel,
  authPage,
}: {
  children: ReactNode;
  wide?: boolean;
  primary?: boolean;
  brandPanel?: AuthBrandPanel;
  authPage: AuthPageKind;
}) {
  if (primary && brandPanel) {
    return (
      <section
        data-auth-page={authPage}
        className="flex min-h-full w-full flex-1 items-start px-4 py-6 sm:px-6 md:items-center lg:p-0"
      >
        <div className="mx-auto grid w-full max-w-[1200px] bg-background lg:min-h-svh lg:grid-cols-2">
          <AuthBenefitsPanel panel={brandPanel} />
          <div data-auth-form-panel className="flex min-w-0 justify-center lg:items-start lg:py-16">
            <div className={cn("w-full max-w-md", wide && "max-w-md")}>{children}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-auth-page={authPage}
      className="flex min-h-full w-full flex-1 items-start p-6 sm:px-6 md:items-center"
    >
      <div className={cn("mx-auto w-full max-w-md", wide && "max-w-md")}>{children}</div>
    </section>
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
  compact?: boolean;
}) {
  return (
    <header className={cn("mb-6", centered && "text-center")}>
      <h1 className="mb-2 font-body text-a2-page font-bold leading-title text-foreground">
        {title}
      </h1>
      {children}
    </header>
  );
}
