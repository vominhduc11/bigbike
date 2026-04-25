package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.ImageAssetRequest;
import com.bigbike.bigbike_backend.api.admin.dto.SeoMetaRequest;
import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdminMutationValidatorsTest {

    private static final String MINIO_BASE_URL = "http://localhost:9000/bigbike-media";

    @Test
    void imageUrlUnderConfiguredMinioBaseUrlIsAccepted() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe-may-honda.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors).isEmpty();
    }

    @Test
    void imageUrlOutsideConfiguredMinioBaseUrlIsRejected() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("https://cdn.bigbike.vn/uploads/xe-may-honda.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("image.url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void seoCanonicalUrlCanRemainPublicWhileOgImageIsWhitelisted() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setCanonicalUrl("https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/");
        seo.setOgImage(image("http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe-may-honda.jpg"));

        AdminMutationValidators.validateSeoMeta(seo, "seo", MINIO_BASE_URL, errors);

        assertThat(errors).isEmpty();
    }

    @Test
    void seoOgImageOutsideConfiguredMinioBaseUrlIsRejected() {
        List<ApiErrorDetail> errors = new ArrayList<>();
        SeoMetaRequest seo = new SeoMetaRequest();
        seo.setCanonicalUrl("https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/");
        seo.setOgImage(image("https://example.com/og.jpg"));

        AdminMutationValidators.validateSeoMeta(seo, "seo", MINIO_BASE_URL, errors);

        assertThat(errors)
                .hasSize(1)
                .first()
                .satisfies(error -> {
                    assertThat(error.field()).isEqualTo("seo.ogImage.url");
                    assertThat(error.code()).isEqualTo("INVALID_VALUE");
                });
    }

    @Test
    void mediaUrlMustRespectPathBoundary() {
        List<ApiErrorDetail> errors = new ArrayList<>();

        AdminMutationValidators.validateImageAsset(
                image("http://localhost:9000/bigbike-media-malicious/xe.jpg"),
                "image",
                MINIO_BASE_URL,
                errors
        );

        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).field()).isEqualTo("image.url");
    }

    private static ImageAssetRequest image(String url) {
        ImageAssetRequest request = new ImageAssetRequest();
        request.setUrl(url);
        request.setAlt("Alt");
        return request;
    }
}
