package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

/**
 * End-to-end save -> read roundtrip for color-scoped variant gallery.
 * Reproduces the user's "saved gallery doesn't show up on edit reload" report
 * to surface whether the bug is in the write path or the read path.
 */
@SpringBootTest
@Sql(scripts = "/db/size-scale-test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
@Transactional
class VariantGalleryRoundtripTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired ProductMutationService mutationService;
    @Autowired CatalogReadRepository readRepository;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @Autowired AttributeJpaRepository attributeRepo;
    @Autowired AttributeValueJpaRepository attributeValueRepo;
    @Autowired com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository brandRepo;
    @PersistenceContext EntityManager entityManager;

    private CategoryEntity category;
    private com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity brand;

    @BeforeEach
    void setup() {
        category = categoryRepo.findBySlug("test-cat-vgallery").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-cat-vgallery");
            c.setSlug("test-cat-vgallery");
            c.setName("Test Cat VGallery");
            c.setVisible(true);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
        brand = brandRepo.findBySlug("test-brand-vgallery").orElseGet(() -> {
            com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity b = new com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity();
            b.setId("test-brand-vgallery");
            b.setSlug("test-brand-vgallery");
            b.setName("Test Brand VGallery");
            b.setCreatedAt(Instant.now());
            b.setUpdatedAt(Instant.now());
            return brandRepo.save(b);
        });
    }

    @Test
    void variantGallery_persistsAndIsReadBack() {
        // -- 1. Create product with one variant carrying a 3-image gallery --
        UpsertProductRequest create = createProductRequest("vgallery-product-1", "VGallery Product 1");
        create.setTranslations(englishName("VGallery Product 1 EN"));

        VariantRequest variant = variantRequest();
        variant.setIsAvailable(true);
        variant.setRetailPrice(BigDecimal.TEN);
        variant.setOptions(List.of(option("Color", "Red"), option("Size", "M")));
        variant.setGallery(List.of(
                galleryItem("/media/red-front.jpg", "Red front", 0),
                galleryItem("/media/red-side.jpg",  "Red side",  1),
                galleryItem("/media/red-back.jpg",  "Red back",  2)
        ));
        create.setVariants(List.of(variant));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        assertThat(saved.variants()).hasSize(1);
        assertThat(saved.variants().get(0).gallery())
                .as("gallery present on the immediate save response")
                .hasSize(3);

        // -- 2. Re-read the product through the same path the admin GET uses --
        Product reread = readRepository.findProductById(saved.id()).orElseThrow();

        assertThat(reread.variants()).hasSize(1);
        var galleryFromRead = reread.variants().get(0).gallery();
        assertThat(galleryFromRead)
                .as("gallery survives the roundtrip and is returned by the read repo")
                .hasSize(3);
        assertThat(galleryFromRead.get(0).image().url()).isEqualTo("/media/red-front.jpg");
        assertThat(galleryFromRead.get(2).image().url()).isEqualTo("/media/red-back.jpg");
    }

    @Test
    void variantGallery_isReplacedOnUpdateAndReadBack() {
        // -- Initial save with 2 images --
        UpsertProductRequest create = createProductRequest("vgallery-product-2", "VGallery Product 2");
        create.setTranslations(englishName("VGallery Product 2 EN"));

        VariantRequest v1 = variantRequest();
        v1.setIsAvailable(true);
        v1.setRetailPrice(BigDecimal.TEN);
        v1.setOptions(List.of(option("Color", "Black"), option("Size", "L")));
        v1.setGallery(List.of(
                galleryItem("/media/black-1.jpg", "Black 1", 0),
                galleryItem("/media/black-2.jpg", "Black 2", 1)
        ));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        // -- Update with 4 different images, reusing the same variant ID --
        UpsertProductRequest update = createProductRequest("vgallery-product-2", "VGallery Product 2");
        update.setTranslations(englishName("VGallery Product 2 EN"));

        VariantRequest v2 = variantRequest();
        v2.setId(variantId);
        v2.setIsAvailable(true);
        v2.setRetailPrice(BigDecimal.TEN);
        v2.setOptions(List.of(option("Color", "Black"), option("Size", "L")));
        v2.setGallery(List.of(
                galleryItem("/media/black-A.jpg", "Black A", 0),
                galleryItem("/media/black-B.jpg", "Black B", 1),
                galleryItem("/media/black-C.jpg", "Black C", 2),
                galleryItem("/media/black-D.jpg", "Black D", 3)
        ));
        update.setVariants(List.of(v2));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        var gallery = reread.variants().get(0).gallery();
        assertThat(gallery)
                .as("update should fully replace the previous gallery")
                .hasSize(4);
        assertThat(gallery.stream().map(g -> g.image().url()).toList())
                .containsExactly(
                        "/media/black-A.jpg",
                        "/media/black-B.jpg",
                        "/media/black-C.jpg",
                        "/media/black-D.jpg"
                );
    }

    @Test
    void variantGallery_isSharedByColorAcrossSizes() {
        UpsertProductRequest create = createProductRequest("vgallery-product-color-scope", "VGallery Product Color Scope");
        create.setTranslations(englishName("VGallery Product Color Scope EN"));

        VariantRequest redS = variant("Red", "S");
        VariantRequest redM = variant("Red", "M");
        redM.setGallery(List.of(
                galleryItem("/media/red-1.jpg", "Red 1", 0),
                galleryItem("/media/red-2.jpg", "Red 2", 1)
        ));
        VariantRequest blueS = variant("Blue", "S");
        blueS.setGallery(List.of(galleryItem("/media/blue-1.jpg", "Blue 1", 0)));
        create.setVariants(List.of(redS, redM, blueS));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants()).hasSize(3);
        assertThat(saved.variants().get(0).gallery().stream().map(g -> g.image().url()).toList())
                .containsExactly("/media/red-1.jpg", "/media/red-2.jpg");
        assertThat(saved.variants().get(1).gallery().stream().map(g -> g.image().url()).toList())
                .containsExactly("/media/red-1.jpg", "/media/red-2.jpg");
        assertThat(saved.variants().get(2).gallery().stream().map(g -> g.image().url()).toList())
                .containsExactly("/media/blue-1.jpg");
    }

    @Test
    void variantImage_isSharedByColorAcrossSizes() {
        UpsertProductRequest create = createProductRequest("vimage-product-color-scope", "VImage Product Color Scope");
        create.setTranslations(englishName("VImage Product Color Scope EN"));

        // Cover image is explicit imageUrl from variant request of same color. Red-S
        // carries Red's imageUrl; Red-M does not - backend applies Red's cover to both.
        VariantRequest redS = variant("Red", "S");
        redS.setImageUrl("/media/red-main.jpg");
        redS.setImageAlt("Red main");
        VariantRequest redM = variant("Red", "M");
        VariantRequest blueL = variant("Blue", "L");
        blueL.setImageUrl("/media/blue-main.jpg");
        blueL.setImageAlt("Blue main");
        create.setVariants(List.of(redS, redM, blueL));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants()).hasSize(3);
        assertThat(saved.variants().get(0).image().url())
                .as("Red/S cover = explicit imageUrl of Red variant")
                .isEqualTo("/media/red-main.jpg");
        assertThat(saved.variants().get(1).image().url())
                .as("Red/M inherits Red color cover")
                .isEqualTo("/media/red-main.jpg");
        assertThat(saved.variants().get(2).image().url())
                .as("Blue/L cover = explicit imageUrl of Blue variant")
                .isEqualTo("/media/blue-main.jpg");
    }

    @Test
    void variantImage_isReplacedOnUpdateAcrossSizes() {
        UpsertProductRequest create = createProductRequest("vimage-product-update", "VImage Product Update");
        create.setTranslations(englishName("VImage Product Update EN"));

        VariantRequest greenS = variant("Green", "S");
        greenS.setImageUrl("/media/green-v1.jpg");
        greenS.setImageAlt("Green v1");
        VariantRequest greenM = variant("Green", "M");
        create.setVariants(List.of(greenS, greenM));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String idS = saved.variants().get(0).id();
        String idM = saved.variants().get(1).id();

        // Update: change the image via Green/M this time
        UpsertProductRequest update = createProductRequest("vimage-product-update", "VImage Product Update");
        update.setTranslations(englishName("VImage Product Update EN"));

        VariantRequest updatedS = variant("Green", "S");
        updatedS.setId(idS);
        VariantRequest updatedM = variant("Green", "M");
        updatedM.setId(idM);
        updatedM.setImageUrl("/media/green-v2.jpg");
        updatedM.setImageAlt("Green v2");
        update.setVariants(List.of(updatedS, updatedM));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants().get(0).image().url())
                .as("Green/S cover updated from Green/M's new imageUrl")
                .isEqualTo("/media/green-v2.jpg");
        assertThat(reread.variants().get(1).image().url())
                .as("Green/M cover = Green/M's updated imageUrl")
                .isEqualTo("/media/green-v2.jpg");
    }

    @Test
    void variantImage_isNullForVariantWithoutColor() {
        UpsertProductRequest create = createProductRequest("vimage-product-no-color", "VImage Product No Color");
        create.setTranslations(englishName("VImage Product No Color EN"));

        VariantRequest sizeOnly = variantRequest();
        sizeOnly.setIsAvailable(true);
        sizeOnly.setRetailPrice(BigDecimal.TEN);
        sizeOnly.setOptions(List.of(option("Size", "M")));
        create.setVariants(List.of(sizeOnly));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants().get(0).image())
                .as("a no-color variant has no gallery, so no derived cover image")
                .isNull();
    }

    @Test
    void readRepository_scopesImageByColor_evenWhenDbHasInconsistentLegacyData() {
        // Reproduces the user-visible bug from before this fix: variants of the
        // same color showing different main images on edit / storefront. The
        // mutation service has scoped image-by-color for a while, so any current
        // save produces consistent rows. But legacy WordPress imports persisted
        // image_url per variant independently, so the DB can still hold
        // inconsistent rows across same-color siblings. Bypass the mutation
        // service to plant that inconsistency, then verify the read path
        // collapses it back to a single color-scoped image.
        UpsertProductRequest create = createProductRequest("vimage-legacy-inconsistent", "VImage Legacy Inconsistent");
        create.setTranslations(englishName("VImage Legacy Inconsistent EN"));

        VariantRequest yellowS = variant("Yellow", "S");
        VariantRequest yellowM = variant("Yellow", "M");
        VariantRequest yellowL = variant("Yellow", "L");
        create.setVariants(List.of(yellowS, yellowM, yellowL));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String idS = saved.variants().get(0).id();
        String idM = saved.variants().get(1).id();
        String idL = saved.variants().get(2).id();

        // Plant inconsistent imageUrls directly via JPA - simulating data that
        // landed in the DB through the WP migration importer (or any other
        // write path that bypasses AdminCatalogMutationService.applyVariants).
        ProductVariantEntity variantS = variantRepo.findById(idS).orElseThrow();
        variantS.setImageUrl("/media/yellow-S-divergent.jpg");
        variantRepo.save(variantS);
        ProductVariantEntity variantM = variantRepo.findById(idM).orElseThrow();
        variantM.setImageUrl("/media/yellow-M-divergent.jpg");
        variantRepo.save(variantM);
        ProductVariantEntity variantL = variantRepo.findById(idL).orElseThrow();
        variantL.setImageUrl("/media/yellow-L-divergent.jpg");
        variantRepo.save(variantL);
        // Force the inconsistent state into the DB and drop the cached entities
        // so the read repository hits a fresh load (otherwise the surrounding
        // @Transactional would just hand it back the in-memory copies).
        entityManager.flush();
        entityManager.clear();

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants()).hasSize(3);
        String scopedUrl = reread.variants().get(0).image().url();
        assertThat(scopedUrl)
                .as("scoped image must come from the first non-null variant of the color group (Yellow/S by sortOrder)")
                .isEqualTo("/media/yellow-S-divergent.jpg");
        assertThat(reread.variants().get(1).image().url())
                .as("Yellow/M must read back the same color-scoped image as Yellow/S")
                .isEqualTo(scopedUrl);
        assertThat(reread.variants().get(2).image().url())
                .as("Yellow/L must read back the same color-scoped image as Yellow/S")
                .isEqualTo(scopedUrl);
    }

    @Test
    void readRepository_returnsNullImageForNoColorVariant() {
        UpsertProductRequest create = createProductRequest("vimage-no-color-read", "VImage No Color Read");
        create.setTranslations(englishName("VImage No Color Read EN"));

        VariantRequest sizeOnly = variantRequest();
        sizeOnly.setIsAvailable(true);
        sizeOnly.setRetailPrice(BigDecimal.TEN);
        sizeOnly.setOptions(List.of(option("Size", "XL")));
        create.setVariants(List.of(sizeOnly));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        // Plant a stray imageUrl on a no-color variant (e.g., from a legacy
        // import). Read path must mirror the write path and ignore it.
        ProductVariantEntity v = variantRepo.findById(variantId).orElseThrow();
        v.setImageUrl("/media/stray-no-color.jpg");
        variantRepo.save(v);
        entityManager.flush();
        entityManager.clear();

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants().get(0).image())
                .as("a no-color variant must surface no image, even if the DB row has one")
                .isNull();
    }

    @Test
    void variantGallery_requiresColorOption() {
        UpsertProductRequest create = createProductRequest("vgallery-product-no-color", "VGallery Product No Color");

        VariantRequest sizeOnly = variantRequest();
        sizeOnly.setIsAvailable(true);
        sizeOnly.setRetailPrice(BigDecimal.TEN);
        sizeOnly.setOptions(List.of(option("Size", "M")));
        sizeOnly.setGallery(List.of(galleryItem("/media/size-m.jpg", "Size M", 0)));
        create.setVariants(List.of(sizeOnly));

        assertThatThrownBy(() -> mutationService.createProduct(create, DEV_ADMIN_ID))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Validation failed");
    }

    @Test
    void multiWordColor_swatchSurvivesLabelRoundtrip() {
        // Dictionary term whose slug is hyphenated ("den-bong") but whose label is a
        // multi-word, diacritic Vietnamese string ("Đen bóng"). The read path returns
        // the label, so an edit-then-resave sends the label back as the option value
        // (no explicit attributeValueId), which must still relink to the swatch.
        AttributeEntity attr = attributeRepo.findByCode("test-color-mw").orElseGet(() -> {
            AttributeEntity a = new AttributeEntity();
            a.setId("test-color-mw");
            a.setCode("test-color-mw");
            a.setName("Test Color MW");
            a.setKind("select");
            a.setVariation(true);
            return attributeRepo.save(a);
        });
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "den-bong").isEmpty()) {
            AttributeValueEntity v = new AttributeValueEntity();
            v.setId("test-color-mw-den-bong");
            v.setAttribute(attr);
            v.setSlug("den-bong");
            v.setLabel("Đen bóng");
            v.setSortOrder(0);
            attributeValueRepo.save(v);
        }
        entityManager.flush();

        // -- 1. Create using the SLUG as the option value (no attributeValueId) --
        UpsertProductRequest create = createProductRequest("mw-color-product", "MW Color Product");
        create.setTranslations(englishName("MW Color Product EN"));

        VariantRequest v1 = variantRequest();
        v1.setIsAvailable(true);
        v1.setRetailPrice(BigDecimal.TEN);
        v1.setOptions(List.of(option("test-color-mw", "den-bong")));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        Product afterCreate = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(afterCreate.variants().get(0).options().get(0).value())
                .as("read path returns the human label, not the slug")
                .isEqualTo("Đen bóng");
        assertThat(afterCreate.variants().get(0).options().get(0).attributeValueId())
                .as("admin read exposes the dictionary value id for round-trip")
                .isEqualTo("test-color-mw-den-bong");

        // The public storefront view must NOT carry the internal dictionary id.
        Product publicView = readRepository
                .findProductByIdPublicView(saved.id(), "vi").orElseThrow();
        assertThat(publicView.variants().get(0).options().get(0).attributeValueId())
                .as("public view omits attributeValueId")
                .isNull();

        // -- 2. Re-save sending the LABEL back (the edit-reload round-trip) --
        UpsertProductRequest update = createProductRequest("mw-color-product", "MW Color Product");
        update.setTranslations(englishName("MW Color Product EN"));

        VariantRequest v2 = variantRequest();
        v2.setId(variantId);
        v2.setIsAvailable(true);
        v2.setRetailPrice(BigDecimal.TEN);
        v2.setOptions(List.of(option("test-color-mw", "Đen bóng")));
        update.setVariants(List.of(v2));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product afterUpdate = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(afterUpdate.variants().get(0).options().get(0).value())
                .as("multi-word label must survive the round-trip on re-save")
                .isEqualTo("Đen bóng");

        // The write path must also relink & persist the attribute_value FK, so the
        // read doesn't fall back to the label->slug lookup on every subsequent read.
        entityManager.flush();
        entityManager.clear();
        ProductVariantEntity storedVariant = variantRepo.findById(variantId).orElseThrow();
        assertThat(storedVariant.getOptions().get(0).getAttributeValue())
                .as("re-save with the label must relink and persist the attribute_value FK")
                .isNotNull();
    }

    @Test
    void dedupSuffixSlug_roundTripsViaAttributeValueId() {
        // A WP dedup-suffixed slug ("xam-2") whose label ("Xám") cannot be normalised
        // back to the slug ("xam" != "xam-2"). Only the explicit attributeValueId -
        // returned by the admin read and sent back on save - keeps the swatch linked.
        AttributeEntity attr = attributeRepo.findByCode("test-color-dedup").orElseGet(() -> {
            AttributeEntity a = new AttributeEntity();
            a.setId("test-color-dedup");
            a.setCode("test-color-dedup");
            a.setName("Test Color Dedup");
            a.setKind("select");
            a.setVariation(true);
            return attributeRepo.save(a);
        });
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "xam-2").isEmpty()) {
            AttributeValueEntity v = new AttributeValueEntity();
            v.setId("test-color-dedup-xam-2");
            v.setAttribute(attr);
            v.setSlug("xam-2");
            v.setLabel("Xám");
            v.setSortOrder(0);
            attributeValueRepo.save(v);
        }
        entityManager.flush();

        // -- Create with the explicit attributeValueId (the admin dictionary pick) --
        UpsertProductRequest create = createProductRequest("dedup-color-product", "Dedup Color Product");
        create.setTranslations(englishName("Dedup Color Product EN"));

        VariantRequest v1 = variantRequest();
        v1.setIsAvailable(true);
        v1.setRetailPrice(BigDecimal.TEN);
        v1.setOptions(List.of(colorOption("test-color-dedup", "xam-2", "test-color-dedup-xam-2")));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        Product afterCreate = readRepository.findProductById(saved.id()).orElseThrow();
        String roundTrippedId = afterCreate.variants().get(0).options().get(0).attributeValueId();
        assertThat(roundTrippedId).isEqualTo("test-color-dedup-xam-2");
        assertThat(afterCreate.variants().get(0).options().get(0).value()).isEqualTo("Xám");

        // -- Re-save sending the LABEL back plus the round-tripped id (what the admin
        //    form does). The label alone would not relink; the explicit id does. --
        UpsertProductRequest update = createProductRequest("dedup-color-product", "Dedup Color Product");
        update.setTranslations(englishName("Dedup Color Product EN"));

        VariantRequest v2 = variantRequest();
        v2.setId(variantId);
        v2.setIsAvailable(true);
        v2.setRetailPrice(BigDecimal.TEN);
        v2.setOptions(List.of(colorOption("test-color-dedup", "Xám", roundTrippedId)));
        update.setVariants(List.of(v2));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        entityManager.flush();
        entityManager.clear();
        ProductVariantEntity storedVariant = variantRepo.findById(variantId).orElseThrow();
        assertThat(storedVariant.getOptions().get(0).getAttributeValue())
                .as("explicit attributeValueId relinks a dedup-suffixed slug the label can't reconstruct")
                .isNotNull();
    }

    @Test
    void staleAttributeValueId_relinksAfterFreeTextValueEdit() {
        // Reproduces the reported bug end-to-end: VariantEditors.jsx's free-text
        // Input for a non-color option (e.g. "Size") sends the new text on edit but
        // does not clear the stale attributeValueId already sitting in local state
        // from the last load - before the fix this made Path 1 blindly trust the
        // old id, so the "Size" badge stayed stuck on the old value forever.
        AttributeEntity attr = attributeRepo.findByCode("test-size-stale").orElseGet(() -> {
            AttributeEntity a = new AttributeEntity();
            a.setId("test-size-stale");
            a.setCode("test-size-stale");
            a.setName("Test Size Stale");
            a.setKind("select");
            a.setVariation(true);
            return attributeRepo.save(a);
        });
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "xxl").isEmpty()) {
            AttributeValueEntity xxl = new AttributeValueEntity();
            xxl.setId("test-size-stale-xxl");
            xxl.setAttribute(attr);
            xxl.setSlug("xxl");
            xxl.setLabel("XXL");
            xxl.setSortOrder(0);
            attributeValueRepo.save(xxl);
        }
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "xxxl").isEmpty()) {
            AttributeValueEntity xxxl = new AttributeValueEntity();
            xxxl.setId("test-size-stale-xxxl");
            xxxl.setAttribute(attr);
            xxxl.setSlug("xxxl");
            xxxl.setLabel("XXXL");
            xxxl.setSortOrder(1);
            attributeValueRepo.save(xxxl);
        }
        entityManager.flush();

        // -- 1. Create sending only the free-text value "XXL" (no explicit id - this
        //    is exactly what the non-color Input in VariantEditors.jsx sends). Path
        //    2/3 auto-links to the XXL dictionary entry by slug match, and the read
        //    response hands the admin form that id back for round-tripping. --
        UpsertProductRequest create = createProductRequest("stale-size-product", "Stale Size Product");
        create.setTranslations(englishName("Stale Size Product EN"));

        VariantRequest v1 = variantRequest();
        v1.setIsAvailable(true);
        v1.setRetailPrice(BigDecimal.TEN);
        v1.setOptions(List.of(option("test-size-stale", "XXL")));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        Product afterCreate = readRepository.findProductById(saved.id()).orElseThrow();
        String staleId = afterCreate.variants().get(0).options().get(0).attributeValueId();
        assertThat(staleId)
                .as("initial save auto-links via slug match, so the read round-trips the XXL dictionary id")
                .isEqualTo("test-size-stale-xxl");

        // A real edit is a separate HTTP request/session from the create, which always
        // starts by loading the current row fresh from the DB. Flush + clear here so the
        // update below sees that same fresh-load boundary instead of chaining onto the
        // create's still-open persistence context in one transaction.
        entityManager.flush();
        entityManager.clear();

        // -- 2. Re-save simulating the free-text-edit bug: NEW text "XXXL" but the
        //    SAME stale attributeValueId the read handed back for "XXL" - exactly
        //    what onUpdate({ value: e.target.value }) without clearing
        //    attributeValueId produces. --
        UpsertProductRequest update = createProductRequest("stale-size-product", "Stale Size Product");
        update.setTranslations(englishName("Stale Size Product EN"));

        VariantRequest v2 = variantRequest();
        v2.setId(variantId);
        v2.setIsAvailable(true);
        v2.setRetailPrice(BigDecimal.TEN);
        v2.setOptions(List.of(colorOption("test-size-stale", "XXXL", staleId)));
        update.setVariants(List.of(v2));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        entityManager.flush();
        entityManager.clear();
        ProductVariantEntity storedVariant = variantRepo.findById(variantId).orElseThrow();
        assertThat(storedVariant.getOptions())
                .as("update must fully replace the option, not append a second row")
                .hasSize(1);
        assertThat(storedVariant.getOptions().get(0).getAttributeValue())
                .as("stale XXL FK must not stick once the free-text value says XXXL")
                .isNotNull();
        assertThat(storedVariant.getOptions().get(0).getAttributeValue().getId())
                .as("must re-link to the XXXL dictionary entry instead of keeping the stale XXL FK")
                .isEqualTo("test-size-stale-xxxl");

        Product afterUpdate = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(afterUpdate.variants().get(0).options().get(0).value())
                .as("read-back label must reflect the new value, not the stale XXL label")
                .isEqualTo("XXXL");
    }

    @Test
    void readPath_discardsStalePersistedAttributeValue() {
        // Site 3 (read-path self-heal): construct a corrupted row directly via JPA,
        // bypassing the (now-fixed) write path - this is the shape a pre-fix save
        // could have left behind, or that any future write path bypassing
        // AdminCatalogMutationService could still produce. The read path must not
        // trust an attribute_value FK that disagrees with the option's own text.
        AttributeEntity attr = attributeRepo.findByCode("test-size-corrupt").orElseGet(() -> {
            AttributeEntity a = new AttributeEntity();
            a.setId("test-size-corrupt");
            a.setCode("test-size-corrupt");
            a.setName("Test Size Corrupt");
            a.setKind("select");
            a.setVariation(true);
            return attributeRepo.save(a);
        });
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "xxl").isEmpty()) {
            AttributeValueEntity xxl = new AttributeValueEntity();
            xxl.setId("test-size-corrupt-xxl");
            xxl.setAttribute(attr);
            xxl.setSlug("xxl");
            xxl.setLabel("XXL");
            xxl.setSortOrder(0);
            attributeValueRepo.save(xxl);
        }
        if (attributeValueRepo.findByAttributeIdAndSlug(attr.getId(), "xxxl").isEmpty()) {
            AttributeValueEntity xxxl = new AttributeValueEntity();
            xxxl.setId("test-size-corrupt-xxxl");
            xxxl.setAttribute(attr);
            xxxl.setSlug("xxxl");
            xxxl.setLabel("XXXL");
            xxxl.setSortOrder(1);
            attributeValueRepo.save(xxxl);
        }
        entityManager.flush();

        // Create normally with "XXL" so the row legitimately links to the XXL entry.
        UpsertProductRequest create = createProductRequest("corrupt-size-product", "Corrupt Size Product");
        create.setTranslations(englishName("Corrupt Size Product EN"));

        VariantRequest v1 = variantRequest();
        v1.setIsAvailable(true);
        v1.setRetailPrice(BigDecimal.TEN);
        v1.setOptions(List.of(option("test-size-corrupt", "XXL")));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        // Directly corrupt the persisted row via JPA, bypassing the mutation
        // service entirely: flip optionValue to "XXXL" while leaving the
        // attribute_value FK pointed at the "XXL" dictionary entry.
        ProductVariantEntity storedVariant = variantRepo.findById(variantId).orElseThrow();
        var corruptedOption = storedVariant.getOptions().get(0);
        assertThat(corruptedOption.getAttributeValue().getId())
                .as("sanity check: the create legitimately linked to XXL before we corrupt it")
                .isEqualTo("test-size-corrupt-xxl");
        corruptedOption.setOptionValue("XXXL");
        variantRepo.save(storedVariant);
        entityManager.flush();
        entityManager.clear();

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        var rereadOption = reread.variants().get(0).options().get(0);
        assertThat(rereadOption.value())
                .as("read path must discard the stale XXL FK and resolve XXXL from the dictionary")
                .isEqualTo("XXXL");
        assertThat(rereadOption.attributeValueId())
                .as("admin read must round-trip the re-resolved XXXL id, not the stale XXL id")
                .isEqualTo("test-size-corrupt-xxxl");
    }

    private VariantOptionRequest colorOption(String name, String value, String attributeValueId) {
        VariantOptionRequest option = option(name, value);
        option.setAttributeValueId(attributeValueId);
        return option;
    }

    private VariantRequest variant(String color, String size) {
        VariantRequest variant = variantRequest();
        variant.setIsAvailable(true);
        variant.setRetailPrice(BigDecimal.TEN);
        variant.setOptions(List.of(option("Color", color), option("Size", size)));
        return variant;
    }

    private VariantOptionRequest option(String name, String value) {
        VariantOptionRequest option = new VariantOptionRequest();
        option.setOptionName(name);
        option.setOptionValue(value);
        return option;
    }

    private GalleryImageRequest galleryItem(String url, String alt, int sortOrder) {
        GalleryImageRequest g = new GalleryImageRequest();
        g.setUrl(url);
        g.setAlt(alt);
        g.setSortOrder(sortOrder);
        return g;
    }



    // TRANSLATION_RULE_002 requires translations.en.name on every product create/update
    // (not specific to this feature) - every product save in this file sets it via this
    // helper so the roundtrip logic under test actually runs instead of 400-ing first.
    private ProductTranslationRequest englishName(String name) {
        return new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder().name(name).build());
    }

    private UpsertProductRequest createProductRequest(String slug, String name) {
        UpsertProductRequest req = new UpsertProductRequest();
        req.setSlug(slug);
        req.setName(name);
        req.setCategoryId(category.getId());
        req.setBrandId(brand.getId());
        req.setGender("Nam");
        req.setSizeScaleId("size-scale-helmet-letter");
        req.setSku("SKU-" + slug);
        req.setRetailPrice(new BigDecimal("1000000"));
        req.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.DRAFT);
        com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest image = new com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest();
        image.setUrl("http://localhost:9000/bigbike-media/products/test.jpg");
        image.setAlt("test");
        req.setImage(image);
        return req;
    }

    private VariantRequest variantRequest() {
        VariantRequest v = new VariantRequest();
        v.setSku("VAR-" + UUID.randomUUID().toString().substring(0, 8));
        return v;
    }

    @Test
    void sizeOnlyVariant_publishesWithoutVariantImage() {
        // PRODUCT_RULE_005 (fix 2026-07-11): a variant with only a Size option (no color) has
        // no "color representation image" and no image field on the admin form — the publish
        // gate must NOT demand one, else one-color/multi-size products cannot be published.
        UpsertProductRequest create = createProductRequest("size-only-publishable", "Size Only Publishable");
        create.setTranslations(englishName("Size Only Publishable EN"));

        VariantRequest sizeOnly = variantRequest();         // carries a SKU, no image, no gallery
        sizeOnly.setIsAvailable(true);
        sizeOnly.setRetailPrice(BigDecimal.TEN);
        sizeOnly.setOptions(List.of(option("Size", "M")));  // Size only — NO color option
        create.setVariants(List.of(sizeOnly));

        Product draft = mutationService.createProduct(create, DEV_ADMIN_ID);

        // Must not throw PublishGateException even though the variant carries no image.
        Product saved = mutationService.updateProductPublishStatus(
                draft.id(),
                com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED,
                DEV_ADMIN_ID
        );

        assertThat(saved.publishStatus())
                .isEqualTo(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);
        assertThat(saved.variants()).hasSize(1);
    }

    @Test
    void variantImage_usesExplicitImageUrl() {
        UpsertProductRequest create = createProductRequest("vimage-explicit-image-url", "VImage Explicit ImageUrl");
        create.setTranslations(englishName("VImage Explicit ImageUrl EN"));

        VariantRequest redS = variant("Red", "S");
        redS.setImageUrl("/media/red-side.jpg");
        redS.setImageAlt("Red side");
        create.setVariants(List.of(redS));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants().get(0).image().url())
                .as("explicit imageUrl is returned in variant image")
                .isEqualTo("/media/red-side.jpg");
    }

    @Test
    void variantGallery_readPath_noImage_whenNoneSet() {
        UpsertProductRequest create = createProductRequest("vimage-no-image-when-none-set", "VImage No Image When None Set");
        create.setTranslations(englishName("VImage No Image When None Set EN"));

        VariantRequest greenS = variant("Green", "S");
        greenS.setGallery(List.of(
                galleryItem("/media/green-1.jpg", "Green 1", 0),
                galleryItem("/media/green-2.jpg", "Green 2", 1)
        ));
        create.setVariants(List.of(greenS));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants().get(0).image()).isNull();
        assertThat(reread.variants().get(0).gallery()).hasSize(2);
    }
}
