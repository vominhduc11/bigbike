package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.AuthorSummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategorySummary;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.domain.content.PageType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

@Repository
@Profile("mock")
public class InMemoryContentReadRepository implements ContentReadRepository {

    private final List<Article> articles;
    private final List<Page> pages;

    public InMemoryContentReadRepository() {
        ContentCategorySummary ridingGuide = new ContentCategorySummary("content_cat_guide", "huong-dan", "Hướng dẫn");
        ContentCategorySummary news = new ContentCategorySummary("content_cat_news", "tin-tuc", "Tin tức");
        AuthorSummary editor = new AuthorSummary("author_bigbike_editor", "BigBike Team");

        Article article1 = new Article(
                "article_chon_mu_fullface",
                "chon-mu-fullface-phu-hop",
                "Cách Chọn Mũ Fullface Phù Hợp",
                "Hướng dẫn chọn mũ fullface theo nhu cầu sử dụng.",
                "<p>Chọn mũ theo nhu cầu đi phố, touring, track day và form đầu.</p>",
                new ImageAsset(
                        "img_article_fullface",
                        "https://cdn.bigbike.local/articles/chon-mu-fullface.jpg",
                        "Cách chọn mũ fullface",
                        1600,
                        900,
                        "image/jpeg"
                ),
                null,
                editor,
                ridingGuide,
                List.of(ridingGuide),
                List.of("mu-bao-hiem", "huong-dan"),
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Cách Chọn Mũ Fullface Phù Hợp",
                        "Hướng dẫn chọn mũ fullface cho biker.",
                        "https://bigbike.vn/tin-tuc/chon-mu-fullface-phu-hop.html",
                        null,
                        false
                ),
                Instant.parse("2026-04-10T03:00:00Z"),
                Instant.parse("2026-04-09T02:00:00Z"),
                Instant.parse("2026-04-10T03:00:00Z")
        );

        Article article2 = new Article(
                "article_xu_huong_gear_2026",
                "xu-huong-do-bao-ho-2026",
                "Xu Hướng Đồ Bảo Hộ 2026",
                "Những xu hướng bảo hộ nổi bật cho biker năm 2026.",
                "<p>Tổng hợp xu hướng về vật liệu, công nghệ và tiêu chuẩn an toàn.</p>",
                new ImageAsset(
                        "img_article_gear_2026",
                        "https://cdn.bigbike.local/articles/xu-huong-gear-2026.jpg",
                        "Xu hướng đồ bảo hộ 2026",
                        1600,
                        900,
                        "image/jpeg"
                ),
                null,
                editor,
                news,
                List.of(news),
                List.of("tin-tuc", "bao-ho"),
                PublishStatus.DRAFT,
                new SeoMeta(
                        "Xu Hướng Đồ Bảo Hộ 2026",
                        "Tin tức và phân tích xu hướng đồ bảo hộ biker 2026.",
                        "https://bigbike.vn/tin-tuc/xu-huong-do-bao-ho-2026.html",
                        null,
                        false
                ),
                Instant.parse("2026-04-15T03:00:00Z"),
                Instant.parse("2026-04-14T03:00:00Z"),
                Instant.parse("2026-04-15T03:00:00Z")
        );

        this.articles = List.of(article1, article2);

        Page pageAbout = new Page(
                "page_gioi_thieu",
                "gioi-thieu",
                "Giới Thiệu BigBike",
                "<p>BigBike là cửa hàng đồ bảo hộ và phụ kiện biker.</p>",
                PageType.ABOUT,
                null,
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Giới Thiệu BigBike",
                        "Thông tin về BigBike.",
                        "https://bigbike.vn/gioi-thieu/",
                        null,
                        false
                ),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-18T05:00:00Z")
        );

        Page pageWarranty = new Page(
                "page_chinh_sach_bao_hanh",
                "chinh-sach-bao-hanh",
                "Chính Sách Bảo Hành",
                "<p>Chính sách bảo hành áp dụng theo từng nhóm sản phẩm.</p>",
                PageType.POLICY,
                null,
                PublishStatus.PUBLISHED,
                new SeoMeta(
                        "Chính Sách Bảo Hành",
                        "Chính sách bảo hành tại BigBike.",
                        "https://bigbike.vn/chinh-sach-bao-hanh/",
                        null,
                        false
                ),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-01T01:00:00Z"),
                Instant.parse("2026-04-18T05:00:00Z")
        );

        this.pages = List.of(pageAbout, pageWarranty);
    }

    @Override
    public List<Article> findAllArticles() {
        return articles;
    }

    @Override
    public List<Page> findAllPages() {
        return pages;
    }

    @Override
    public Optional<Article> findArticleBySlug(String slug) {
        return articles.stream().filter(article -> article.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Article> findArticleById(String id) {
        return articles.stream().filter(article -> article.id().equals(id)).findFirst();
    }

    @Override
    public Optional<Page> findPageBySlug(String slug) {
        return pages.stream().filter(page -> page.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Page> findPageById(String id) {
        return pages.stream().filter(page -> page.id().equals(id)).findFirst();
    }
}
