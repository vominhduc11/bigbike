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

@Entity
@Table(name = "product_gallery_images")
@Getter
@Setter
public class ProductGalleryImageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false)
    private int sortOrder;

    // Loại media của dòng gallery (V248): 'image' (mặc định) hoặc 'video'.
    @Column(name = "media_type", nullable = false, length = 8)
    private String mediaType = "image";

    // Video item (V248): URL + provider; cột image_* phía dưới dùng làm thumbnail/poster.
    @Column(name = "video_url", columnDefinition = "text")
    private String videoUrl;

    @Column(name = "video_provider", length = 16)
    private String videoProvider;

    private String imageId;

    @Column(columnDefinition = "text")
    private String imageUrl;

    private String imageAlt;
    @Column(name = "caption", length = 500)
    private String caption;
    private Integer imageWidth;
    private Integer imageHeight;
    private String imageMimeType;

}
