package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.validation.constraints.NotNull;

public class ProductPublishRequest {

    @NotNull(message = "publishStatus is required.")
    private PublishStatus publishStatus;

    public PublishStatus getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(PublishStatus publishStatus) {
        this.publishStatus = publishStatus;
    }
}

