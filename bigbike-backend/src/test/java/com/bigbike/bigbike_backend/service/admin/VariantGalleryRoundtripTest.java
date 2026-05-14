package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * End-to-end save -> read roundtrip for color-scoped variant gallery.
 * Reproduces the user's "saved gallery doesn't show up on edit reload" report
 * to surface whether the bug is in the write path or the read path.
 */
@SpringBootTest
@Transactional
class VariantGalleryRoundtripTest {

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired AdminCatalogMutationService mutationService;
    @Autowired CatalogReadRepository readRepository;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired ProductVariantJpaRepository variantRepo;
    @PersistenceContext EntityManager entityManager;

    private CategoryEntity category;

    @BeforeEach
    void setup() {
        category = categoryRepo.findBySlug("test-cat-vgallery").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-cat-vgallery");
            c.setSlug("test-cat-vgallery");
            c.setName("Test Cat VGallery");
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
    }

    @Test
    void variantGallery_persistsAndIsReadBack() {
        // â”€â”€ 1. Create product with one variant carrying a 3-image gallery â”€â”€
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vgallery-product-1");
        create.setName("VGallery Product 1");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest variant = new VariantRequest();
        variant.setName("Äá» / M");
        variant.setIsAvailable(true);
        variant.setOptions(List.of(option("Color", "Red"), option("Size", "M")));
        variant.setGallery(List.of(
                galleryItem("https://cdn.example.com/red-front.jpg", "Red front", 0),
                galleryItem("https://cdn.example.com/red-side.jpg",  "Red side",  1),
                galleryItem("https://cdn.example.com/red-back.jpg",  "Red back",  2)
        ));
        create.setVariants(List.of(variant));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        assertThat(saved.variants()).hasSize(1);
        assertThat(saved.variants().get(0).gallery())
                .as("gallery present on the immediate save response")
                .hasSize(3);

        // â”€â”€ 2. Re-read the product through the same path the admin GET uses â”€
        Product reread = readRepository.findProductById(saved.id()).orElseThrow();

        assertThat(reread.variants()).hasSize(1);
        var galleryFromRead = reread.variants().get(0).gallery();
        assertThat(galleryFromRead)
                .as("gallery survives the roundtrip and is returned by the read repo")
                .hasSize(3);
        assertThat(galleryFromRead.get(0).url()).isEqualTo("https://cdn.example.com/red-front.jpg");
        assertThat(galleryFromRead.get(2).url()).isEqualTo("https://cdn.example.com/red-back.jpg");
    }

    @Test
    void variantGallery_isReplacedOnUpdateAndReadBack() {
        // â”€â”€ Initial save with 2 images â”€â”€
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vgallery-product-2");
        create.setName("VGallery Product 2");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest v1 = new VariantRequest();
        v1.setName("Äen / L");
        v1.setIsAvailable(true);
        v1.setOptions(List.of(option("Color", "Black"), option("Size", "L")));
        v1.setGallery(List.of(
                galleryItem("https://cdn.example.com/black-1.jpg", "Black 1", 0),
                galleryItem("https://cdn.example.com/black-2.jpg", "Black 2", 1)
        ));
        create.setVariants(List.of(v1));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        // â”€â”€ Update with 4 different images, reusing the same variant ID â”€â”€
        UpsertProductRequest update = new UpsertProductRequest();
        update.setSlug("vgallery-product-2");
        update.setName("VGallery Product 2");
        update.setCategoryId(category.getId());
        update.setRetailPrice(new BigDecimal("1000000"));
        update.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest v2 = new VariantRequest();
        v2.setId(variantId);
        v2.setName("Äen / L");
        v2.setIsAvailable(true);
        v2.setOptions(List.of(option("Color", "Black"), option("Size", "L")));
        v2.setGallery(List.of(
                galleryItem("https://cdn.example.com/black-A.jpg", "Black A", 0),
                galleryItem("https://cdn.example.com/black-B.jpg", "Black B", 1),
                galleryItem("https://cdn.example.com/black-C.jpg", "Black C", 2),
                galleryItem("https://cdn.example.com/black-D.jpg", "Black D", 3)
        ));
        update.setVariants(List.of(v2));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        var gallery = reread.variants().get(0).gallery();
        assertThat(gallery)
                .as("update should fully replace the previous gallery")
                .hasSize(4);
        assertThat(gallery.stream().map(g -> g.url()).toList())
                .containsExactly(
                        "https://cdn.example.com/black-A.jpg",
                        "https://cdn.example.com/black-B.jpg",
                        "https://cdn.example.com/black-C.jpg",
                        "https://cdn.example.com/black-D.jpg"
                );
    }

    @Test
    void variantGallery_isSharedByColorAcrossSizes() {
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vgallery-product-color-scope");
        create.setName("VGallery Product Color Scope");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest redS = variant("Red / S", "Red", "S");
        VariantRequest redM = variant("Red / M", "Red", "M");
        redM.setGallery(List.of(
                galleryItem("https://cdn.example.com/red-1.jpg", "Red 1", 0),
                galleryItem("https://cdn.example.com/red-2.jpg", "Red 2", 1)
        ));
        VariantRequest blueS = variant("Blue / S", "Blue", "S");
        blueS.setGallery(List.of(galleryItem("https://cdn.example.com/blue-1.jpg", "Blue 1", 0)));
        create.setVariants(List.of(redS, redM, blueS));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants()).hasSize(3);
        assertThat(saved.variants().get(0).gallery().stream().map(g -> g.url()).toList())
                .containsExactly("https://cdn.example.com/red-1.jpg", "https://cdn.example.com/red-2.jpg");
        assertThat(saved.variants().get(1).gallery().stream().map(g -> g.url()).toList())
                .containsExactly("https://cdn.example.com/red-1.jpg", "https://cdn.example.com/red-2.jpg");
        assertThat(saved.variants().get(2).gallery().stream().map(g -> g.url()).toList())
                .containsExactly("https://cdn.example.com/blue-1.jpg");
    }

    @Test
    void variantImage_isSharedByColorAcrossSizes() {
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vimage-product-color-scope");
        create.setName("VImage Product Color Scope");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        // Red-S carries the main image; Red-M does not â€” backend should apply Red's image to both.
        VariantRequest redS = variant("Red / S", "Red", "S");
        redS.setImageUrl("https://cdn.example.com/red-main.jpg");
        VariantRequest redM = variant("Red / M", "Red", "M");
        VariantRequest blueL = variant("Blue / L", "Blue", "L");
        blueL.setImageUrl("https://cdn.example.com/blue-main.jpg");
        create.setVariants(List.of(redS, redM, blueL));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants()).hasSize(3);
        assertThat(saved.variants().get(0).image().url())
                .as("Red/S gets Red color image")
                .isEqualTo("https://cdn.example.com/red-main.jpg");
        assertThat(saved.variants().get(1).image().url())
                .as("Red/M inherits Red color image")
                .isEqualTo("https://cdn.example.com/red-main.jpg");
        assertThat(saved.variants().get(2).image().url())
                .as("Blue/L gets Blue color image")
                .isEqualTo("https://cdn.example.com/blue-main.jpg");
    }

    @Test
    void variantImage_isReplacedOnUpdateAcrossSizes() {
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vimage-product-update");
        create.setName("VImage Product Update");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest greenS = variant("Green / S", "Green", "S");
        greenS.setImageUrl("https://cdn.example.com/green-v1.jpg");
        VariantRequest greenM = variant("Green / M", "Green", "M");
        create.setVariants(List.of(greenS, greenM));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String idS = saved.variants().get(0).id();
        String idM = saved.variants().get(1).id();

        // Update: change the image via Green/M this time
        UpsertProductRequest update = new UpsertProductRequest();
        update.setSlug("vimage-product-update");
        update.setName("VImage Product Update");
        update.setCategoryId(category.getId());
        update.setRetailPrice(new BigDecimal("1000000"));
        update.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest updatedS = variant("Green / S", "Green", "S");
        updatedS.setId(idS);
        VariantRequest updatedM = variant("Green / M", "Green", "M");
        updatedM.setId(idM);
        updatedM.setImageUrl("https://cdn.example.com/green-v2.jpg");
        update.setVariants(List.of(updatedS, updatedM));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants().get(0).image().url())
                .as("Green/S gets updated color image from Green/M")
                .isEqualTo("https://cdn.example.com/green-v2.jpg");
        assertThat(reread.variants().get(1).image().url())
                .as("Green/M retains its own updated image")
                .isEqualTo("https://cdn.example.com/green-v2.jpg");
    }

    @Test
    void variantImage_isNullForVariantWithoutColor() {
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vimage-product-no-color");
        create.setName("VImage Product No Color");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest sizeOnly = new VariantRequest();
        sizeOnly.setName("Size M");
        sizeOnly.setIsAvailable(true);
        sizeOnly.setOptions(List.of(option("Size", "M")));
        sizeOnly.setImageUrl("https://cdn.example.com/ignored.jpg");
        create.setVariants(List.of(sizeOnly));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);

        assertThat(saved.variants().get(0).image())
                .as("imageUrl on a no-color variant must be ignored by the backend")
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
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vimage-legacy-inconsistent");
        create.setName("VImage Legacy Inconsistent");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest yellowS = variant("Yellow / S", "Yellow", "S");
        yellowS.setImageUrl("https://cdn.example.com/yellow-canonical.jpg");
        VariantRequest yellowM = variant("Yellow / M", "Yellow", "M");
        VariantRequest yellowL = variant("Yellow / L", "Yellow", "L");
        create.setVariants(List.of(yellowS, yellowM, yellowL));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String idS = saved.variants().get(0).id();
        String idM = saved.variants().get(1).id();
        String idL = saved.variants().get(2).id();

        // Plant inconsistent imageUrls directly via JPA â€” simulating data that
        // landed in the DB through the WP migration importer (or any other
        // write path that bypasses AdminCatalogMutationService.applyVariants).
        ProductVariantEntity variantS = variantRepo.findById(idS).orElseThrow();
        variantS.setImageUrl("https://cdn.example.com/yellow-S-divergent.jpg");
        variantRepo.save(variantS);
        ProductVariantEntity variantM = variantRepo.findById(idM).orElseThrow();
        variantM.setImageUrl("https://cdn.example.com/yellow-M-divergent.jpg");
        variantRepo.save(variantM);
        ProductVariantEntity variantL = variantRepo.findById(idL).orElseThrow();
        variantL.setImageUrl("https://cdn.example.com/yellow-L-divergent.jpg");
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
                .isEqualTo("https://cdn.example.com/yellow-S-divergent.jpg");
        assertThat(reread.variants().get(1).image().url())
                .as("Yellow/M must read back the same color-scoped image as Yellow/S")
                .isEqualTo(scopedUrl);
        assertThat(reread.variants().get(2).image().url())
                .as("Yellow/L must read back the same color-scoped image as Yellow/S")
                .isEqualTo(scopedUrl);
    }

    @Test
    void readRepository_returnsNullImageForNoColorVariant() {
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vimage-no-color-read");
        create.setName("VImage No Color Read");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest sizeOnly = new VariantRequest();
        sizeOnly.setName("Size XL");
        sizeOnly.setIsAvailable(true);
        sizeOnly.setOptions(List.of(option("Size", "XL")));
        create.setVariants(List.of(sizeOnly));

        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        String variantId = saved.variants().get(0).id();

        // Plant a stray imageUrl on a no-color variant (e.g., from a legacy
        // import). Read path must mirror the write path and ignore it.
        ProductVariantEntity v = variantRepo.findById(variantId).orElseThrow();
        v.setImageUrl("https://cdn.example.com/stray-no-color.jpg");
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
        UpsertProductRequest create = new UpsertProductRequest();
        create.setSlug("vgallery-product-no-color");
        create.setName("VGallery Product No Color");
        create.setCategoryId(category.getId());
        create.setRetailPrice(new BigDecimal("1000000"));
        create.setPublishStatus(com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED);

        VariantRequest sizeOnly = new VariantRequest();
        sizeOnly.setName("Size M");
        sizeOnly.setIsAvailable(true);
        sizeOnly.setOptions(List.of(option("Size", "M")));
        sizeOnly.setGallery(List.of(galleryItem("https://cdn.example.com/size-m.jpg", "Size M", 0)));
        create.setVariants(List.of(sizeOnly));

        assertThatThrownBy(() -> mutationService.createProduct(create, DEV_ADMIN_ID))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Validation failed");
    }

    private VariantRequest variant(String name, String color, String size) {
        VariantRequest variant = new VariantRequest();
        variant.setName(name);
        variant.setIsAvailable(true);
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
}
