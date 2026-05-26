package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.PageType;
import com.bigbike.bigbike_backend.persistence.converter.DescriptionBlocksConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.FetchType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "pages")
@Getter
@Setter
public class PageEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private PageEntity parent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PageType pageType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PublishStatus publishStatus;

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
    private Boolean seoNoIndex;

    @Column(name = "hero_image_url", columnDefinition = "text")
    private String heroImageUrl;

    @Column(name = "hero_image_alt")
    private String heroImageAlt;

    @Column(name = "hero_title")
    private String heroTitle;

    @Column(name = "hero_description", columnDefinition = "text")
    private String heroDescription;

    @Column(name = "hero_kicker")
    private String heroKicker;

    // English translations (V138) — nullable; storefront falls back to VI per PAGE_RULE_002
    private String titleEn;

    @Column(columnDefinition = "text")
    private String bodyEn;

    @Column(name = "hero_title_en")
    private String heroTitleEn;

    @Column(name = "hero_description_en", columnDefinition = "text")
    private String heroDescriptionEn;

    @Column(name = "hero_kicker_en")
    private String heroKickerEn;

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
