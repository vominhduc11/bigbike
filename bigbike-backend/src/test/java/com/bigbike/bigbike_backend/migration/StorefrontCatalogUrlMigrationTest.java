package com.bigbike.bigbike_backend.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class StorefrontCatalogUrlMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @BeforeEach
    void createSchemaAndFixtures() throws Exception {
        try (Connection connection = postgres.createConnection("");
             Statement statement = connection.createStatement()) {
            statement.execute("""
                    DROP SCHEMA public CASCADE;
                    CREATE SCHEMA public;

                    CREATE TABLE categories (
                        id text PRIMARY KEY,
                        description text,
                        description_en text,
                        intro_content text,
                        intro_content_en text,
                        seo_canonical_url text
                    );
                    CREATE TABLE articles (
                        id text PRIMARY KEY,
                        body text,
                        body_en text,
                        body_blocks jsonb,
                        seo_canonical_url text
                    );
                    CREATE TABLE products (
                        id text PRIMARY KEY,
                        description text,
                        description_en text,
                        description_blocks jsonb,
                        suitability_advisory text,
                        suitability_advisory_en text,
                        suitability_section jsonb,
                        size_guide text,
                        size_guide_en text,
                        size_guide_section jsonb,
                        faqs jsonb,
                        commitments jsonb,
                        highlights jsonb,
                        specifications_html text,
                        specifications_html_en text,
                        spec_stats_html text,
                        spec_stats_html_en text,
                        trust_badges_html text,
                        trust_badges_html_en text,
                        seo_canonical_url text
                    );
                    CREATE TABLE site_settings (
                        setting_key text PRIMARY KEY,
                        setting_value text,
                        setting_value_en text
                    );
                    CREATE TABLE menu_items (
                        id text PRIMARY KEY,
                        url text
                    );
                    CREATE TABLE redirects (
                        id text PRIMARY KEY,
                        source_pattern text,
                        target_url text,
                        updated_at timestamptz
                    );

                    INSERT INTO categories (id, seo_canonical_url)
                    VALUES ('category', 'https://bigbike.vn/danh-muc-san-pham/non-bao-hiem-moto/');
                    INSERT INTO articles (id, body, body_blocks)
                    VALUES (
                        'article',
                        '<a href="https://bigbike.vn/vi/danh-muc-san-pham/mu-bao-hiem.html?manufacturer=48">Mũ</a>',
                        '[{"html":"<a href=\\"/danh-muc-san-pham/gang-tay/\\">Găng tay</a>"}]'::jsonb
                    );
                    INSERT INTO products (id, description, description_blocks, seo_canonical_url)
                    VALUES (
                        'product',
                        '<a href="/danh-muc-san-pham/giay-bao-ho/">Giày</a>',
                        '[{"html":"<a href=\\"/danh-muc-san-pham.html\\">Xem tất cả</a>"}]'::jsonb,
                        'http://localhost:3000/san-pham/giay-bao-ho-forma-adv-tourer-dry'
                    );
                    INSERT INTO menu_items (id, url) VALUES
                        ('category-menu', '/danh-muc-san-pham/non-bao-hiem-moto'),
                        ('product-list-menu', '/san-pham/');
                    INSERT INTO redirects (id, source_pattern, target_url, updated_at) VALUES
                        ('legacy-product', '/danh-muc-san-pham/old-product.html', '/product/new-product/', now()),
                        ('category-slug', '/danh-muc-san-pham/old-category', '/danh-muc-san-pham/new-category/', now()),
                        ('legacy-list', '/shop.html', '/danh-muc-san-pham.html', now());
                    """);
        }
    }

    @Test
    void v359NormalizesActiveUrlsAndPreservesLegacyProductSources() throws Exception {
        try (Connection connection = postgres.createConnection("")) {
            ScriptUtils.executeSqlScript(
                    connection,
                    new ClassPathResource("db/migration/V359__canonicalize_storefront_catalog_urls.sql")
            );

            assertThat(value(connection,
                    "SELECT seo_canonical_url FROM categories WHERE id = 'category'"))
                    .isEqualTo("https://bigbike.vn/danh-muc/non-bao-hiem-moto/");
            assertThat(value(connection, "SELECT body FROM articles WHERE id = 'article'"))
                    .contains("/danh-muc/non-bao-hiem-moto/?manufacturer=48")
                    .doesNotContain("danh-muc-san-pham");
            assertThat(value(connection,
                    "SELECT body_blocks::text FROM articles WHERE id = 'article'"))
                    .contains("/danh-muc/gang-tay/")
                    .doesNotContain("danh-muc-san-pham");
            assertThat(value(connection,
                    "SELECT description_blocks::text FROM products WHERE id = 'product'"))
                    .contains("/sp/")
                    .doesNotContain("danh-muc-san-pham");
            assertThat(value(connection,
                    "SELECT seo_canonical_url FROM products WHERE id = 'product'"))
                    .isEqualTo("/product/giay-bao-ho-forma-adv-tourer-dry/");
            assertThat(value(connection,
                    "SELECT url FROM menu_items WHERE id = 'category-menu'"))
                    .isEqualTo("/danh-muc/non-bao-hiem-moto/");
            assertThat(value(connection,
                    "SELECT url FROM menu_items WHERE id = 'product-list-menu'"))
                    .isEqualTo("/sp/");
            assertThat(value(connection,
                    "SELECT source_pattern FROM redirects WHERE id = 'legacy-product'"))
                    .isEqualTo("/danh-muc-san-pham/old-product.html");
            assertThat(value(connection,
                    "SELECT source_pattern FROM redirects WHERE id = 'category-slug'"))
                    .isEqualTo("/danh-muc/old-category");
            assertThat(value(connection,
                    "SELECT target_url FROM redirects WHERE id = 'category-slug'"))
                    .isEqualTo("/danh-muc/new-category/");
            assertThat(value(connection,
                    "SELECT target_url FROM redirects WHERE id = 'legacy-list'"))
                    .isEqualTo("/sp/");
        }
    }

    private String value(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }
}
