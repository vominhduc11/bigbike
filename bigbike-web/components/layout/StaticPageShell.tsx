import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { cn } from "@/lib/utils";

export function StaticPageShell({
  title,
  titleNode,
  breadcrumb,
  heroBgUrl,
  heroIllustrationUrl,
  heroIllustrationAlt,
  showHero = true,
  mainClassName = "pb-10",
  children,
}: {
  title: string;
  titleNode?: React.ReactNode;
  breadcrumb: PageHeroCrumb[];
  heroBgUrl?: string | null;
  heroIllustrationUrl?: string | null;
  heroIllustrationAlt?: string | null;
  showHero?: boolean;
  mainClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {showHero ? (
        <PageHero
          title={title}
          titleNode={titleNode}
          breadcrumb={breadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroIllustrationAlt}
        />
      ) : null}

      {/* Hero-less variant emits `bb-heroless` so the shared logo-emblem clearance
          (globals.css `body:has(.bb-heroless) .bb-main`) fires automatically — no
          per-page class allowlist. Pages with a PageHero banner skip it. */}
      <div className={cn(mainClassName, !showHero && "bb-heroless")} id="main-content">
        {children}
      </div>
    </>
  );
}
