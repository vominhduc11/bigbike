import { getTranslations } from "next-intl/server";

export default async function ArticleListLoading() {
  const t = await getTranslations("Common");

  return (
    <div className="bb-blog-listing-parity" aria-label={t("loading")}>
      <section
        className="bb-wp-page-title page-title"
        style={{ backgroundImage: "url('/wp/page-title-bg.png')" }}
      >
        <div className="bb-container container">
          <div className="bb-wp-page-title-row row align-items-center">
            <div className="bb-wp-page-title-copy col-md-6 bb-skel-stack">
              <div className="bb-skel bb-skel--title bb-skel-w-50" />
              <div className="bb-skel bb-skel--text bb-skel-w-40" />
            </div>
          </div>
        </div>
      </section>

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
