package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "categories")
@Getter
@Setter
public class CategoryEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "slug_en")
    private String slugEn;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private CategoryEntity parent;

    private String imageId;

    @Column(columnDefinition = "text")
    private String imageUrl;

    private String imageAlt;
    private Integer imageWidth;
    private Integer imageHeight;
    private String imageMimeType;

    private String iconId;

    @Column(columnDefinition = "text")
    private String iconUrl;

    private String iconAlt;
    private Integer iconWidth;
    private Integer iconHeight;
    private String iconMimeType;

    /**
     * Icon line đơn sắc cho menu header + bộ lọc "Danh mục sản phẩm" (render qua mask-image).
     * Khác với iconUrl (ảnh hero trang danh mục, WP ACF "image_left"). Xem V213.
     */
    @Column(columnDefinition = "text")
    private String menuIconUrl;

    @Column(columnDefinition = "text")
    private String contentBottom;

    @Column(columnDefinition = "text")
    private String contentBottomEn;

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

    private String nameEn;

    @Column(columnDefinition = "text")
    private String descriptionEn;

    private String seoTitleEn;

    @Column(columnDefinition = "text")
    private String seoDescriptionEn;

    @Column(nullable = false)
    private boolean isVisible;

    private Boolean showOnHomepage;
    private Integer sortOrder;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    private List<CategoryEntity> children = new ArrayList<>();

    /** Convenience accessor: parent id without forcing a full parent load downstream. */
    public String getParentId() {
        return parent == null ? null : parent.getId();
    }
}
