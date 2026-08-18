package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.converter.DescriptionBlocksConverter;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import jakarta.persistence.Version;

@Entity
@Table(name = "articles")
@Getter
@Setter
public class ArticleEntity {

    @Id
    private String id;

    @Version
    private Integer version;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "slug_en")
    private String slugEn;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String excerpt;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    /** Optional bilingual article author (ARTICLE_RULE_007). */
    @Column(name = "author_name", length = 255)
    private String authorName;

    private String coverImageId;

    @Column(columnDefinition = "text")
    private String coverImageUrl;

    private String coverImageAlt;
    private Integer coverImageWidth;
    private Integer coverImageHeight;
    private String coverImageMimeType;

    @Column(columnDefinition = "text")
    private String productImageUrl;

    private String productImageAlt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PublishStatus publishStatus;

    /** Featured article flag (V222) — drives the public {@code ?featured=true} filter. */
    @Column(nullable = false)
    private boolean featured;

    /** Homepage Experience carousel pick flag (V272) — drives the public {@code ?homeExperience=true} filter. */
    @Column(name = "home_experience", nullable = false)
    private boolean homeExperience;

    private String seoTitle;

    @Column(columnDefinition = "text")
    private String seoDescription;

    @Column(columnDefinition = "text")
    private String seoCanonicalUrl;

    private String seoOgImageId;

    @Column(columnDefinition = "text")
    private String seoOgImageUrl;

    private String seoOgImageAlt;
    private Integer seoOgImageWidth;
    private Integer seoOgImageHeight;
    private String seoOgImageMimeType;

    /**
     * Cờ "cho Google hiển thị" bản tiếng Việt (V222) — web phát meta noindex khi true.
     * Từ V371 cờ này chỉ còn áp cho bản VI; bản EN dùng {@link #seoNoIndexEn}.
     * BUSINESS_RULES `SEO_RULE_001`.
     */
    @Column(name = "seo_no_index", nullable = false, columnDefinition = "boolean default false")
    private boolean seoNoIndex;

    /** Cờ bản tiếng Anh (V371) — ghi đè thủ công, còn phải qua ngưỡng `SEO_RULE_002`. */
    @Column(name = "seo_no_index_en", nullable = false, columnDefinition = "boolean default false")
    private boolean seoNoIndexEn;

    // English translations (V138) — nullable; storefront falls back to VI per ARTICLE_RULE_002
    private String titleEn;

    @Column(columnDefinition = "text")
    private String excerptEn;

    @Column(columnDefinition = "text")
    private String bodyEn;

    @Column(name = "author_name_en", length = 255)
    private String authorNameEn;

    private String seoTitleEn;

    @Column(columnDefinition = "text")
    private String seoDescriptionEn;

    private Instant publishedAt;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Convert(converter = DescriptionBlocksConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body_blocks", columnDefinition = "jsonb")
    private List<DescriptionBlock> bodyBlocks;

}
