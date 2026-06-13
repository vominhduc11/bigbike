import { getTranslations } from "next-intl/server";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";

/**
 * Skeleton listing tin tức — khớp shell WP (.page-title + .container .row)
 * để không nháy layout khi điều hướng. Header/footer do trang tự render.
 */
export default async function ArticleListLoading() {
  const t = await getTranslations("Common");

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4" />
      <div className="archive category" aria-label={t("loading")}>
        <div
          className="page-title"
          style={{ backgroundImage: "url('/wp-content/themes/bigbike/images/page-title-bg.png')" }}
        >
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-6">
                <div className="h-[3.5rem] w-2/3 max-w-[28rem] bg-white/15" />
              </div>
            </div>
          </div>
        </div>

        <div id="main-content">
          <div className="container">
            <div className="row">
              <div className="col-md-3">
                <div className="widget">
                  <div className="widget--title">
                    <div className="h-6 w-40 bg-black/10" />
                  </div>
                  <div className="widget--body">
                    <div className="product-category">
                      <ul>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <li key={i}>
                            <div className="h-4 w-3/4 bg-black/10" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-9">
                <div className="news-list">
                  <div className="row">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div className="col-md-4 col-sm-6 col-12" key={i}>
                        <div className="news--item">
                          <div className="news--item-thumbnail">
                            <div className="aspect-[16/9] w-full bg-black/10" />
                          </div>
                          <div className="news--item-desc">
                            <div className="news-date">
                              <div className="h-3 w-20 bg-black/10" />
                            </div>
                            <div className="news--item-inside">
                              <div className="mb-2.5 h-4 w-11/12 bg-black/10" />
                              <div className="h-3 w-full bg-black/10" />
                              <div className="mt-1.5 h-3 w-4/5 bg-black/10" />
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
        </div>
      </div>
    </>
  );
}
