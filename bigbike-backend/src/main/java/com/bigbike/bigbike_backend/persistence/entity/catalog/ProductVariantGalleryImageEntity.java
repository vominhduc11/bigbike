package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "product_variant_gallery_images")
@Getter
@Setter
public class ProductVariantGalleryImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariantEntity variant;

    @Column(nullable = false)
    private int sortOrder;

    // Loại media của dòng gallery biến thể (V248): 'image' (mặc định) hoặc 'video'.
    @Column(name = "media_type", nullable = false, length = 8)
    private String mediaType = "image";

    @Column(name = "video_url", columnDefinition = "text")
    private String videoUrl;

    @Column(name = "video_provider", length = 16)
    private String videoProvider;

    @Column(name = "video_id", length = 36)
    private String videoId;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "title_en", length = 255)
    private String titleEn;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "description_en", columnDefinition = "text")
    private String descriptionEn;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "uploaded_on")
    private LocalDate uploadedOn;

    private String imageId;

    @Column(columnDefinition = "text")
    private String imageUrl;

    private String imageAlt;
    private Integer imageWidth;
    private Integer imageHeight;
    private String imageMimeType;

}
