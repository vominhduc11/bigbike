package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class Phase1KOpenApiContractTest {

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

    // ── Helper ────────────────────────────────────────────────────────────────

    private String fetchApiDocs() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getContentAsString();
    }

    private JsonNode parameterNamed(JsonNode parameters, String name) {
        for (JsonNode parameter : parameters) {
            if (name.equals(parameter.path("name").asText())) {
                return parameter;
            }
        }
        return parameters.path(-1);
    }

    private List<String> textValues(JsonNode arrayNode) {
        return StreamSupport.stream(arrayNode.spliterator(), false)
                .map(JsonNode::asText)
                .toList();
    }

    private List<String> fieldNames(JsonNode objectNode) {
        List<String> names = new ArrayList<>();
        objectNode.fieldNames().forEachRemaining(names::add);
        return names;
    }

    // ── 1. Endpoint availability ──────────────────────────────────────────────

    @Test
    void openApiDocsEndpoint_availableInTestOrDev() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }

    // ── 2. Security schemes ───────────────────────────────────────────────────

    @Test
    void openApi_containsAdminBearerSecurityScheme() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("AdminBearerAuth");
    }

    @Test
    void openApi_containsCustomerSessionCookieScheme() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("CustomerSession");
    }

    @Test
    void openApi_containsCsrfHeader() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("X-CSRF-Token");
    }

    // ── 3. Endpoint coverage ──────────────────────────────────────────────────

    @Test
    void openApi_containsCartEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/cart");
    }

    @Test
    void openApi_containsCheckoutEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/checkout");
    }

    @Test
    void openApi_containsAdminOrderEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/orders");
    }

    @Test
    void openApi_redirectContractSupportsPermanent301AndTerminal410() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");
        JsonNode listParameters = paths.path("/api/v1/admin/redirects").path("get").path("parameters");
        JsonNode schemas = document.path("components").path("schemas");

        assertThat(listParameters.findValuesAsText("name"))
                .containsExactly("page", "size", "q", "enabled");
        assertThat(parameterNamed(listParameters, "q").path("schema").path("maxLength").asInt())
                .isEqualTo(200);
        assertThat(parameterNamed(listParameters, "enabled").path("schema").path("type").asText())
                .isEqualTo("boolean");

        assertThat(fieldNames(schemas.path("CreateRedirectRequest").path("properties")))
                .containsExactly("sourcePattern", "targetUrl", "statusCode", "enabled")
                .doesNotContain("redirectType", "notes", "legacyId");
        assertThat(fieldNames(schemas.path("UpdateRedirectRequest").path("properties")))
                .containsExactly("sourcePattern", "targetUrl", "statusCode", "enabled")
                .doesNotContain("redirectType", "notes", "legacyId");
        assertThat(fieldNames(schemas.path("AdminRedirectResponse").path("properties")))
                .contains("statusCode")
                .doesNotContain("redirectType", "notes", "legacyId");
        assertThat(textValues(schemas.path("CreateRedirectRequest").path("properties")
                .path("statusCode").path("enum"))).containsExactly("301", "410");

        assertThat(fieldNames(paths)).contains(
                "/api/internal/redirect",
                "/api/internal/redirects/active",
                "/api/internal/redirects/hit/{redirectId}");
    }

    @Test
    void openApi_adminOrderContractMatchesControllerFiltersAndAuditEndpoint() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");
        JsonNode listParameters = paths.path("/api/v1/admin/orders").path("get").path("parameters");
        JsonNode exportOperation = paths.path("/api/v1/admin/reports/orders/export").path("get");
        JsonNode exportParameters = exportOperation.path("parameters");

        assertThat(listParameters.findValuesAsText("name"))
                .contains("page", "size", "status", "q", "from", "to", "sort");
        assertThat(parameterNamed(listParameters, "from").path("description").asText())
                .contains("Asia/Ho_Chi_Minh");
        assertThat(parameterNamed(listParameters, "to").path("description").asText())
                .contains("Asia/Ho_Chi_Minh");
        assertThat(paths.path("/api/v1/admin/orders").path("get").path("responses").has("400")).isTrue();

        assertThat(exportParameters.findValuesAsText("name"))
                .containsExactly("q", "status", "from", "to");
        assertThat(parameterNamed(exportParameters, "q").path("description").asText())
                .doesNotContain("customer name");
        assertThat(textValues(parameterNamed(exportParameters, "status").path("schema").path("enum")))
                .containsExactly("PENDING", "PROCESSING", "COMPLETED", "CANCELLED");
        assertThat(parameterNamed(exportParameters, "from").path("schema").path("format").asText())
                .isEqualTo("date");
        assertThat(parameterNamed(exportParameters, "from").path("description").asText())
                .contains("Asia/Ho_Chi_Minh");
        assertThat(parameterNamed(exportParameters, "to").path("schema").path("format").asText())
                .isEqualTo("date");
        assertThat(exportOperation.path("responses").path("200").path("headers")
                .path("X-Export-Uncapped").path("schema").path("enum").get(0).asText())
                .isEqualTo("true");
        assertThat(exportOperation.path("responses").path("200").path("content")
                .path("text/csv").path("schema").path("format").asText())
                .isEqualTo("binary");
        assertThat(exportOperation.path("responses").has("400")).isTrue();
        assertThat(exportOperation.path("responses").has("403")).isTrue();

        assertThat(paths.has("/api/v1/admin/orders/{orderId}/allowed-transitions")).isTrue();
        assertThat(paths.has("/api/v1/admin/orders/{orderId}/audit")).isTrue();
        assertThat(paths.path("/api/v1/admin/orders/{orderId}/audit")
                .path("get").path("parameters").get(0).path("schema").path("format").asText())
                .isEqualTo("uuid");

        JsonNode paymentStatus = document.path("components").path("schemas")
                .path("OrderPaymentResponse").path("properties").path("status");
        assertThat(textValues(paymentStatus.path("enum")))
                .containsExactly("PENDING", "SUCCEEDED", "FAILED", "CANCELLED");
        assertThat(paths.path("/api/v1/admin/orders/{orderId}").path("get").path("responses")
                .path("200").path("content").path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminOrderDetailDataResponse");
        assertThat(paths.path("/api/v1/admin/orders").path("get").path("responses")
                .path("200").path("content").path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminOrderListResponse");
        assertThat(paths.path("/api/v1/admin/orders/{orderId}/status").path("patch").path("responses")
                .path("200").path("content").path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminOrderDetailDataResponse");
        assertThat(paths.path("/api/v1/admin/orders/{orderId}/allowed-transitions").path("get")
                .path("responses").path("200").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminOrderAllowedTransitionsDataResponse");
        assertThat(paths.path("/api/v1/admin/orders/{orderId}/audit").path("get").path("responses")
                .path("200").path("content").path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminOrderAuditTrailDataResponse");
        assertThat(document.path("components").path("schemas").path("OrderPaymentResponse")
                .path("properties").path("paymentMethod").path("nullable").asBoolean()).isTrue();
    }

    @Test
    void openApi_adminProductContractCoversLifecycleImportExportAndCurrentFields() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");

        assertThat(fieldNames(paths)).contains(
                "/api/v1/admin/products",
                "/api/v1/admin/products/{id}",
                "/api/v1/admin/products/preview",
                "/api/v1/admin/products/{id}/publish",
                "/api/v1/admin/products/{id}/restore",
                "/api/v1/admin/products/{id}/permanent",
                "/api/v1/admin/products/homepage-blocks",
                "/api/v1/admin/products/export.csv",
                "/api/v1/admin/products/import/validate",
                "/api/v1/admin/products/import/commit",
                "/api/v1/admin/products/import/export/{id}");

        JsonNode listParameters = paths.path("/api/v1/admin/products").path("get").path("parameters");
        assertThat(listParameters.findValuesAsText("name"))
                .contains("page", "size", "pageSize", "sort", "q", "search",
                        "publishStatus", "stockState", "brandId", "categoryId",
                        "filter_gender", "homepageBlock", "lang");
        assertThat(textValues(parameterNamed(listParameters, "filter_gender").path("schema").path("enum")))
                .containsExactly("Nam", "Nữ");

        JsonNode preview = paths.path("/api/v1/admin/products/preview").path("post");
        assertThat(textValues(parameterNamed(preview.path("parameters"), "lang").path("schema").path("enum")))
                .containsExactly("vi", "en");
        assertThat(preview.path("responses").path("200").path("content")
                .path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/ProductDataResponse");

        assertThat(paths.path("/api/v1/admin/products/{id}/publish").path("patch")
                .path("requestBody").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/ProductPublishRequest");
        assertThat(paths.path("/api/v1/admin/products/{id}/permanent").path("delete")
                .path("responses").has("204")).isTrue();
        JsonNode productExport = paths.path("/api/v1/admin/products/export.csv").path("get");
        JsonNode productExportParameters = productExport.path("parameters");
        assertThat(productExportParameters.findValuesAsText("name")).contains(
                "scope", "q", "categoryId", "brandId", "publishStatus", "stockState",
                "includeDraft", "includeTrash", "ids", "preset", "columns", "columnGroups");
        assertThat(textValues(parameterNamed(productExportParameters, "scope").path("schema").path("enum")))
                .containsExactly("FILTERED", "SELECTED", "ALL");
        assertThat(parameterNamed(productExportParameters, "scope").path("schema").path("default").asText())
                .isEqualTo("FILTERED");
        assertThat(textValues(parameterNamed(productExportParameters, "preset").path("schema").path("enum")))
                .containsExactly("PRICING", "CONTENT_SEO", "MEDIA", "FULL");
        assertThat(parameterNamed(productExportParameters, "ids").path("description").asText())
                .contains("200");
        assertThat(productExport.path("responses").has("400")).isTrue();
        assertThat(productExport.path("responses").path("200").path("content").path("text/csv")
                .path("schema").path("format").asText()).isEqualTo("binary");
        assertThat(paths.path("/api/v1/admin/products/import/validate").path("post")
                .path("requestBody").path("content").has("multipart/form-data")).isTrue();
        assertThat(paths.path("/api/v1/admin/products/import/commit").path("post")
                .path("requestBody").path("content").path("multipart/form-data")
                .path("schema").path("properties").has("skipRowKeys")).isTrue();

        JsonNode schemas = document.path("components").path("schemas");
        JsonNode upsertProperties = schemas.path("UpsertProductRequest").path("properties");
        assertThat(fieldNames(upsertProperties)).contains(
                "sku", "slug", "name", "brandId", "categoryIds", "image",
                "retailPrice", "salePrice", "available", "publishStatus", "genders", "gender",
                "seo", "translations", "gallery", "videos", "variants",
                "descriptionBlocks", "suitabilitySection", "sizeGuideSection", "discontinued");
        assertThat(upsertProperties.has("contentBottom")).isFalse();

        JsonNode productProperties = schemas.path("ProductResponse").path("properties");
        assertThat(fieldNames(productProperties)).contains(
                "slugEn", "brand", "categories", "price", "stockState", "available",
                "publishStatus", "discontinued", "gallery", "videos", "variants", "seo", "translations");
        assertThat(productProperties.has("genders")).isTrue();
        assertThat(productProperties.has("gender")).isFalse();
        assertThat(productProperties.has("contentBottom")).isFalse();
    }

    @Test
    void openApi_publicProductGenderFilterIsSingleValueWithLegacyRepeatedCompatibility() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode parameters = document.path("paths").path("/api/v1/products").path("get")
                .path("parameters");
        JsonNode gender = parameterNamed(parameters, "filter_gender");

        assertThat(gender.path("schema").path("type").asText()).isEqualTo("string");
        assertThat(textValues(gender.path("schema").path("enum")))
                .containsExactly("Nam", "Nữ");
    }

    @Test
    void openApi_reviewContractMatchesLifecyclePrivacyAndBulkShapes() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");
        JsonNode schemas = document.path("components").path("schemas");

        JsonNode publicReviews = paths.path("/api/v1/products/{productId}/reviews");
        assertThat(publicReviews.path("post").path("responses").path("201")
                .path("content").path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/SubmitReviewSuccessDataResponse");
        assertThat(paths.has("/api/v1/products/{productId}/reviews/photos")).isTrue();
        assertThat(textValues(schemas.path("ReviewRating").path("enum")))
                .containsExactly("1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5");
        assertThat(textValues(schemas.path("SubmitReviewRequest").path("required")))
                .containsExactly("rating");
        assertThat(schemas.path("SubmitReviewRequest").path("properties")
                .path("photos").path("items").path("pattern").asText())
                .isEqualTo("^/media/reviews/");
        assertThat(schemas.path("PublicProductReviewsResponse").path("properties")
                .path("ratingBreakdown").path("minProperties").asInt()).isEqualTo(9);

        JsonNode listItem = schemas.path("AdminReviewListItem");
        assertThat(listItem.path("properties").has("authorEmail")).isFalse();
        assertThat(listItem.path("properties").has("version")).isTrue();
        assertThat(schemas.path("AdminReview").path("allOf").get(1)
                .path("properties").has("authorEmail")).isTrue();

        JsonNode patch = paths.path("/api/v1/admin/reviews/{id}/status").path("patch");
        assertThat(patch.path("responses").path("200").path("content")
                .path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminReviewMutationDataResponse");
        assertThat(schemas.path("AdminReviewMutationDataResponse").path("properties")
                .path("data").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminReviewListItem");
        assertThat(textValues(schemas.path("UpdateReviewStatusRequest").path("required")))
                .containsExactly("status", "expectedVersion");

        JsonNode deleteOperation = paths.path("/api/v1/admin/reviews/{id}").path("delete");
        JsonNode expectedVersion = parameterNamed(deleteOperation.path("parameters"), "expectedVersion");
        assertThat(expectedVersion.path("required").asBoolean()).isTrue();
        assertThat(deleteOperation.path("responses").has("409")).isTrue();
        assertThat(schemas.path("BulkReviewStatusRequest").path("properties")
                .path("items").path("items").path("$ref").asText())
                .isEqualTo("#/components/schemas/VersionedReviewItem");
        assertThat(textValues(schemas.path("AdminReviewBulkSkipped").path("properties")
                .path("reason").path("enum")))
                .containsExactly(
                        "DUPLICATE_ID",
                        "NOT_FOUND",
                        "VERSION_CONFLICT",
                        "INVALID_TRANSITION",
                        "NOT_IN_TRASH",
                        "NO_CHANGE");
    }

    @Test
    void openApi_containsAdminCustomerMediaEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/customers");
        assertThat(body).contains("/api/v1/admin/media");
        assertThat(body).contains("/api/v1/home-videos");
    }

    @Test
    void openApi_adminMediaContractCoversLibraryLifecycleAndFolderManagement() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");

        assertThat(fieldNames(paths)).contains(
                "/api/v1/admin/media",
                "/api/v1/admin/media/stats",
                "/api/v1/admin/media/tags",
                "/api/v1/admin/media/bulk-move",
                "/api/v1/admin/media/bulk-delete",
                "/api/v1/admin/media/bulk-restore",
                "/api/v1/admin/media/bulk-hard-delete",
                "/api/v1/admin/media/{mediaId}",
                "/api/v1/admin/media/{mediaId}/references",
                "/api/v1/admin/media/{mediaId}/download",
                "/api/v1/admin/media/{mediaId}/restore",
                "/api/v1/admin/media-folders",
                "/api/v1/admin/media-folders/{id}");

        JsonNode listParameters = paths.path("/api/v1/admin/media").path("get").path("parameters");
        assertThat(listParameters.findValuesAsText("name")).containsExactly(
                "page", "size", "q", "mimeType", "status", "storageProvider",
                "usageFilter", "uploadedFrom", "uploadedTo", "minSize", "maxSize",
                "minWidth", "minHeight", "sort", "dir", "folderFilter", "tag");
        assertThat(parameterNamed(listParameters, "size").path("schema").path("maximum").asInt())
                .isEqualTo(100);

        JsonNode uploadFile = paths.path("/api/v1/admin/media").path("post")
                .path("requestBody").path("content").path("multipart/form-data")
                .path("schema").path("properties").path("file");
        assertThat(uploadFile.path("format").asText()).isEqualTo("binary");
        assertThat(uploadFile.path("description").asText()).contains("200 MB", "MP4");

        JsonNode updateProperties = paths.path("/api/v1/admin/media/{mediaId}").path("patch")
                .path("requestBody").path("content").path("application/json")
                .path("schema").path("properties");
        assertThat(fieldNames(updateProperties))
                .containsExactly("title", "altText", "folderId", "clearFolder", "tags");
        assertThat(parameterNamed(paths.path("/api/v1/admin/media/{mediaId}").path("delete")
                .path("parameters"), "permanent").path("schema").path("default").asBoolean())
                .isFalse();

        JsonNode folderProperties = paths.path("/api/v1/admin/media-folders").path("post")
                .path("requestBody").path("content").path("application/json")
                .path("schema").path("properties");
        assertThat(fieldNames(folderProperties)).containsExactly("name", "slug", "description");
        assertThat(folderProperties.path("name").path("maxLength").asInt()).isEqualTo(120);
        assertThat(folderProperties.path("slug").path("maxLength").asInt()).isEqualTo(160);
        assertThat(folderProperties.path("description").path("maxLength").asInt()).isEqualTo(2000);
    }

    @Test
    void openApi_adminCustomerContractMatchesFiltersMutationsAndResponses() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        JsonNode paths = document.path("paths");
        JsonNode schemas = document.path("components").path("schemas");

        assertThat(fieldNames(paths)).contains(
                "/api/v1/admin/customers",
                "/api/v1/admin/customers/summary",
                "/api/v1/admin/customers/{customerId}",
                "/api/v1/admin/customers/{customerId}/status",
                "/api/v1/admin/customers/{customerId}/avatar");

        JsonNode list = paths.path("/api/v1/admin/customers").path("get");
        JsonNode listParameters = list.path("parameters");
        assertThat(listParameters.findValuesAsText("name"))
                .containsExactly("page", "size", "q", "status", "synthetic", "emailVerified");
        assertThat(list.path("responses").has("400")).isTrue();
        assertThat(list.path("responses").has("403")).isTrue();
        assertThat(list.path("responses").path("200").path("content")
                .path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminCustomerListResponse");

        JsonNode customerExport =
                paths.path("/api/v1/admin/reports/customers/export").path("get");
        assertThat(customerExport.path("parameters").findValuesAsText("name"))
                .containsExactly("q", "status", "synthetic", "emailVerified");
        assertThat(customerExport.path("responses").path("200").path("headers")
                .path("X-Export-Uncapped").path("schema").path("enum").get(0).asText())
                .isEqualTo("true");
        assertThat(customerExport.path("responses").path("200").path("content")
                .path("text/csv").path("schema").path("format").asText())
                .isEqualTo("binary");
        assertThat(customerExport.path("responses").has("400")).isTrue();
        assertThat(customerExport.path("responses").has("403")).isTrue();

        assertThat(textValues(schemas.path("CustomerStatus").path("enum")))
                .containsExactly("ACTIVE", "DISABLED", "PENDING", "BLOCKED");
        assertThat(paths.path("/api/v1/admin/customers/summary").path("get")
                .path("responses").path("200").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminCustomerSummaryDataResponse");
        assertThat(schemas.path("AdminCustomerSummaryResponse").path("properties")
                .path("newLast30Days").path("description").asText())
                .contains("Non-synthetic");
        assertThat(schemas.path("AdminCustomerSummaryResponse").path("properties")
                .path("active").path("description").asText())
                .contains("Non-synthetic");
        assertThat(paths.path("/api/v1/admin/customers/{customerId}").path("get")
                .path("responses").path("200").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminCustomerDetailDataResponse");

        JsonNode profileRequest = schemas.path("UpdateCustomerRequest").path("properties");
        assertThat(fieldNames(profileRequest)).containsExactly("displayName", "phone");
        assertThat(profileRequest.has("email")).isFalse();
        assertThat(profileRequest.has("firstName")).isFalse();
        assertThat(profileRequest.has("lastName")).isFalse();
        assertThat(schemas.path("UpdateCustomerRequest").path("additionalProperties").asBoolean()).isFalse();
        assertThat(paths.path("/api/v1/admin/customers/{customerId}").path("patch")
                .path("requestBody").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/UpdateCustomerRequest");

        assertThat(paths.path("/api/v1/admin/customers/{customerId}/status").path("patch")
                .path("requestBody").path("content").path("application/json")
                .path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/UpdateCustomerStatusRequest");
        assertThat(schemas.path("UpdateCustomerStatusRequest").path("properties")
                .path("reason").path("maxLength").asInt()).isEqualTo(1000);
        assertThat(paths.path("/api/v1/admin/customers/{customerId}/status").path("patch")
                .path("responses").has("409")).isTrue();

        JsonNode avatar = paths.path("/api/v1/admin/customers/{customerId}/avatar");
        assertThat(avatar.has("post")).isFalse();
        assertThat(avatar.path("delete").path("description").asText())
                .contains("CUSTOMER_AVATAR_REMOVED");
        assertThat(avatar.path("delete").path("responses").path("200").path("content")
                .path("application/json").path("schema").path("$ref").asText())
                .isEqualTo("#/components/schemas/AdminCustomerDetailDataResponse");
        assertThat(schemas.path("AdminCustomerDetailResponse").path("properties")
                .path("email").path("readOnly").asBoolean()).isTrue();
        assertThat(schemas.path("AdminCustomerDetailResponse").path("properties")
                .path("firstName").path("readOnly").asBoolean()).isTrue();
        assertThat(schemas.path("AdminCustomerDetailResponse").path("properties")
                .path("lastName").path("readOnly").asBoolean()).isTrue();
    }

    @Test
    void openApi_containsAdminSettingsMenuEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/settings");
        assertThat(body).contains("/api/v1/admin/menus");
    }

    // ── 4. Security — sensitive data not exposed ──────────────────────────────

    @Test
    void openApi_doesNotExposePasswordHash() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).doesNotContain("passwordHash");
    }

    @Test
    void openApi_doesNotExposeStorageBucketSecret() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).doesNotContain("storageBucket");
        assertThat(body).doesNotContain("\"bucket\"");
    }

    // ── 5. Regression ─────────────────────────────────────────────────────────

    @Test
    void openApi_responseIsValidJson() throws Exception {
        String body = fetchApiDocs();
        // Must start with '{' (JSON object) and contain openapi version key
        assertThat(body.trim()).startsWith("{");
        assertThat(body).contains("\"openapi\"");
        assertThat(body).contains("3.0");
    }

    @Test
    void openApi_allLocalReferencesResolve() throws Exception {
        JsonNode document = new ObjectMapper().readTree(fetchApiDocs());
        for (JsonNode referenceNode : document.findValues("$ref")) {
            String reference = referenceNode.asText();
            if (reference.startsWith("#/")) {
                assertThat(document.at(reference.substring(1)).isMissingNode())
                        .as("OpenAPI reference must resolve: %s", reference)
                        .isFalse();
            }
        }
    }
}
