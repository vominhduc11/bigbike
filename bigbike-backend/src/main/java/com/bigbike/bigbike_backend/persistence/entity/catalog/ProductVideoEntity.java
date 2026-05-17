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
@Table(name = "product_videos")
@Getter
@Setter
public class ProductVideoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false)
    private int sortOrder;

    private String videoId;

    @Column(nullable = false, columnDefinition = "text")
    private String videoUrl;

    private String title;
    private String provider;

    private String thumbnailId;

    @Column(columnDefinition = "text")
    private String thumbnailUrl;

    private String thumbnailAlt;
    private Integer thumbnailWidth;
    private Integer thumbnailHeight;
    private String thumbnailMimeType;

}
