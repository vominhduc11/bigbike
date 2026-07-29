package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class AdminContentOpenApiContractTest {

    private static JsonNode document;

    @BeforeAll
    static void loadContract() throws Exception {
        try (InputStream input = AdminContentOpenApiContractTest.class
                .getResourceAsStream("/openapi/bigbike-openapi.json")) {
            assertThat(input).as("bigbike-openapi.json must be on the test classpath").isNotNull();
            document = new ObjectMapper().readTree(input);
        }
    }

    @Test
    void contentLifecyclePathsAndResponsesMatchTheCurrentController() {
        JsonNode paths = document.path("paths");

        assertResponses(paths, "/api/v1/admin/content", "get", "200", "400", "401", "403");
        assertResponses(paths, "/api/v1/admin/content/{type}/{id}", "get",
                "200", "400", "401", "403", "404");
        assertResponses(paths, "/api/v1/admin/content/{type}/{id}", "delete",
                "200", "400", "401", "403", "404", "409");
        assertResponses(paths, "/api/v1/admin/content/articles", "post",
                "200", "400", "401", "403", "409");
        assertResponses(paths, "/api/v1/admin/content/articles/{id}", "patch",
                "200", "400", "401", "403", "404", "409");
        assertResponses(paths, "/api/v1/admin/content/articles/preview", "post",
                "200", "400", "401", "403");
        assertResponses(paths, "/api/v1/admin/content/articles/{id}/restore", "post",
                "200", "401", "403", "404", "409");
        assertResponses(paths, "/api/v1/admin/content/articles/{id}/permanent", "delete",
                "204", "401", "403", "404", "409");
    }

    @Test
    void listAndAssignmentDescriptionsDocumentTrashSortAndAnyReadPermission() {
        JsonNode list = document.path("paths").path("/api/v1/admin/content").path("get");
        assertThat(list.path("description").asText())
                .contains("publishStatus is omitted", "TRASH articles are excluded", "publishStatus=TRASH");

        JsonNode sort = parameterNamed(list.path("parameters"), "sort");
        assertThat(sort.path("schema").path("pattern").asText())
                .isEqualTo("^(title|publishStatus|createdAt|updatedAt|publishedAt):(asc|desc)$");

        JsonNode assignment = document.path("paths")
                .path("/api/v1/admin/product-assignment").path("get");
        assertThat(assignment.path("description").asText())
                .contains("products.read or content.read", "SUPER_ADMIN-only");
    }

    @Test
    void articleSchemaCoversAdminReadAndWriteFields() {
        JsonNode article = document.path("components").path("schemas").path("ArticleResponse");
        assertThat(fieldNames(article.path("properties")))
                .contains("id", "type", "slug", "slugEn", "title", "excerpt", "body",
                        "bodyBlocks", "coverImage", "productImage", "featured", "homeExperience",
                        "seo", "translations", "category", "categoryId", "categories",
                        "publishStatus", "publishedAt", "createdAt", "updatedAt");
        assertThat(textValues(article.path("properties").path("publishStatus").path("enum")))
                .containsExactly("DRAFT", "PUBLISHED", "TRASH");
        assertThat(document.path("components").path("schemas").path("UpsertArticleRequest")
                .path("description").asText())
                .contains("categoryId as an empty string", "tin-tuc", "canonicalUrl");
    }

    private static JsonNode parameterNamed(JsonNode parameters, String name) {
        return StreamSupport.stream(parameters.spliterator(), false)
                .filter(parameter -> name.equals(parameter.path("name").asText()))
                .findFirst()
                .orElseThrow();
    }

    private static List<String> fieldNames(JsonNode object) {
        List<String> names = new ArrayList<>();
        object.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<String> textValues(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false)
                .map(JsonNode::asText)
                .toList();
    }

    private static void assertResponses(
            JsonNode paths,
            String path,
            String method,
            String... expectedCodes
    ) {
        JsonNode operation = paths.path(path).path(method);
        assertThat(operation.isMissingNode())
                .as("%s %s must exist", method.toUpperCase(), path)
                .isFalse();
        assertThat(operation.path("responses").fieldNames())
                .toIterable()
                .containsExactlyInAnyOrder(expectedCodes);
    }
}
