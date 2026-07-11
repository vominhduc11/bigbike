import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";

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

      <div className={mainClassName} id="main-content">
        {children}
      </div>
    </>
  );
}
