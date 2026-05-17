package com.bigbike.bigbike_backend.persistence.entity.media;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media")
@Getter
@Setter
public class MediaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "legacy_id", unique = true)
    private Long legacyId;

    @Column(name = "file_path", nullable = false, columnDefinition = "text")
    private String filePath;

    @Column(name = "public_url", columnDefinition = "text")
    private String publicUrl;

    @Column(name = "storage_provider", nullable = false, length = 50)
    private String storageProvider;

    @Column(length = 255)
    private String bucket;

    @Column(name = "mime_type", length = 127)
    private String mimeType;

    @Column(name = "file_size")
    private Long fileSize;

    private Integer width;

    private Integer height;

    @Column(name = "alt_text", columnDefinition = "text")
    private String altText;

    @Column(columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String caption;

    @Column(columnDefinition = "text")
    private String metadata;

    @Column(columnDefinition = "text")
    private String sizes;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "folder_id")
    private UUID folderId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
