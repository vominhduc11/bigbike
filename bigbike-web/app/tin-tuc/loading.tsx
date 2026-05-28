import { getTranslations } from "next-intl/server";

export default async function ArticleListLoading() {
  const t = await getTranslations("Common");

  return (
    <div className="bb-blog-listing-parity" aria-label={t("loading")}>
      {/* Hero skeleton — match PageHero contact variant: height + clip-path. */}
      <div className="relative h-[300px] md:h-[450px] 3xl:h-[520px] 4xl:h-[600px]">
        <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden bg-black md:h-[450px] 3xl:h-[520px] 4xl:h-[600px] [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)]" />
        <div className="absolute inset-x-0 top-0 flex h-[300px] items-center md:h-[450px] 3xl:h-[520px] 4xl:h-[600px]">
          <div className="bb-container">
            <div className="h-10 md:h-14 w-2/3 max-w-[28rem] bg-white/15" />
            <div className="mt-5 h-4 w-40 bg-white/15" />
          </div>
        </div>
      </div>

      <div id="main-content" className="bb-wp-main-content">
        <div className="bb-container container">
          <div className="bb-wp-block-text bb-wp-block-text--top block-text pb-60 bb-skel-stack">
            <div className="bb-skel bb-skel--text bb-skel-w-100" />
            <div className="bb-skel bb-skel--text bb-skel-w-80" />
          </div>

          <div className="bb-wp-row row">
            <aside className="bb-wp-sidebar col-md-3">
              <div className="bb-wp-widget widget">
                <div className="bb-wp-widget-title widget--title">
                  <div className="bb-skel bb-skel--title bb-skel-w-80" />
                </div>
                <div className="bb-wp-widget-body widget--body">
                  <div className="bb-wp-product-category product-category">
                    <ul>
                      {Array.from({ length: 3 }).map((_, index) => (
                        <li key={index}>
                          <span className="bb-skel bb-skel--text bb-skel-w-80" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </aside>

            <section className="bb-wp-content-col col-md-9">
              <div className="bb-wp-news-list news-list">
                <div className="bb-wp-row row">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="bb-wp-card-col col-md-4 col-sm-6 col-12">
                      <article className="bb-wp-news-item news--item" aria-hidden="true">
                        <div className="news--item-thumbnail">
                          <span className="bb-skel bb-skel--block lazy bb-news-img-placeholder" />
                        </div>
                        <div className="news--item-desc">
                          <div className="news-date">
                            <p className="bb-skel bb-skel--text bb-skel-w-40" />
                          </div>
                          <div className="news--item-inside bb-skel-stack">
                            <p className="title-post">
                              <span className="bb-skel bb-skel--title bb-skel-w-100" />
                            </p>
                            <p className="bb-skel bb-skel--text bb-skel-w-80" />
                            <p className="bb-skel bb-skel--text bb-skel-w-60" />
                          </div>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
