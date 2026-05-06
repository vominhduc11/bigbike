package com.bigbike.bigbike_backend.persistence.entity.slider;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "sliders",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_sliders_location_sort_order", columnNames = {"location", "sort_order"})
        }
)
public class SliderEntity {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Id
    private String id;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(nullable = false)
    private String location;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "desktop_image", columnDefinition = "json")
    private String desktopImageJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "mobile_image", columnDefinition = "json")
    private String mobileImageJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private ProductEntity product;

    @Column(name = "external_link", columnDefinition = "text")
    private String externalLink;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public ImageAsset getDesktopImage() {
        return parseImage(desktopImageJson);
    }

    public void setDesktopImage(ImageAsset desktopImage) {
        this.desktopImageJson = writeImage(desktopImage);
    }

    public ImageAsset getMobileImage() {
        return parseImage(mobileImageJson);
    }

    public void setMobileImage(ImageAsset mobileImage) {
        this.mobileImageJson = writeImage(mobileImage);
    }

    public ProductEntity getProduct() {
        return product;
    }

    public void setProduct(ProductEntity product) {
        this.product = product;
    }

    public String getExternalLink() {
        return externalLink;
    }

    public void setExternalLink(String externalLink) {
        this.externalLink = externalLink;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean isActive) {
        this.isActive = isActive;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    private static ImageAsset parseImage(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(value);
            // Unwrap JSON strings regardless of encoding depth (H2 may double-encode on UPDATE)
            while (node.isTextual()) {
                node = OBJECT_MAPPER.readTree(node.textValue());
            }
            if (node.isNull() || node.isMissingNode()) {
                return null;
            }
            return OBJECT_MAPPER.treeToValue(node, ImageAsset.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Invalid slider image JSON.", ex);
        }
    }

    private static String writeImage(ImageAsset image) {
        if (image == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(image);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize slider image JSON.", ex);
        }
    }
}
