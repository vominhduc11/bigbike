import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { skelBase, skelStack } from "@/lib/ui-classes";

export default async function ArticleListLoading() {
  const t = await getTranslations("Common");

  return (
    <div className="bb-blog-listing-parity" aria-label={t("loading")}>
      {/* Hero skeleton — match PageHero contact variant: height + clip-path. */}
      <div className="relative h-[300px] md:h-[450px] 3xl:h-[520px] 4xl:h-[600px]">
        <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden bg-black md:h-[450px] 3xl:h-[520px] 4xl:h-[600px] [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)]" />
        <div className="absolute inset-x-0 top-0 flex h-[300px] items-center md:h-[450px] 3xl:h-[520px] 4xl:h-[600px]">
          <Container variant="blog">
            <div className="h-10 md:h-14 w-2/3 max-w-[28rem] bg-white/15" />
            <div className="mt-5 h-4 w-40 bg-white/15" />
          </Container>
        </div>
      </div>

      <div id="main-content" className="pb-0">
        <Container variant="blog" className="container">
          <div className={cn("text-foreground font-body text-[length:var(--fs-body)] font-normal leading-[1.6] pb-[60px]", skelStack)}>
            <div className={cn(skelBase, "!animate-none h-[0.85em] w-full")} />
            <div className={cn(skelBase, "!animate-none h-[0.85em] w-4/5")} />
          </div>

          <div className="flex flex-wrap -mx-[15px]">
            <aside className="relative w-full px-[15px] flex-[0_0_25%] max-w-[25%] max-md:hidden max-md:flex-[0_0_100%] max-md:max-w-full max-md:mb-0">
              <div className="pb-[15px] mb-[30px] border-b border-b-[#cecece]">
                <div className="pb-[15px]">
                  <div className={cn(skelBase, "!animate-none h-[1.1em] w-4/5")} />
                </div>
                <div>
                  <div>
                    <ul className="m-0 p-0 list-none">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <li key={index} className="relative m-0 py-[15px]">
                          <span className={cn(skelBase, "!animate-none h-[0.85em] w-4/5")} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </aside>

            <section className="relative w-full px-[15px] flex-[0_0_75%] max-w-[75%] max-md:flex-[0_0_100%] max-md:max-w-full">
              <div className="news-list">
                <div className="flex flex-wrap -mx-[15px]">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="relative w-full px-[15px] flex-[0_0_33.333333%] max-w-[33.333333%] mb-[30px] flex flex-col max-[768px]:flex-[0_0_50%] max-[768px]:max-w-[50%] max-[576px]:flex-[0_0_100%] max-[576px]:max-w-full"
                    >
                      <article
                        className="flex flex-col flex-1 mb-0 bg-card [box-shadow:var(--bb-shadow-md)] max-md:border max-md:border-solid max-md:border-border max-md:[box-shadow:none]"
                        aria-hidden="true"
                      >
                        <div className="news--item-thumbnail">
                          <span className={cn(skelBase, "!animate-none lazy bb-news-img-placeholder")} />
                        </div>
                        <div className="relative max-md:bg-card">
                          <div className="pt-5 px-5 pb-2.5">
                            <p className={cn(skelBase, "!animate-none h-[0.85em] w-2/5")} />
                          </div>
                          <div className={cn("px-5 pb-[30px] max-md:bg-card", skelStack)}>
                            <p className="m-0 mb-[25px] font-heading text-xl font-semibold leading-6 text-foreground">
                              <span className={cn(skelBase, "!animate-none h-[1.1em] w-full")} />
                            </p>
                            <p className={cn(skelBase, "!animate-none h-[0.85em] w-4/5")} />
                            <p className={cn(skelBase, "!animate-none h-[0.85em] w-3/5")} />
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </Container>
      </div>
    </div>
  );
}
