package com.bigbike.bigbike_backend.persistence.entity.video;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "home_videos")
public class HomeVideoEntity {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Id
    private String id;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "video_url", nullable = false, columnDefinition = "text")
    private String videoUrl;

    @Column(name = "youtube_id", length = 32)
    private String youtubeId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private String thumbnail;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getVideoUrl() { return videoUrl; }
    public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }

    public String getYoutubeId() { return youtubeId; }
    public void setYoutubeId(String youtubeId) { this.youtubeId = youtubeId; }

    public ImageAsset getThumbnail() { return parseImage(thumbnail); }
    public void setThumbnail(ImageAsset thumbnail) { this.thumbnail = writeImage(thumbnail); }

    public boolean isActive() { return isActive; }
    public void setActive(boolean isActive) { this.isActive = isActive; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    private static ImageAsset parseImage(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            JsonNode node = OBJECT_MAPPER.readTree(value);
            while (node.isTextual()) {
                node = OBJECT_MAPPER.readTree(node.textValue());
            }
            if (node.isNull() || node.isMissingNode()) return null;
            return OBJECT_MAPPER.treeToValue(node, ImageAsset.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Invalid home_video thumbnail JSON.", ex);
        }
    }

    private static String writeImage(ImageAsset image) {
        if (image == null) return null;
        try {
            return OBJECT_MAPPER.writeValueAsString(image);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize home_video thumbnail JSON.", ex);
        }
    }
}
