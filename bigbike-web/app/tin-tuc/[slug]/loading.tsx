import { getTranslations } from "next-intl/server";

/**
 * Skeleton bài viết — khớp shell WP single.php (.page-title + .blog +
 * sidebar widget) để không nháy layout. Header/footer do trang tự render.
 */
export default async function ArticleDetailLoading() {
  const t = await getTranslations("Common");

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4"
        precedence="default"
      />
      <div className="single single-post" aria-label={t("loading")}>
        <div
          className="page-title"
          style={{ backgroundImage: "url('/wp-content/themes/bigbike/images/page-title-bg.png')" }}
        >
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-6">
                <div className="h-[3.5rem] w-3/4 max-w-[32rem] bg-white/15" />
              </div>
            </div>
          </div>
        </div>

        <div id="main-content">
          <div className="container">
            <div className="row">
              <div className="col-md-8">
                <div className="blog">
                  <div className="blog-thumbnail">
                    <div className="aspect-[16/9] w-full bg-black/10" />
                  </div>
                  <div className="blog-meta">
                    <div className="h-4 w-48 bg-black/10" />
                  </div>
                  <div className="mt-6 space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="h-3 bg-black/10" style={{ width: `${95 - (i % 4) * 8}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                {Array.from({ length: 2 }).map((_, w) => (
                  <div className="widget" key={w}>
                    <div className="widget--title">
                      <div className="h-7 w-40 bg-black/10" />
                    </div>
                    <div className="widget--body">
                      <div className="news-list">
                        <div className="row">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div className="col-md-12" key={i}>
                              <div className="news--item">
                                <div className="news--item-thumbnail">
                                  <div className="aspect-[16/9] w-full bg-black/10" />
                                </div>
                                <div className="news--item-desc">
                                  <div className="news-date">
                                    <div className="h-3 w-24 bg-black/10" />
                                  </div>
                                  <div className="news--item-inside">
                                    <div className="h-4 w-11/12 bg-black/10" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
