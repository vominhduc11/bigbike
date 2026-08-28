package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Bắt lệch giữa hợp đồng API biên tập tay và các endpoint thật đang chạy.
 *
 * <p>{@code API_CONTRACT.md} ghi rõ: "If OpenAPI and controllers drift, controllers and current
 * tests are the verification source until docs are repaired." Trước đây không có gì phát hiện lệch
 * đó — hợp đồng chỉ được đối chiếu với chính nó. Test này so bộ endpoint springdoc sinh ra từ
 * controller đang chạy ({@code /v3/api-docs/live}) với bộ endpoint trong
 * {@code openapi/bigbike-openapi.json}.
 *
 * <p>Cơ chế bánh cóc (ratchet): phần lệch đã tồn tại được ghi vào
 * {@code openapi/contract-drift-baseline.json} nên build hiện tại vẫn xanh; test chỉ đỏ khi xuất
 * hiện endpoint MỚI chưa có trong hợp đồng, hoặc hợp đồng còn mô tả endpoint đã bị gỡ khỏi code.
 * Sửa lệch = cập nhật {@code bigbike-openapi.json} + {@code API_CONTRACT.md}, rồi xoá dòng tương
 * ứng khỏi baseline (baseline chỉ được co lại, không được phình ra).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OpenApiContractDriftTest {

    private static final String GENERATED_DOCS_PATH = "/v3/api-docs/live";
    private static final String CURATED_CONTRACT = "/openapi/bigbike-openapi.json";
    private static final String BASELINE = "/openapi/contract-drift-baseline.json";

    /** Chỉ soi bề mặt API nghiệp vụ; bỏ qua actuator, swagger, error page, websocket. */
    private static final String API_PREFIX = "/api/";

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    @Test
    void everyLiveEndpointIsDescribedByTheCuratedContract() throws Exception {
        Set<String> live = operationsOf(generatedContract());
        Set<String> curated = operationsOf(curatedContract());
        Set<String> allowed = baselineSection("undocumented");

        Set<String> undocumented = difference(live, curated);
        undocumented.removeAll(allowed);

        assertThat(undocumented)
                .as("""
                        Có endpoint đang chạy nhưng chưa được mô tả trong \
                        src/main/resources/openapi/bigbike-openapi.json.
                        Hãy bổ sung vào hợp đồng + docs/engineering/API_CONTRACT.md.
                        Nếu chủ đích để sau, thêm đúng dòng đó vào mục "undocumented" của \
                        src/test/resources/openapi/contract-drift-baseline.json.""")
                .isEmpty();
    }

    @Test
    void theCuratedContractDoesNotDescribeEndpointsThatNoLongerExist() throws Exception {
        Set<String> live = operationsOf(generatedContract());
        Set<String> curated = operationsOf(curatedContract());
        Set<String> allowed = baselineSection("stale");

        Set<String> stale = difference(curated, live);
        stale.removeAll(allowed);

        assertThat(stale)
                .as("""
                        Hợp đồng còn mô tả endpoint mà code không còn cung cấp — client tin theo \
                        hợp đồng sẽ gọi vào chỗ trống.
                        Hãy gỡ khỏi bigbike-openapi.json + API_CONTRACT.md, hoặc thêm vào mục \
                        "stale" của contract-drift-baseline.json kèm lý do.""")
                .isEmpty();
    }

    @Test
    void theGeneratedContractIsNotEmpty() throws Exception {
        // Chốt chặn cho chính test này: nếu springdoc bị tắt hoặc đổi đường dẫn, hai test trên sẽ
        // so tập rỗng với hợp đồng và âm thầm xanh.
        assertThat(operationsOf(generatedContract()))
                .as("springdoc phải sinh được đặc tả tại " + GENERATED_DOCS_PATH)
                .hasSizeGreaterThan(100);
    }

    @Test
    void catalogMediaSchemasExcludeRemovedMobileBannerFields() throws Exception {
        JsonNode schemas = curatedContract().path("components").path("schemas");

        assertThat(schemas.path("CategoryResponse").path("properties").has("mobileBannerImage")).isFalse();
        assertThat(schemas.path("CategoryResponse").path("properties").has("bannerImage")).isTrue();
        assertThat(schemas.path("UpsertCategoryRequest").path("properties").has("mobileBanner")).isFalse();
        assertThat(schemas.path("UpsertCategoryRequest").path("properties").has("banner")).isTrue();
        assertThat(schemas.path("UpsertBrandRequest").path("properties").has("mobileBanner")).isFalse();
        assertThat(schemas.path("UpsertBrandRequest").path("properties").has("logo")).isTrue();
        assertThat(schemas.path("UpsertBrandRequest").path("properties").has("banner")).isTrue();
    }

    @Test
    void liveCatalogSchemasExcludeRemovedMobileBannerFields() throws Exception {
        JsonNode schemas = generatedContract().path("components").path("schemas");
        Set<String> schemasWithRemovedFields = new LinkedHashSet<>();
        schemas.fields().forEachRemaining(entry -> {
            JsonNode properties = entry.getValue().path("properties");
            if (properties.has("mobileBanner") || properties.has("mobileBannerImage")) {
                schemasWithRemovedFields.add(entry.getKey());
            }
        });

        assertThat(schemasWithRemovedFields).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private JsonNode generatedContract() throws Exception {
        String body = mockMvc.perform(get(GENERATED_DOCS_PATH))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return JSON.readTree(body);
    }

    private JsonNode curatedContract() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(CURATED_CONTRACT)) {
            assertThat(input).as(CURATED_CONTRACT + " phải nằm trên classpath").isNotNull();
            return JSON.readTree(input);
        }
    }

    private Set<String> baselineSection(String section) throws Exception {
        try (InputStream input = getClass().getResourceAsStream(BASELINE)) {
            assertThat(input).as(BASELINE + " phải nằm trên classpath").isNotNull();
            JsonNode entries = JSON.readTree(input).path(section);
            Set<String> result = new LinkedHashSet<>();
            entries.forEach(entry -> result.add(entry.asText()));
            return result;
        }
    }

    /**
     * Rút bộ "METHOD /đường/dẫn" từ một tài liệu OpenAPI. Tên biến đường dẫn được chuẩn hoá về
     * {@code {}} vì hợp đồng và code đặt tên khác nhau ({@code {id}} với {@code {productId}}) mà
     * vẫn là cùng một endpoint.
     */
    private static Set<String> operationsOf(JsonNode document) {
        Set<String> operations = new TreeSet<>();
        JsonNode paths = document.path("paths");
        Iterator<Map.Entry<String, JsonNode>> pathEntries = paths.fields();
        while (pathEntries.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = pathEntries.next();
            String path = pathEntry.getKey();
            if (!path.startsWith(API_PREFIX)) {
                continue;
            }
            String normalizedPath = path.replaceAll("\\{[^}]*}", "{}");
            pathEntry.getValue().fieldNames().forEachRemaining(method -> {
                if (isHttpMethod(method)) {
                    operations.add(method.toUpperCase() + " " + normalizedPath);
                }
            });
        }
        return operations;
    }

    private static boolean isHttpMethod(String field) {
        return switch (field) {
            case "get", "put", "post", "delete", "patch", "head", "options", "trace" -> true;
            default -> false;
        };
    }

    private static Set<String> difference(Set<String> left, Set<String> right) {
        return left.stream()
                .filter(entry -> !right.contains(entry))
                .collect(Collectors.toCollection(TreeSet::new));
    }
}
