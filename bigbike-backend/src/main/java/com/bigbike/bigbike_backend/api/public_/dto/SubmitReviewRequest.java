package com.bigbike.bigbike_backend.api.public_.dto;

public record SubmitReviewRequest(
        String authorName,
        Integer rating,
        String comment
) {}
