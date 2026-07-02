package com.bigbike.bigbike_backend.api.public_.dto;

import java.util.List;

public record SubmitReviewRequest(
        String authorName,
        Integer rating,
        String comment,
        List<String> photos,
        String website
) {}
