package com.bigbike.bigbike_backend.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductSpecification;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

@Repository
@Profile("mock")
public class InMemoryCatalogReadRepository implements CatalogReadRepository {

    private final List<Category> categories;
    private final List<Brand> brands;
    private final List<Product> products;

    public InMemoryCatalogReadRepository() {
        Category helmets = new Category(
                "cat_helmet",
                "mu-bao-hiem",
                "Mũ bảo hiểm",
                "Mũ bảo hiểm cho đường phố và touring.",
                null,
                new ImageAsset(
                        "img_cat_helmet",
                        "https://cdn.bigbike.local/categories/mu-bao-hiem.jpg",
                        "Mũ bảo hiểm",
                        1200,
                        800,
                        "image/jpeg"
                ),
                null,
                new SeoMeta(
                        "Mũ bảo hiểm BigBike",
                        "Danh mục mũ bảo hiểm cho biker.",
                        "https://bigbike.vn/danh-muc-san-pham/mu-bao-hiem/",
                        null,
                        false
                ),
                true,
                true,
                1,
                Instant.parse("2026-04-01T03:00:00Z"),
                Instant.parse("2026-04-18T04:00:00Z")
        );

        Category jackets = new Category(
                "cat_jacket",
                "ao-giap-bao-ho",
                "Áo giáp bảo hộ",
                "Áo giáp đi phượt và đi phố.",
                null,
                new ImageAsset(
                        "img_cat_jacket",
                        "https://cdn.bigbike.local/categories/ao-giap-bao-ho.jpg",
                        "Áo giáp bảo hộ",
                        1200,
                        800,
                        "image/jpeg"
                ),
                null,
                new SeoMeta(
                        "Áo giáp bảo hộ BigBike",
                        "Danh mục áo giáp bảo hộ cho rider.",
                        "https://bigbike.vn/danh-muc-san-pham/ao-giap-bao-ho/",
                        null,
                        false
                ),
                true,
                true,
                2,
                Instant.parse("2026-04-01T03:00:00Z"),
                Instant.parse("2026-04-18T04:00:00Z")
        );

        this.categories = List.of(helmets, jackets);

        Brand ls2 = new Brand(
                "brand_ls2",
                "ls2",
                "LS2",
                "Thương hiệu mũ bảo hiểm và đồ bảo hộ.",
                new ImageAsset(
                        "img_brand_ls2",
                        "https://cdn.bigbike.local/brands/ls2.png",
                        "LS2",
                        500,
                        260,
                        "image/png"
                ),
                null,
                new SeoMeta(
                        "Thương hiệu LS2",
                        "Sản phẩm LS2 tại BigBike.",
                        "https://bigbike.vn/brands/ls2/",
                        null,
                        false
                ),
                true,
                Instant.parse("2026-04-02T03:00:00Z"),
                Instant.parse("2026-04-18T03:00:00Z")
        );

        Brand kyt = new Brand(
                "brand_kyt",
                "kyt",
                "KYT",
                "Thương hiệu mũ bảo hiểm KYT.",
                new ImageAsset(
                        "img_brand_kyt",
                        "https://cdn.bigbike.local/brands/kyt.png",
                        "KYT",
                        500,
                        260,
                        "image/png"
                ),
                null,
                new SeoMeta(
                        "Thương hiệu KYT",
                        "Sản phẩm KYT tại BigBike.",
                        "https://bigbike.vn/brands/kyt/",
                        null,
                        false
                ),
                true,
                Instant.parse("2026-04-02T03:00:00Z"),
                Instant.parse("2026-04-18T03:00:00Z")
        );

        this.brands = List.of(ls2, kyt);

        CategorySummary helmetsSummary = summaryOf(helmets);
        CategorySummary jacketsSummary = summaryOf(jackets);
        BrandSummary ls2Summary = summaryOf(ls2);
        BrandSummary kytSummary = summaryOf(kyt);

        Product product1 = new Product(
                "prod_ls2_ff800",
                "LS2-FF800-RED-M",
                "mu-bao-hiem-ls2-ff800",
                "Mũ bảo hiểm LS2 FF800",
                "Mũ fullface LS2 FF800 cho đường trường.",
                "Mũ fullface khí động học, lót tháo rời, chuẩn an toàn ECE.",
                ls2Summary,
                helmetsSummary,
                List.of(helmetsSummary),
                new ImageAsset(
                        "img_prod_ls2_ff800_main",
                        "https://cdn.bigbike.local/products/ls2-ff800/main.jpg",
                        "Mũ bảo hiểm LS2 FF800",
                        1200,
                        1200,
                        "image/jpeg"
                ),
                List.of(
                        new ImageAsset(
                                "img_prod_ls2_ff800_1",
                                "https://cdn.bigbike.local/products/ls2-ff800/1.jpg",
                                "LS2 FF800 góc nghiêng",
                                1200,
                                1200,
                                "image/jpeg"
                        ),
                        new ImageAsset(
                                "img_prod_ls2_ff800_2",
                                "https://cdn.bigbike.local/products/ls2-ff800/2.jpg",
                                "LS2 FF800 chi tiết khóa",
                                1200,
                                1200,
                                "image/jpeg"
                        )
                ),
                List.of(
                        new VideoAsset(
                                "vid_ls2_ff800_review",
                                "https://www.youtube.com/watch?v=ls2ff800-demo",
                                "Review LS2 FF800",
                                null,
                                "YOUTUBE"
                        )
                ),
                new ProductPrice(BigDecimal.valueOf(3250000), BigDecimal.valueOf(3690000), BigDecimal.valueOf(3250000), "VND"),
                List.of(
                        new ProductVariant(
                                "var_ls2_ff800_red_m",
                                "LS2-FF800-RED-M",
                                "Đỏ / M",
                                List.of(
                                        new ProductVariantOption("Color", "Đỏ"),
                                        new ProductVariantOption("Size", "M")
                                ),
                                new ProductPrice(BigDecimal.valueOf(3250000), BigDecimal.valueOf(3690000), BigDecimal.valueOf(3250000), "VND"),
                                ProductStockState.IN_STOCK,
                                12,
                                null,
                                List.of(),
                                true,
                                false
                        ),
                        new ProductVariant(
                                "var_ls2_ff800_black_l",
                                "LS2-FF800-BLACK-L",
                                "Đen / L",
                                List.of(
                                        new ProductVariantOption("Color", "Đen"),
                                        new ProductVariantOption("Size", "L")
                                ),
                                new ProductPrice(BigDecimal.valueOf(3250000), BigDecimal.valueOf(3690000), BigDecimal.valueOf(3250000), "VND"),
                                ProductStockState.LOW_STOCK,
                                3,
                                null,
                                List.of(),
                                true,
                                false
                        )
                ),
                List.of(
                        new ProductSpecification("Chuẩn an toàn", "ECE 22.06", "An toàn"),
                        new ProductSpecification("Trọng lượng", "1500g ± 50g", "Thông số")
                ),
                ProductStockState.IN_STOCK,
                15,
                false,
                PublishStatus.PUBLISHED,
                com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.FEATURED_GRID,
                1,
                new BigDecimal("4.50"),
                null,
                null,
                new SeoMeta(
                        "Mũ bảo hiểm LS2 FF800",
                        "Mũ fullface LS2 FF800 chính hãng tại BigBike.",
                        "https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/",
                        null,
                        false
                ),
                Instant.parse("2026-04-01T05:00:00Z"),
                Instant.parse("2026-04-18T06:30:00Z")
        );

        Product product2 = new Product(
                "prod_kyt_nxrace",
                "KYT-NXRACE-WHT-M",
                "mu-bao-hiem-kyt-nx-race",
                "Mũ bảo hiểm KYT NX Race",
                "Mũ fullface KYT cho rider hiệu năng cao.",
                "Thiết kế thể thao, kính quang học rõ nét, nội thất êm.",
                kytSummary,
                helmetsSummary,
                List.of(helmetsSummary),
                new ImageAsset(
                        "img_prod_kyt_nxrace_main",
                        "https://cdn.bigbike.local/products/kyt-nx-race/main.jpg",
                        "Mũ bảo hiểm KYT NX Race",
                        1200,
                        1200,
                        "image/jpeg"
                ),
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(2890000), null, null, "VND"),
                List.of(),
                List.of(new ProductSpecification("Vỏ mũ", "Composite", "Thông số")),
                ProductStockState.IN_STOCK,
                null,
                false,
                PublishStatus.HIDDEN,
                com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE,
                null,
                new BigDecimal("4.50"),
                null,
                null,
                new SeoMeta(
                        "Mũ bảo hiểm KYT NX Race",
                        "KYT NX Race hàng chính hãng.",
                        "https://bigbike.vn/product/mu-bao-hiem-kyt-nx-race/",
                        null,
                        false
                ),
                Instant.parse("2026-04-02T05:00:00Z"),
                Instant.parse("2026-04-19T07:30:00Z")
        );

        Product product3 = new Product(
                "prod_ls2_jacket_city",
                "LS2-JACKET-CITY-BLK-L",
                "ao-giap-ls2-city-rider",
                "Áo giáp LS2 City Rider",
                "Áo giáp touring thoáng khí.",
                "Áo giáp LS2 City Rider có bảo vệ vai, cùi chỏ, lưng.",
                ls2Summary,
                jacketsSummary,
                List.of(jacketsSummary),
                new ImageAsset(
                        "img_prod_ls2_jacket_city_main",
                        "https://cdn.bigbike.local/products/ls2-city-rider/main.jpg",
                        "Áo giáp LS2 City Rider",
                        1200,
                        1200,
                        "image/jpeg"
                ),
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(2450000), BigDecimal.valueOf(2790000), BigDecimal.valueOf(2450000), "VND"),
                List.of(),
                List.of(new ProductSpecification("Chất liệu", "Lưới + chống mài mòn", "Thông số")),
                ProductStockState.LOW_STOCK,
                4,
                false,
                PublishStatus.PUBLISHED,
                com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.FEATURED_GRID,
                2,
                new BigDecimal("4.50"),
                null,
                null,
                new SeoMeta(
                        "Áo giáp LS2 City Rider",
                        "Áo giáp LS2 cho touring và daily ride.",
                        "https://bigbike.vn/product/ao-giap-ls2-city-rider/",
                        null,
                        false
                ),
                Instant.parse("2026-04-05T05:00:00Z"),
                Instant.parse("2026-04-18T09:10:00Z")
        );

        this.products = List.of(product1, product2, product3);
    }

    @Override
    public List<Product> findAllProducts() {
        return products;
    }

    @Override
    public List<Product> findProductsFiltered(String query, String publishStatus, String stockState, String brandId, String categoryId) {
        boolean trashFilter = publishStatus != null && publishStatus.equalsIgnoreCase("TRASH");
        boolean defaultList = publishStatus == null || publishStatus.isBlank() || publishStatus.equalsIgnoreCase("ALL");
        return products.stream()
                .filter(p -> query == null || query.isBlank()
                        || p.name().toLowerCase().contains(query.toLowerCase())
                        || p.slug().toLowerCase().contains(query.toLowerCase()))
                .filter(p -> trashFilter ? p.publishStatus() == PublishStatus.TRASH
                        : defaultList ? p.publishStatus() != PublishStatus.TRASH
                        : p.publishStatus().name().equalsIgnoreCase(publishStatus))
                .filter(p -> stockState == null || stockState.isBlank()
                        || p.stockState().name().equalsIgnoreCase(stockState))
                .filter(p -> brandId == null || brandId.isBlank()
                        || (p.brand() != null && p.brand().id().equals(brandId)))
                .filter(p -> categoryId == null || categoryId.isBlank()
                        || (p.category() != null && p.category().id().equals(categoryId)))
                .toList();
    }

    @Override
    public Optional<Product> findProductBySlug(String slug) {
        return products.stream().filter(product -> product.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Product> findProductById(String id) {
        return products.stream().filter(product -> product.id().equals(id)).findFirst();
    }

    @Override
    public Optional<Product> findProductByIdPublicView(String id) {
        return products.stream().filter(product -> product.id().equals(id)).findFirst();
    }

    @Override
    public List<Product> findProductsByIdsPublicView(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return products.stream().filter(product -> ids.contains(product.id())).toList();
    }

    @Override
    public List<Category> findAllCategories() {
        return categories;
    }

    @Override
    public CategoryPage findCategoriesPaged(
            String query,
            String visibility,
            String sortField,
            boolean sortAsc,
            int page,
            int pageSize
    ) {
        var stream = categories.stream();
        if (visibility != null && !visibility.isBlank()) {
            boolean wantVisible = "VISIBLE".equals(visibility);
            stream = stream.filter(c -> c.isVisible() == wantVisible);
        }
        if (query != null && !query.isBlank()) {
            String term = query.toLowerCase(java.util.Locale.ROOT);
            stream = stream.filter(c -> c.name().toLowerCase(java.util.Locale.ROOT).contains(term)
                    || c.slug().toLowerCase(java.util.Locale.ROOT).contains(term));
        }
        java.util.Comparator<Category> cmp = switch (sortField) {
            case "name" -> java.util.Comparator.comparing(Category::name, String.CASE_INSENSITIVE_ORDER);
            case "createdAt" -> java.util.Comparator.comparing(Category::createdAt);
            case "sortOrder" -> java.util.Comparator.comparing(c -> c.sortOrder() == null ? Integer.MAX_VALUE : c.sortOrder());
            default -> java.util.Comparator.comparing(Category::updatedAt);
        };
        if (!sortAsc) cmp = cmp.reversed();

        List<Category> sorted = stream.sorted(cmp).toList();
        long total = sorted.size();
        int from = Math.max(0, (page - 1) * pageSize);
        int to = Math.min(sorted.size(), from + pageSize);
        List<Category> slice = from >= sorted.size() ? List.of() : sorted.subList(from, to);
        return new CategoryPage(slice, total);
    }

    @Override
    public Optional<Category> findCategoryBySlug(String slug) {
        return categories.stream().filter(category -> category.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Category> findCategoryById(String id) {
        return categories.stream().filter(category -> category.id().equals(id)).findFirst();
    }

    @Override
    public List<Brand> findAllBrands() {
        return brands;
    }

    @Override
    public Optional<Brand> findBrandBySlug(String slug) {
        return brands.stream().filter(brand -> brand.slug().equals(slug)).findFirst();
    }

    @Override
    public Optional<Brand> findBrandById(String id) {
        return brands.stream().filter(brand -> brand.id().equals(id)).findFirst();
    }

    private static CategorySummary summaryOf(Category category) {
        return new CategorySummary(category.id(), category.slug(), category.name());
    }

    private static BrandSummary summaryOf(Brand brand) {
        return new BrandSummary(brand.id(), brand.slug(), brand.name());
    }
}
