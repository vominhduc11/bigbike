package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "brands")
@Getter
@Setter
public class BrandEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String logoId;

    @Column(columnDefinition = "text")
    private String logoUrl;

    private String logoAlt;
    private Integer logoWidth;
    private Integer logoHeight;
    private String logoMimeType;

    @Column(columnDefinition = "text")
    private String bannerUrl;

    private String bannerAlt;

    @Column(columnDefinition = "text")
    private String mobileBannerUrl;

    private String mobileBannerAlt;

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

    @Column(columnDefinition = "text")
    private String descriptionEn;

    private String seoTitleEn;

    @Column(columnDefinition = "text")
    private String seoDescriptionEn;

    @Column(nullable = false)
    private boolean isVisible;

    @Column(name = "show_on_homepage", nullable = false)
    private boolean showOnHomepage = true;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;
}
