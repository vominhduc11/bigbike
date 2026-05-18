package com.bigbike.bigbike_backend.api.admin.dto.newsletter;

import java.time.Instant;
import java.util.UUID;

/** Một dòng trong danh sách email đăng ký nhận tin (trang quản trị). */
public record AdminNewsletterSubscriberItem(
        UUID id,
        String email,
        Instant createdAt
) {
}
