package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressVariationMapper.MappedVariation;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Verifies the rtwpvg_images decoder against payloads taken verbatim from
 * the WP SQL dump (Variation Images Gallery for WooCommerce plugin).
 */
class WordPressVariationMapperRtwpvgTest {

    private final WordPressVariationMapper mapper = new WordPressVariationMapper();

    @Test
    void decodes_attachment_ids_in_order() {
        // From bigbike_vn__2026_04_17/sqldump.sql:
        //   (136802, 8755, 'rtwpvg_images', 'a:4:{i:0;i:8738;i:1;i:8737;i:2;i:8736;i:3;i:8734;}')
        WpPost post = makePost(8755L, 1000L);
        List<WpPostMeta> metas = List.of(
                new WpPostMeta(136802L, 8755L, "rtwpvg_images",
                        "a:4:{i:0;i:8738;i:1;i:8737;i:2;i:8736;i:3;i:8734;}")
        );

        MappedVariation mv = mapper.map(post, metas);

        assertThat(mv.galleryAttachmentIds()).containsExactly(8738L, 8737L, 8736L, 8734L);
    }

    @Test
    void empty_when_meta_missing() {
        WpPost post = makePost(9999L, 1000L);
        MappedVariation mv = mapper.map(post, List.of());

        assertThat(mv.galleryAttachmentIds()).isEmpty();
    }

    @Test
    void empty_when_meta_blank() {
        WpPost post = makePost(9999L, 1000L);
        List<WpPostMeta> metas = List.of(
                new WpPostMeta(1L, 9999L, "rtwpvg_images", "")
        );

        MappedVariation mv = mapper.map(post, metas);

        assertThat(mv.galleryAttachmentIds()).isEmpty();
    }

    @Test
    void survives_garbled_payload_with_warning() {
        WpPost post = makePost(9999L, 1000L);
        List<WpPostMeta> metas = List.of(
                new WpPostMeta(1L, 9999L, "rtwpvg_images", "this is not php-serialized")
        );

        MappedVariation mv = mapper.map(post, metas);

        assertThat(mv.galleryAttachmentIds()).isEmpty();
        assertThat(mv.warnings()).isNotEmpty();
    }

    private WpPost makePost(long id, long parentId) {
        return new WpPost(
                id, 0L,
                LocalDateTime.now(), LocalDateTime.now(),
                "", "", "",
                "publish", "closed", "",
                "product_variation",
                parentId, 0, "", "", 0L
        );
    }
}
