package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatConversationJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatMessageJpaRepository;
import com.bigbike.bigbike_backend.service.chat.AiChatClient;
import com.bigbike.bigbike_backend.service.chat.ChatAssistantSettings;
import com.bigbike.bigbike_backend.service.chat.ChatToolRegistry;
import com.bigbike.bigbike_backend.service.chat.ChatToolService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.client.HttpClientErrorException;

/**
 * Regression coverage for Bi's public product-discovery response. The catalog fixture uses the
 * same Tanami title/slug/price/availability shape observed in the running BigBike catalog.
 */
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ChatProductDiscoveryApiTest {

    private static final String TANAMI_NAME = "Mũ bảo hiểm dual sport Caberg Tanami Carbon";
    private static final String TANAMI_NAME_EN = "Caberg Tanami Carbon Dual Sport Helmet";
    private static final String TANAMI_SLUG = "mu-bao-hiem-dual-sport-caberg-tanami-carbon";
    private static final BigDecimal TANAMI_PRICE = new BigDecimal("12000000");

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private ProductJpaRepository productRepository;
    @Autowired private CategoryJpaRepository categoryRepository;
    @Autowired private BrandJpaRepository brandRepository;
    @Autowired private ChatMessageJpaRepository messageRepository;
    @Autowired private ChatConversationJpaRepository conversationRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private ChatAssistantSettings assistantSettings;
    @MockitoBean private AiChatClient aiChatClient;

    private MockMvc mockMvc;
    private Fixture fixture;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Set<String> createdProductIds = new LinkedHashSet<>();
    private final Set<String> createdBrandIds = new LinkedHashSet<>();
    private final Set<String> createdCategoryIds = new LinkedHashSet<>();

    @BeforeAll
    void seedCatalog() {
        fixture = createFixture();
    }

    @AfterAll
    void cleanCatalogFixture() {
        productRepository.deleteAll(productRepository.findAllById(createdProductIds));
        productRepository.flush();
        brandRepository.deleteAll(brandRepository.findAllById(createdBrandIds));
        brandRepository.flush();
        categoryRepository.deleteAll(categoryRepository.findAllById(createdCategoryIds));
        categoryRepository.flush();
    }

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("CREATE ALIAS IF NOT EXISTS UNACCENT FOR \"com.bigbike.bigbike_backend.api.ChatProductDiscoveryApiTest.unaccent\"");
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        reset(assistantSettings, aiChatClient);
        when(assistantSettings.load(anyString())).thenAnswer(invocation -> settings(invocation.getArgument(0)));
        when(aiChatClient.isConfigured()).thenReturn(true);
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenAnswer(this::executeSearchAnswer);
    }

    @ParameterizedTest(name = "{0} ({1})")
    @MethodSource("tanamiQueries")
    void validTanamiDiscoveryWordingReturnsTheVerifiedCard(String message, String lang) throws Exception {
        JsonNode data = send(null, message, lang);

        assertTanamiResult(data, lang);
    }

    @Test
    void matchingProductResultSurvivesInANewAndAnExistingConversation() throws Exception {
        JsonNode first = send(null, "tôi muốn tìm sản phẩm mũ tanami", "vi");
        assertTanamiResult(first, "vi");

        UUID conversationId = UUID.fromString(first.path("conversationId").asText());
        JsonNode followUp = send(conversationId, "Tôi muốn tìm mũ bảo hiểm Tanami", "vi");
        assertTanamiResult(followUp, "vi");
        assertThat(followUp.path("conversationId").asText()).isEqualTo(conversationId.toString());
        assertThat(followUp.path("turnCount").asInt()).isEqualTo(2);
    }

    @Test
    void repeatedExactAvailabilityQuestionKeepsTheSameVerifiedTanamiConclusion() throws Exception {
        JsonNode first = send(null, "có mũ Tanami Carbon không", "vi");
        UUID conversationId = UUID.fromString(first.path("conversationId").asText());
        JsonNode second = send(conversationId, "có mũ Tanami Carbon không", "vi");
        JsonNode third = send(conversationId, "có mũ Tanami Carbon không", "vi");

        assertTanamiResult(first, "vi");
        assertTanamiResult(second, "vi");
        assertTanamiResult(third, "vi");
        assertThat(List.of(
                first.path("answer").asText(),
                second.path("answer").asText(),
                third.path("answer").asText()))
                .containsOnly(first.path("answer").asText());
        assertThat(first.path("answer").asText()).contains("còn hàng");
    }

    @Test
    void apiBrandDiscoveryKeepsLs2AsABrandFilterForAccentedAndPlainWording() throws Exception {
        String marker = "bi-ls2-" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        BrandEntity ls2 = brand(marker, "ls2-" + marker, "LS2", now);
        ProductEntity product = product(
                marker + "-product", "mu-ls2-" + marker, null,
                "Mũ bảo hiểm LS2 API", null, new BigDecimal("3000000"),
                PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true,
                fixture.tanami().getCategories().get(0), ls2, now);
        createdBrandIds.add(ls2.getId());
        createdProductIds.add(product.getId());
        brandRepository.saveAndFlush(ls2);
        productRepository.saveAndFlush(product);

        for (String question : List.of("Tìm sản phẩm thương hiệu LS2", "san pham ls2")) {
            JsonNode data = send(null, question, "vi");
            assertThat(data.path("mode").asText()).as(question).isEqualTo("AI");
            assertThat(findProduct(data.path("products"), product.getSlug())).as(question).isNotNull();
            assertThat(data.path("answer").asText()).as(question).doesNotContain("không có");
        }
    }

    @Test
    void apiHelmetDiscoveryExcludesAccessoriesWhoseNamesContainHelmetWords() throws Exception {
        String marker = "bi-helmet-scope-" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        CategoryEntity accessoryCategory = category(
                marker + "-category", "trum-dau-" + marker, "Trùm đầu", null, now);
        ProductEntity helmet = product(
                marker + "-helmet", "mu-safe-" + marker, null,
                "Mũ bảo hiểm fullface API", null, new BigDecimal("1590000"),
                PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true,
                fixture.tanami().getCategories().get(0), fixture.tanami().getBrand(), now);
        ProductEntity accessory = product(
                marker + "-accessory", "khan-trum-" + marker, null,
                "Khăn trùm nửa đầu đội mũ bảo hiểm", null, new BigDecimal("300000"),
                PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true,
                accessoryCategory, fixture.tanami().getBrand(), now.plusSeconds(1));
        createdCategoryIds.add(accessoryCategory.getId());
        createdProductIds.addAll(List.of(helmet.getId(), accessory.getId()));
        categoryRepository.saveAndFlush(accessoryCategory);
        productRepository.saveAllAndFlush(List.of(helmet, accessory));

        JsonNode data = send(null, "Mũ bảo hiểm dưới 2 tr", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(findProduct(data.path("products"), helmet.getSlug())).isNotNull();
        assertThat(findProduct(data.path("products"), accessory.getSlug())).isNull();
    }

    @Test
    void anotherCatalogProductUsesTheSameIdentifierSearchPath() throws Exception {
        JsonNode data = send(null, "Scoyco MC29", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        JsonNode product = findProduct(data.path("products"), fixture.otherProduct().getSlug());
        assertThat(product).isNotNull();
        assertThat(product.path("name").asText()).isEqualTo(fixture.otherProduct().getName());
        assertThat(product.path("retailPrice").decimalValue())
                .isEqualByComparingTo(fixture.otherProduct().getRetailPrice());
        assertThat(product.path("stockState").asText()).isEqualTo("IN_STOCK");
    }

    @Test
    void discoveryReturnsAtMostThreeVerifiedSellableCards() throws Exception {
        String marker = "bi-card-limit-" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        CategoryEntity category = fixture.tanami().getCategories().get(0);
        BrandEntity brand = fixture.tanami().getBrand();
        List<ProductEntity> fixtureProducts = List.of(
                product(marker + "-1", "riderfox-z9-1-" + marker, null,
                        "RiderFox Z9 touring 1", null, new BigDecimal("1000000"),
                        PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, category, brand, now),
                product(marker + "-2", "riderfox-z9-2-" + marker, null,
                        "RiderFox Z9 touring 2", null, new BigDecimal("1100000"),
                        PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, category, brand, now.plusSeconds(1)),
                product(marker + "-3", "riderfox-z9-3-" + marker, null,
                        "RiderFox Z9 touring 3", null, new BigDecimal("1200000"),
                        PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, category, brand, now.plusSeconds(2)),
                product(marker + "-4", "riderfox-z9-4-" + marker, null,
                        "RiderFox Z9 touring 4", null, new BigDecimal("1300000"),
                        PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, category, brand, now.plusSeconds(3)));
        fixtureProducts.forEach(product -> createdProductIds.add(product.getId()));
        productRepository.saveAllAndFlush(fixtureProducts);

        JsonNode data = send(null, "RiderFox Z9", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        JsonNode products = data.path("products");
        assertThat(products.size()).isEqualTo(3);
        for (JsonNode card : products) {
            assertThat(card.path("name").asText()).contains("RiderFox Z9");
            assertThat(card.path("stockState").asText()).isEqualTo("IN_STOCK");
        }
    }

    @Test
    void noMatchingModelReturnsVerifiedNoMatchWithoutInventingProducts() throws Exception {
        JsonNode data = send(null, "tôi muốn tìm mũ xqz-no-such-model", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("đúng mẫu", "không đổi sang sản phẩm khác");
        assertThat(data.path("contacts").path("hotline").asText()).isEqualTo("0900 000 000");
        verify(aiChatClient).answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class));
    }

    @Test
    void invalidModelTextWithVerifiedCardsUsesRecoverableFallback() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenAnswer(invocation -> {
                    AiChatClient.HybridAnswer base = executeSearchAnswer(invocation).orElseThrow();
                    return Optional.of(new AiChatClient.HybridAnswer(
                            new AiChatClient.Answer("Giá là 12.000.000 VND.", false, false, true),
                            base.products(), base.actions(), base.executedTools(), base.providerCallCount()));
                });

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("chưa xác nhận được nội dung trả lời an toàn");
        UUID conversationId = UUID.fromString(data.path("conversationId").asText());
        assertThat(conversationRepository.findById(conversationId).orElseThrow().getEndedReason())
                .isNull();
        assertThat(conversationRepository.findById(conversationId).orElseThrow().getTurnCount())
                .isZero();
        ChatMessageEntity assistantMessage = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .filter(message -> "ASSISTANT".equals(message.getRole()))
                .reduce((first, second) -> second)
                .orElseThrow();
        assertThat(assistantMessage.getSource()).isEqualTo("CONTACT_FALLBACK");
        assertThat(assistantMessage.isAiCalled()).isTrue();
        assertThat(assistantMessage.getProductsJson()).isNull();
    }

    @Test
    void modelThatHidesRequiredPriceWideningUsesRecoverableFallback() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenAnswer(invocation -> {
                    AiChatClient.HybridAnswer base = executeSearchAnswer(invocation).orElseThrow();
                    return Optional.of(new AiChatClient.HybridAnswer(
                            new AiChatClient.Answer(
                                    "Em đã tìm thấy một số sản phẩm đang bán. "
                                            + "Anh/chị xem các thẻ bên dưới để cân nhắc. "
                                            + "Em có thể hỗ trợ lọc tiếp.",
                                    false,
                                    false,
                                    false),
                            base.products(),
                            base.actions(),
                            base.executedTools(),
                            Set.of(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS),
                            base.providerCallCount()));
                });

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("chưa xác nhận được nội dung trả lời an toàn");
    }

    @Test
    void unparseableProviderResultStillUsesRecoverableFallback() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenReturn(Optional.empty());

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("chưa nhận được kết quả đã xác minh");
        assertThat(data.path("contacts").path("hotline").asText()).isEqualTo("0900 000 000");
        assertThat(data.path("contacts").path("zaloUrl").asText()).isEqualTo("https://zalo.example");
        assertThat(data.path("contacts").path("messengerUrl").asText()).isEqualTo("https://messenger.example");
    }

    @Test
    void providerHttp400StillUsesRecoverableFallbackWithoutChangingPublicResponse() throws Exception {
        HttpClientErrorException badRequest = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8);
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenThrow(badRequest);

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("chưa nhận được kết quả đã xác minh");
        UUID conversationId = UUID.fromString(data.path("conversationId").asText());
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .filteredOn(ChatMessageEntity::isAiCalled)
                .hasSize(1);
    }

    @Test
    void multipleProviderRequestsStillConsumeOneLogicalAiCall() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class)))
                .thenAnswer(invocation -> {
                    AiChatClient.HybridAnswer base = executeSearchAnswer(invocation).orElseThrow();
                    return Optional.of(new AiChatClient.HybridAnswer(
                            base.answer(), base.products(), base.actions(), base.executedTools(), 3));
                });

        JsonNode data = send(null, "mũ tanami", "vi");
        UUID conversationId = UUID.fromString(data.path("conversationId").asText());

        assertThat(conversationRepository.findById(conversationId).orElseThrow().getAiCallCount())
                .isEqualTo(1);
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .filteredOn(ChatMessageEntity::isAiCalled)
                .hasSize(1);
    }

    private Optional<AiChatClient.HybridAnswer> executeSearchAnswer(
            org.mockito.invocation.InvocationOnMock invocation) {
        String question = invocation.getArgument(0);
        String lang = invocation.getArgument(1);
        ChatToolRegistry registry = invocation.getArgument(2);
        AiChatClient.ToolExecutor executor = invocation.getArgument(4);
        JsonNode arguments = objectMapper.valueToTree(Map.of(
                "query", question.length() <= 200 ? question : question.substring(0, 200),
                "lang", lang));
        ChatToolService.ToolExecution execution = executor.execute(
                registry.validate(ChatToolRegistry.SEARCH_PRODUCTS, arguments),
                new ChatToolService.ToolSession());
        if (execution.terminalAnswer() != null) {
            ChatToolService.DeterministicAnswer terminal = execution.terminalAnswer();
            return Optional.of(new AiChatClient.HybridAnswer(
                    new AiChatClient.Answer(
                            terminal.answer(),
                            terminal.offTopic(),
                            terminal.handoffRecommended(),
                            terminal.leadPrompt()),
                    execution.products(),
                    execution.actions(),
                    List.of(ChatToolRegistry.SEARCH_PRODUCTS),
                    execution.requiredDisclosures(),
                    1,
                    "TOOL"));
        }
        if (execution.products().isEmpty()) {
            String answer = "en".equals(lang)
                    ? "I could not find a currently sold product matching that request. I will not guess product or stock information. Please choose Talk to staff for direct help."
                    : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Em không đoán tên hàng hoặc tình trạng kho. Anh/chị vui lòng bấm Gặp nhân viên để được hỗ trợ trực tiếp.";
            return Optional.of(new AiChatClient.HybridAnswer(
                    new AiChatClient.Answer(answer, false, true, false),
                    List.of(), List.of(), List.of(ChatToolRegistry.SEARCH_PRODUCTS),
                    execution.requiredDisclosures(), 2));
        }
        return Optional.of(new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(safeModelAnswer(lang), false, false, false),
                execution.products(), execution.actions(),
                List.of(ChatToolRegistry.SEARCH_PRODUCTS), execution.requiredDisclosures(), 2));
    }

    static Stream<Arguments> tanamiQueries() {
        return Stream.of(
                Arguments.of("tôi muốn tìm sản phẩm mũ tanami", "vi"),
                Arguments.of("Tôi muốn tìm mũ bảo hiểm Tanami", "vi"),
                Arguments.of("mũ tanami", "vi"),
                Arguments.of("có mũ Tanami Carbon không", "vi"),
                Arguments.of("Caberg Tanami Carbon", "vi"),
                Arguments.of(TANAMI_NAME, "vi"),
                Arguments.of("MU TANAMI", "vi"),
                Arguments.of("mũ, Tanami!!!", "vi"),
                Arguments.of("mũ     tanami", "vi"),
                Arguments.of("Carbon Tanami Caberg mũ", "vi"),
                Arguments.of("Carbon", "vi"),
                Arguments.of(TANAMI_SLUG, "vi"),
                Arguments.of("Caberg Tanami Carbon", "en"),
                Arguments.of("mu tanami", "en"));
    }

    private JsonNode send(UUID conversationId, String message, String lang) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("conversationId", conversationId);
        body.put("message", message);
        body.put("lang", lang);
        MvcResult result = mockMvc.perform(post("/api/v1/chat/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).path("data");
    }

    private void assertTanamiResult(JsonNode data, String lang) {
        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        JsonNode products = data.path("products");
        assertThat(products.isArray()).isTrue();
        assertThat(products.size()).isBetween(1, 3);
        for (JsonNode card : products) {
            assertThat(card.path("stockState").asText()).isEqualTo("IN_STOCK");
        }
        JsonNode product = findProduct(products, TANAMI_SLUG);
        assertThat(product).isNotNull();
        assertThat(product.path("name").asText())
                .isEqualTo("en".equals(lang) ? TANAMI_NAME_EN : TANAMI_NAME);
        assertThat(product.path("slug").asText()).isEqualTo(TANAMI_SLUG);
        assertThat(product.path("retailPrice").decimalValue()).isEqualByComparingTo(TANAMI_PRICE);
        assertThat(product.path("stockState").asText()).isEqualTo("IN_STOCK");
    }

    private static JsonNode findProduct(JsonNode products, String slug) {
        for (JsonNode product : products) {
            if (slug.equals(product.path("slug").asText())) return product;
        }
        return null;
    }

    private Fixture createFixture() {
        String marker = "bi-discovery-" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();

        CategoryEntity helmets = categoryRepository.findBySlug("mu-bao-hiem")
                .orElseGet(() -> category("cat_helmet", "mu-bao-hiem", "Mũ bảo hiểm", null, now));
        CategoryEntity dualSport = category(marker + "-dual", "mu-bao-hiem-dual-sport", "Mũ dual sport", helmets, now);
        CategoryEntity gloves = category(marker + "-gloves", "gang-tay-touring", "Găng tay touring", null, now);
        createdCategoryIds.addAll(List.of(dualSport.getId(), gloves.getId()));
        categoryRepository.saveAllAndFlush(List.of(helmets, dualSport, gloves));

        BrandEntity caberg = brand(marker + "-caberg", "caberg", "Caberg", now);
        BrandEntity scoyco = brand(marker + "-scoyco", "scoyco", "Scoyco", now);
        createdBrandIds.addAll(List.of(caberg.getId(), scoyco.getId()));
        brandRepository.saveAllAndFlush(List.of(caberg, scoyco));

        ProductEntity tanami = product(
                marker + "-tanami", TANAMI_SLUG, "caberg-tanami-carbon-dual-sport-helmet",
                TANAMI_NAME, TANAMI_NAME_EN, TANAMI_PRICE,
                PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, dualSport, caberg, now);
        ProductEntity other = product(
                marker + "-mc29", "gang-tay-touring-scoyco-mc29", "scoyco-mc29-touring-gloves",
                "Găng tay touring Scoyco MC29", "Scoyco MC29 Touring Gloves", new BigDecimal("1590000"),
                PublishStatus.PUBLISHED, ProductStockState.IN_STOCK, true, gloves, scoyco, now.plusSeconds(1));
        ProductEntity draft = product(
                marker + "-draft", "caberg-tanami-carbon-draft-" + marker,
                null, "Mũ Caberg Tanami Carbon bản nháp", null, TANAMI_PRICE,
                PublishStatus.DRAFT, ProductStockState.IN_STOCK, true, dualSport, caberg, now.plusSeconds(2));
        ProductEntity soldOut = product(
                marker + "-sold-out", "caberg-tanami-carbon-sold-out-" + marker,
                null, "Mũ Caberg Tanami Carbon hết hàng", null, TANAMI_PRICE,
                PublishStatus.PUBLISHED, ProductStockState.OUT_OF_STOCK, false, dualSport, caberg, now.plusSeconds(3));
        List<ProductEntity> products = List.of(tanami, other, draft, soldOut);
        products.forEach(product -> createdProductIds.add(product.getId()));
        productRepository.saveAllAndFlush(products);
        return new Fixture(tanami, other);
    }

    private static CategoryEntity category(
            String id, String slug, String name, CategoryEntity parent, Instant now) {
        CategoryEntity category = new CategoryEntity();
        category.setId(id);
        category.setSlug(slug);
        category.setName(name);
        category.setParent(parent);
        category.setVisible(true);
        category.setDeleted(false);
        category.setCreatedAt(now);
        category.setUpdatedAt(now);
        return category;
    }

    private static BrandEntity brand(String id, String slug, String name, Instant now) {
        BrandEntity brand = new BrandEntity();
        brand.setId(id);
        brand.setSlug(slug);
        brand.setName(name);
        brand.setVisible(true);
        brand.setCreatedAt(now);
        brand.setUpdatedAt(now);
        return brand;
    }

    private static ProductEntity product(
            String id,
            String slug,
            String slugEn,
            String name,
            String nameEn,
            BigDecimal retailPrice,
            PublishStatus publishStatus,
            ProductStockState stockState,
            boolean available,
            CategoryEntity category,
            BrandEntity brand,
            Instant now
    ) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setSku("SKU-" + id);
        product.setSlug(slug);
        product.setSlugEn(slugEn);
        product.setName(name);
        product.setNameEn(nameEn);
        product.setBrand(brand);
        product.setCategories(List.of(category));
        product.setRetailPrice(retailPrice);
        product.setCurrency("VND");
        product.setStockState(stockState);
        product.setStockQuantity(available ? 1 : 0);
        product.setManageStock(true);
        product.setAvailable(available);
        product.setPublishStatus(publishStatus);
        product.setHomepageBlock(HomepageBlock.NONE);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        product.setVariants(List.of());
        product.setGallery(List.of());
        product.setVideos(List.of());
        product.setRelatedProducts(List.of());
        product.setAccessoryProducts(List.of());
        return product;
    }

    private static ChatAssistantSettings.Snapshot settings(String lang) {
        return new ChatAssistantSettings.Snapshot(
                true,
                10_000,
                ChatAssistantSettings.defaultGreeting(lang),
                ChatAssistantSettings.defaultQuickPrompts(lang),
                new ChatContactResponse("0900 000 000", "https://zalo.example", "https://messenger.example", "Zalo", "Messenger"),
                "", "", "");
    }

    private static String safeModelAnswer(String lang) {
        return "en".equals(lang)
                ? "I found matching products for your request. The product cards below are currently available at BigBike. Open a product card to review its current price and details."
                : "Em đã tìm thấy sản phẩm phù hợp với yêu cầu của anh/chị. Các thẻ sản phẩm bên dưới hiện đang bán tại BigBike. Anh/chị mở thẻ sản phẩm để xem giá và thông tin hiện có.";
    }

    public static String unaccent(String value) {
        if (value == null) return null;
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(Locale.ROOT);
    }

    private record Fixture(ProductEntity tanami, ProductEntity otherProduct) {
    }
}
