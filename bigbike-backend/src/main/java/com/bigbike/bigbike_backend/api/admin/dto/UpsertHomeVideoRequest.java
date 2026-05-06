package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UpsertHomeVideoRequest {

    @NotBlank(message = "title is required.")
    @Size(max = 255, message = "title is too long.")
    private String title;

    @NotBlank(message = "videoUrl is required.")
    @Size(max = 2048, message = "videoUrl is too long.")
    private String videoUrl;

    @NotNull(message = "sortOrder is required.")
    @Min(value = 0, message = "sortOrder must be >= 0.")
    private Integer sortOrder;

    @Valid
    private ImageAssetRequest thumbnail;

    private Boolean isActive;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getVideoUrl() { return videoUrl; }
    public void setVideoUrl(String videoUrl) { this.videoUrl = videoUrl; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public ImageAssetRequest getThumbnail() { return thumbnail; }
    public void setThumbnail(ImageAssetRequest thumbnail) { this.thumbnail = thumbnail; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
}
