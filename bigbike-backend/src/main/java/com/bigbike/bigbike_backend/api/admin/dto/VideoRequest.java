package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;

public class VideoRequest {

    @Size(max = 2048, message = "Video URL is too long.")
    private String url;

    @Size(max = 255, message = "Video title is too long.")
    private String title;

    @Size(max = 50, message = "Video provider is too long.")
    private String provider;

    @Size(max = 2048, message = "Thumbnail URL is too long.")
    private String thumbnailUrl;

    private Integer sortOrder;

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
