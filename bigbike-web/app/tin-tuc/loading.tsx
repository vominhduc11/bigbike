import { getTranslations } from "next-intl/server";

export default async function ArticleListLoading() {
  const t = await getTranslations("Common");

  return (
    <div className="bb-blog-listing-parity" aria-label={t("loading")}>
      <section
        className="bb-wp-page-title"
        style={{ backgroundImage: "url('/wp/page-title-bg.png')" }}
      >
        <div className="bb-container">
          <div className="bb-wp-page-title-row">
            <div className="bb-wp-page-title-copy bb-skel-stack">
              <div className="bb-skel bb-skel--title bb-skel-w-50" />
              <div className="bb-skel bb-skel--text bb-skel-w-40" />
            </div>
          </div>
        </div>
      </section>

      <div className="bb-wp-main-content">
        <div className="bb-container">
          <div className="bb-wp-block-text bb-wp-block-text--top bb-skel-stack">
            <div className="bb-skel bb-skel--text bb-skel-w-100" />
            <div className="bb-skel bb-skel--text bb-skel-w-80" />
          </div>

          <div className="bb-wp-row">
            <aside className="bb-wp-sidebar">
              <div className="bb-wp-widget">
                <div className="bb-wp-widget-title">
                  <div className="bb-skel bb-skel--title bb-skel-w-80" />
                </div>
                <div className="bb-wp-widget-body">
                  <div className="bb-wp-product-category">
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

            <section className="bb-wp-content-col">
              <div className="bb-wp-news-list">
                <div className="bb-wp-row">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="bb-wp-card-col">
                      <article className="bb-wp-news-item">
                        <div className="bb-news-card" aria-hidden="true">
                          <span className="bb-news-img-wrap">
                            <span className="bb-skel bb-skel--block bb-news-img" />
                          </span>
                          <span className="bb-news-body">
                            <span className="bb-news-date" />
                            <span className="bb-news-body-inside bb-skel-stack">
                              <span className="bb-skel bb-skel--title bb-skel-w-100" />
                              <span className="bb-skel bb-skel--text bb-skel-w-80" />
                              <span className="bb-skel bb-skel--text bb-skel-w-60" />
                            </span>
                          </span>
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
