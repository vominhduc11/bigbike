package com.bigbike.bigbike_backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Mô tả đầu trang cho đặc tả OpenAPI mà springdoc sinh ra từ controller đang chạy.
 *
 * <p>Hợp đồng chuẩn của dự án vẫn là file biên tập tay
 * {@code src/main/resources/openapi/bigbike-openapi.json} (phục vụ ở {@code /v3/api-docs} bởi
 * {@code OpenApiStaticController}). Bản sinh tự động nằm ở {@code /v3/api-docs/live} và có hai
 * việc: soi lệch giữa hợp đồng và code thật ({@code OpenApiContractDriftTest}), và cho Swagger UI
 * một tài liệu bấm thử được.
 *
 * <p>Bốn tên security scheme dưới đây trùng đúng tên trong hợp đồng biên tập tay để hai bản đọc
 * cùng một ngôn ngữ; đổi tên ở đây phải đổi cả trong {@code bigbike-openapi.json}.
 *
 * <p>Bean chỉ tồn tại khi tài liệu API được bật (mặc định tắt — xem
 * {@code springdoc.api-docs.enabled} trong {@code application.properties}).
 */
@Configuration
@ConditionalOnProperty(name = "springdoc.api-docs.enabled", havingValue = "true")
public class OpenApiConfig {

    @Bean
    OpenAPI bigbikeOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("BigBike Backend API (live)")
                        .version("1.0.0")
                        .description("""
                                Bản sinh tự động từ controller đang chạy — dùng để đối chiếu với hợp đồng \
                                biên tập tay tại /v3/api-docs. Mọi phản hồi đi trong bao ApiDataResponse<T> \
                                hoặc ApiListResponse<T>."""))
                .components(new Components()
                        .addSecuritySchemes("AdminBearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Admin JWT access token. Obtain via POST /api/v1/auth/login."
                                        + " Header: Authorization: Bearer <accessToken>"))
                        .addSecuritySchemes("CustomerSession", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE)
                                .name("bb_session")
                                .description("Customer session cookie. Set automatically after"
                                        + " POST /api/v1/customer/auth/login."))
                        .addSecuritySchemes("CsrfHeader", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-CSRF-Token")
                                .description("CSRF token required for all cart/checkout mutations."
                                        + " Value must match the bb_csrf cookie set by the server."))
                        .addSecuritySchemes("InternalToken", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-Internal-Token")
                                .description("Shared service token required by internal redirect"
                                        + " endpoints in staging and production.")));
    }
}
