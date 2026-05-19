package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.FaqRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SpecificationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Save -> read roundtrip for bilingual product content (V136): English is
 * optional, Vietnamese is canonical, and English reads fall back to Vietnamese
 * field-by-field. See BUSINESS_RULES.md PRODUCT_RULE_001 / PRODUCT_RULE_002.
 */
@SpringBootTest
@Transactional
class ProductBilingualRoundtripTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired AdminCatalogMutationService mutationService;
    @Autowired CatalogReadRepository readRepository;
    @Autowired CategoryJpaRepository categoryRepo;

    private CategoryEntity category;

    @BeforeEach
    void setup() {
        category = categoryRepo.findBySlug("test-cat-bilingual").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-cat-bilingual");
            c.setSlug("test-cat-bilingual");
            c.setName("Test Cat Bilingual");
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
    }

    private UpsertProductRequest baseProduct(String slug, String name) {
        UpsertProductRequest req = new UpsertProductRequest();
        req.setSlug(slug);
        req.setName(name);
        req.setCategoryId(category.getId());
        req.setRetailPrice(new BigDecimal("1000000"));
        req.setPublishStatus(PublishStatus.PUBLISHED);
        return req;
    }

    @Test
    void englishContent_persistsAndIsServedPerLocale() {
        UpsertProductRequest create = baseProduct("bilingual-helmet", "Mũ bảo hiểm fullface");
        create.setDescription("Mô tả tiếng Việt");

        ProductTranslationRequest.ProductContentRequest en =
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Full-face helmet")
                        .description("English description")
                        .build();
        create.setTranslations(new ProductTranslationRequest(en));

        SpecificationRequest spec = SpecificationRequest.builder()
                .name("Trọng lượng").value("1500g").nameEn("Weight").valueEn("1500g")
                .build();
        create.setSpecifications(List.of(spec));

        FaqRequest faq = FaqRequest.builder()
                .question("Bảo hành bao lâu?").answer("12 tháng")
                .questionEn("How long is the warranty?").answerEn("12 months")
                .build();
        create.setFaqs(List.of(faq));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        // Public read, English locale — English content is served.
        Product en1 = readRepository.findProductBySlug(saved.slug(), "en").orElseThrow();
        assertThat(en1.name()).isEqualTo("Full-face helmet");
        assertThat(en1.description()).isEqualTo("English description");
        assertThat(en1.specifications().get(0).name()).isEqualTo("Weight");
        assertThat(en1.faqs().get(0).question()).isEqualTo("How long is the warranty?");
        // Public reads never expose the raw translations block.
        assertThat(en1.translations()).isNull();

        // Public read, Vietnamese locale — canonical content is served.
        Product vi = readRepository.findProductBySlug(saved.slug(), "vi").orElseThrow();
        assertThat(vi.name()).isEqualTo("Mũ bảo hiểm fullface");
        assertThat(vi.description()).isEqualTo("Mô tả tiếng Việt");
        assertThat(vi.specifications().get(0).name()).isEqualTo("Trọng lượng");

        // Admin read — Vietnamese in main fields, English carried in translations / *En.
        Product admin = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(admin.name()).isEqualTo("Mũ bảo hiểm fullface");
        assertThat(admin.translations()).isNotNull();
        assertThat(admin.translations().en().name()).isEqualTo("Full-face helmet");
        assertThat(admin.specifications().get(0).name()).isEqualTo("Trọng lượng");
        assertThat(admin.specifications().get(0).nameEn()).isEqualTo("Weight");
        assertThat(admin.faqs().get(0).questionEn()).isEqualTo("How long is the warranty?");
    }

    @Test
    void englishContent_fallsBackToVietnamese_fieldByField() {
        UpsertProductRequest create = baseProduct("bilingual-partial", "Áo giáp bảo hộ");
        create.setDescription("Mô tả áo giáp");

        // Only the English name is set — description has no English version.
        ProductTranslationRequest.ProductContentRequest en =
                ProductTranslationRequest.ProductContentRequest.builder()
                        .name("Protective jacket")
                        .build();
        create.setTranslations(new ProductTranslationRequest(en));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        Product enView = readRepository.findProductBySlug(saved.slug(), "en").orElseThrow();
        assertThat(enView.name()).isEqualTo("Protective jacket");
        // No English description — falls back to Vietnamese.
        assertThat(enView.description()).isEqualTo("Mô tả áo giáp");
    }

    @Test
    void englishContent_isOptional() {
        UpsertProductRequest create = baseProduct("bilingual-none", "Găng tay da");
        create.setDescription("Mô tả găng tay");
        // No translations at all — the product still saves.

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        Product enView = readRepository.findProductBySlug(saved.slug(), "en").orElseThrow();
        assertThat(enView.name()).isEqualTo("Găng tay da");
        assertThat(enView.description()).isEqualTo("Mô tả găng tay");

        Product admin = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(admin.translations())
                .as("no English content -> translations block is null")
                .isNull();
    }
}
