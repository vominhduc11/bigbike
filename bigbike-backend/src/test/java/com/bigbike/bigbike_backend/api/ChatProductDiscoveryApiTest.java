package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantOptionEntity;
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
    private AcceptanceFixture acceptanceFixture;
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
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(this::executeSearchAnswer);
    }

    @ParameterizedTest(name = "{0} ({1})")
    @MethodSource("tanamiQueries")
    void validTanamiDiscoveryWordingReturnsTheVerifiedCard(String message, String lang) throws Exception {
        JsonNode data = send(null, message, lang);

        assertTanamiResult(data, lang);
    }

    @ParameterizedTest(name = "public q={0}")
    @MethodSource("publicTanamiQueries")
    void sharedPublicProductSearchUsesMeaningfulAndTokens(String query) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/products")
                        .param("q", query)
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsByteArray()).path("data");
        assertThat(data.toString()).contains(TANAMI_SLUG);
        assertThat(data.toString()).doesNotContain(fixture.otherProduct().getSlug());
    }

    @ParameterizedTest(name = "typo={0}")
    @MethodSource("tanamiTypoQueries")
    void nearProductNameAsksForVerifiedConfirmation(String query) throws Exception {
        JsonNode data = send(null, query, "vi");

        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("answer").asText())
                .contains("có phải anh/chị đang tìm", TANAMI_NAME, "xác nhận")
                .doesNotContain("Gặp nhân viên");
        assertThat(data.path("products").size()).isEqualTo(1);
        assertThat(data.path("products").path(0).path("slug").asText()).isEqualTo(TANAMI_SLUG);
    }

    @ParameterizedTest(name = "missing={0}")
    @MethodSource("missingProductQueries")
    void missingProductNameSaysSoWithoutRandomSubstitutes(String query) throws Exception {
        JsonNode data = send(null, query, "vi");

        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText())
                .contains("chưa có đúng mẫu", "loại hàng", "tầm giá")
                .doesNotContain("Gặp nhân viên", "Tanami");
    }

    @Test
    void mf5PrefixReturnsBothVerifiedModelsWithTheTrueCountAndPrices() throws Exception {
        acceptanceFixture();
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(this::executeAcceptanceSearchAnswer);

        JsonNode data = send(null, "tôi muốn mua mũ ILM MF5", "vi");

        assertThat(data.path("products").size()).isEqualTo(2);
        assertThat(data.path("products").toString())
                .contains("ILM MF509", "ILM MF510 Racing");
        assertThat(data.path("answer").asText())
                .contains("2 mẫu", "ILM MF509", "5.850.000đ",
                        "ILM MF510 Racing", "4.550.000đ", "hiển thị đầy đủ 2 sản phẩm")
                .doesNotContain("1 thẻ", "Gặp nhân viên");
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
    void repeatedExactAvailabilityQuestionAsksForTheNextDetailInsteadOfRepeatingIt() throws Exception {
        JsonNode first = send(null, "có mũ Tanami Carbon không", "vi");
        UUID conversationId = UUID.fromString(first.path("conversationId").asText());
        JsonNode second = send(conversationId, "có mũ Tanami Carbon không", "vi");
        JsonNode third = send(conversationId, "có mũ Tanami Carbon không", "vi");

        assertTanamiResult(first, "vi");
        assertTanamiResult(second, "vi");
        assertTanamiResult(third, "vi");
        assertThat(second.path("answer").asText())
                .isNotEqualTo(first.path("answer").asText())
                .contains("thay vì lặp lại");
        assertThat(first.path("answer").asText()).contains("còn hàng");
    }

    @Test
    void replayOfReportedBiConversationKeepsCountsResolvesPronounsAndClearsOldScope() throws Exception {
        AcceptanceFixture acceptance = acceptanceFixture();
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(this::executeAcceptanceSearchAnswer);

        JsonNode underFive = send(null, "Tôi muốn tìm mũ dưới 5tr", "vi");
        UUID conversationId = UUID.fromString(underFive.path("conversationId").asText());
        JsonNode fromThreeToFive = send(conversationId, "Từ 3tr đến 5tr đi", "vi");
        JsonNode fromFourToFive = send(conversationId, "Từ 4tr đến 5tr có không", "vi");
        JsonNode z503 = send(conversationId, "Có mũ ILM Z503 không", "vi");
        JsonNode sizes = send(conversationId, "Sản phẩm này có bảng size như nào", "vi");
        JsonNode confirmation = send(conversationId, "Vậy sản phẩm này chưa có bảng size đúng ko", "vi");
        JsonNode technical = send(conversationId, "Còn thông số kỹ thuật của sản phẩm này thì sao", "vi");
        JsonNode headsets = send(conversationId, "Tôi muốn tìm sản phẩm tai nghe", "vi");
        ChatToolService.ConversationContext contextAfterCategoryChange = objectMapper.readValue(
                conversationRepository.findById(conversationId).orElseThrow().getContextJson(),
                ChatToolService.ConversationContext.class);
        JsonNode aboveThree = send(conversationId, "Trên 3tr", "vi");

        for (JsonNode response : List.of(underFive, fromThreeToFive, fromFourToFive, z503,
                sizes, confirmation, technical, headsets, aboveThree)) {
            assertThat(response.path("mode").asText()).isEqualTo("AI");
            assertThat(response.path("reason").asText()).isEqualTo("AI");
        }
        assertThat(underFive.path("answer").asText()).contains("12 mẫu");
        assertThat(fromThreeToFive.path("answer").asText()).contains("8 mẫu");
        assertThat(fromFourToFive.path("answer").asText()).contains("1 mẫu");
        assertThat(findProduct(fromFourToFive.path("products"), acceptance.mf510().getSlug()))
                .isNotNull();
        assertThat(findProduct(z503.path("products"), acceptance.z503().getSlug())).isNotNull();
        assertThat(z503.path("answer").asText()).contains("còn hàng");
        assertThat(sizes.path("answer").asText())
                .contains("S, M, L, XL, XXL", "chưa có bảng size theo số đo");
        assertThat(confirmation.path("answer").asText())
                .contains("Dạ, đúng rồi", "chưa có bảng size theo số đo")
                .isNotEqualTo(sizes.path("answer").asText());
        assertThat(technical.path("answer").asText())
                .contains("DOT", "FMVSS 218", "ABS", "EPS")
                .doesNotContain("TIÊU CHUẨN AN TOÀN")
                .doesNotEndWith("TIÊU CHUẨN AN TOÀN.");
        assertThat(headsets.path("answer").asText()).contains("9 mẫu tai nghe");
        assertThat(contextAfterCategoryChange.category()).isEqualTo(acceptance.headsets().getSlug());
        assertThat(contextAfterCategoryChange.brand()).isNull();
        assertThat(contextAfterCategoryChange.minPrice()).isNull();
        assertThat(contextAfterCategoryChange.maxPrice()).isNull();
        assertThat(aboveThree.path("answer").asText()).contains("5 mẫu tai nghe");
        assertThat(aboveThree.path("products").size()).isEqualTo(3);
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
    void noMatchingModelDoesNotPushRandomScopedAlternative() throws Exception {
        JsonNode data = send(null, "tôi muốn tìm mũ xqz-no-such-model", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText())
                .contains("chưa có đúng mẫu", "không đổi sang sản phẩm khác", "tầm giá");
        assertThat(data.path("contacts").path("hotline").asText()).isEqualTo("0900 000 000");
        verify(aiChatClient).answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any());
    }

    @Test
    void invalidModelTextWithVerifiedCardsUsesLocalCardRecovery() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenAnswer(invocation -> {
                    AiChatClient.HybridAnswer base = executeSearchAnswer(invocation).orElseThrow();
                    return Optional.of(new AiChatClient.HybridAnswer(
                            new AiChatClient.Answer("Giá là 12.000.000 VND.", false, false, true),
                            base.products(), base.actions(), base.executedTools(), base.providerCallCount()));
                });

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isBetween(1, 3);
        assertThat(data.path("answer").asText()).contains("hiển thị").doesNotContain("12.000.000");
        UUID conversationId = UUID.fromString(data.path("conversationId").asText());
        assertThat(conversationRepository.findById(conversationId).orElseThrow().getEndedReason())
                .isNull();
        assertThat(conversationRepository.findById(conversationId).orElseThrow().getTurnCount())
                .isEqualTo(1);
        ChatMessageEntity assistantMessage = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
                .stream()
                .filter(message -> "ASSISTANT".equals(message.getRole()))
                .reduce((first, second) -> second)
                .orElseThrow();
        assertThat(assistantMessage.getSource()).isEqualTo("TOOL");
        assertThat(assistantMessage.isAiCalled()).isTrue();
        assertThat(assistantMessage.getProductsJson()).isNotBlank();
    }

    @Test
    void modelThatHidesRequiredPriceWideningUsesVerifiedPriceMissRecovery() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
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
        assertThat(data.path("products").size()).isBetween(1, 3);
        assertThat(data.path("answer").asText()).contains("chưa tìm thấy", "phương án gần nhất");
    }

    @Test
    void unparseableProviderResultStillUsesRecoverableClarification() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenReturn(Optional.empty());

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("vẫn có thể hỏi tiếp", "em sẽ tra lại")
                .doesNotContain("kết quả đã xác minh");
        assertThat(data.path("contacts").path("hotline").asText()).isEqualTo("0900 000 000");
        assertThat(data.path("contacts").path("zaloUrl").asText()).isEqualTo("https://zalo.example");
        assertThat(data.path("contacts").path("messengerUrl").asText()).isEqualTo("https://messenger.example");
    }

    @Test
    void providerHttp400StillUsesRecoverableClarificationWithoutChangingPublicResponse() throws Exception {
        HttpClientErrorException badRequest = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8);
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
                .thenThrow(badRequest);

        JsonNode data = send(null, "mũ tanami", "vi");

        assertThat(data.path("mode").asText()).isEqualTo("AI");
        assertThat(data.path("reason").asText()).isEqualTo("AI");
        assertThat(data.path("products").size()).isZero();
        assertThat(data.path("answer").asText()).contains("vẫn có thể hỏi tiếp", "em sẽ tra lại")
                .doesNotContain("kết quả đã xác minh");
        UUID conversationId = UUID.fromString(data.path("conversationId").asText());
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId))
                .filteredOn(ChatMessageEntity::isAiCalled)
                .hasSize(1);
    }

    @Test
    void multipleProviderRequestsStillConsumeOneLogicalAiCall() throws Exception {
        when(aiChatClient.answer(
                anyString(), anyString(), any(ChatToolRegistry.class),
                anyBoolean(), any(AiChatClient.ToolExecutor.class),
                any(ChatToolService.AssistantCatalogVocabulary.class), any(), any()))
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
        Map<String, Object> argumentValues = new LinkedHashMap<>();
        argumentValues.put("query", question.length() <= 200 ? question : question.substring(0, 200));
        argumentValues.put("lang", lang);
        // This mock represents the new provider behaviour: an obvious helmet phrase is
        // interpreted through the public category vocabulary, while any concrete model text
        // remains exactly as the customer supplied it.
        if (unaccent(question).matches("(?s).*\\bmu\\b.*")) {
            argumentValues.put("category", "mu-bao-hiem");
        }
        return executeSearchAnswer(invocation, argumentValues);
    }

    private Optional<AiChatClient.HybridAnswer> executeAcceptanceSearchAnswer(
            org.mockito.invocation.InvocationOnMock invocation) {
        AcceptanceFixture acceptance = acceptanceFixture();
        String question = invocation.getArgument(0);
        String lang = invocation.getArgument(1);
        String normalized = unaccent(question);
        Map<String, Object> argumentValues = new LinkedHashMap<>();
        argumentValues.put("query", question.length() <= 200 ? question : question.substring(0, 200));
        argumentValues.put("lang", lang);
        if (normalized.contains("tai nghe")) {
            argumentValues.put("category", acceptance.headsets().getSlug());
        } else if (normalized.contains("mu") || normalized.contains("z503")) {
            argumentValues.put("category", acceptance.helmets().getSlug());
        }
        return executeSearchAnswer(invocation, argumentValues);
    }

    private Optional<AiChatClient.HybridAnswer> executeSearchAnswer(
            org.mockito.invocation.InvocationOnMock invocation,
            Map<String, Object> argumentValues) {
        String lang = invocation.getArgument(1);
        ChatToolRegistry registry = invocation.getArgument(2);
        AiChatClient.ToolExecutor executor = invocation.getArgument(4);
        JsonNode arguments = objectMapper.valueToTree(argumentValues);
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
                    "TOOL",
                    execution.catalogTotals(),
                    execution.searchScope()));
        }
        if (execution.products().isEmpty()) {
            String answer = "en".equals(lang)
                    ? "I could not find a currently sold product matching that request. I will not guess product or stock information. Please choose Talk to staff for direct help."
                    : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này. Em không đoán tên hàng hoặc tình trạng kho. Anh/chị vui lòng bấm Gặp nhân viên để được hỗ trợ trực tiếp.";
            return Optional.of(new AiChatClient.HybridAnswer(
                    new AiChatClient.Answer(answer, false, true, false),
                    List.of(), List.of(), List.of(ChatToolRegistry.SEARCH_PRODUCTS),
                    execution.requiredDisclosures(), 2, "AI",
                    execution.catalogTotals(), execution.searchScope()));
        }
        return Optional.of(new AiChatClient.HybridAnswer(
                new AiChatClient.Answer(safeModelAnswer(lang), false, false, false),
                execution.products(), execution.actions(),
                List.of(ChatToolRegistry.SEARCH_PRODUCTS), execution.requiredDisclosures(), 2, "AI",
                execution.catalogTotals(), execution.searchScope()));
    }

    static Stream<Arguments> tanamiQueries() {
        return Stream.of(
                Arguments.of("tôi muốn tìm sản phẩm mũ tanami", "vi"),
                Arguments.of("tôi muốn tìm sản phẩm tanami", "vi"),
                Arguments.of("Tôi muốn tìm mũ bảo hiểm Tanami", "vi"),
                Arguments.of("mũ tanami", "vi"),
                Arguments.of("nón tanami giá bao nhiêu", "vi"),
                Arguments.of("cho mình xem cái mũ tanami với", "vi"),
                Arguments.of("shop có mũ Caberg Tanami không", "vi"),
                Arguments.of("e muốn xem mũ tanami ạ", "vi"),
                Arguments.of("mũ tanami carbon còn hàng ko", "vi"),
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

    static Stream<String> publicTanamiQueries() {
        return Stream.of("tanami", "mũ tanami", "sản phẩm tanami", "nón tanami");
    }

    static Stream<String> tanamiTypoQueries() {
        return Stream.of("mũ tanamy", "mũ canami", "mu bao hiem tanamy carbon");
    }

    static Stream<String> missingProductQueries() {
        return Stream.of("tôi muốn tìm mũ zephyros", "shop có mũ Shoei X15 không");
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

    /**
     * Isolated catalogue data for the real incident replay. Its category slugs are unique so
     * count assertions stay stable even as unrelated discovery fixtures are added to this class.
     */
    private AcceptanceFixture acceptanceFixture() {
        if (acceptanceFixture != null) return acceptanceFixture;

        String marker = "bi-acceptance-" + UUID.randomUUID().toString().replace("-", "");
        Instant now = Instant.now();
        CategoryEntity helmets = category(
                marker + "-helmets",
                "mu-bao-hiem-bi-acceptance-" + marker,
                "Mũ bảo hiểm nghiệm thu Bi",
                null,
                now);
        CategoryEntity headsets = category(
                marker + "-headsets",
                "tai-nghe-bi-acceptance-" + marker,
                "Tai nghe nghiệm thu Bi",
                null,
                now);
        createdCategoryIds.addAll(List.of(helmets.getId(), headsets.getId()));
        categoryRepository.saveAllAndFlush(List.of(helmets, headsets));

        BrandEntity ilm = brandRepository.findBySlug("ilm").orElseGet(() -> {
            BrandEntity created = brand(marker + "-ilm", "ilm", "ILM", now);
            createdBrandIds.add(created.getId());
            return brandRepository.saveAndFlush(created);
        });

        ProductEntity z503 = product(
                marker + "-z503",
                "mu-bao-hiem-fullface-retro-ilm-z503-" + marker,
                null,
                "Mũ bảo hiểm fullface retro ILM Z503",
                null,
                new BigDecimal("2500000"),
                PublishStatus.PUBLISHED,
                ProductStockState.IN_STOCK,
                true,
                helmets,
                ilm,
                now);
        z503.setDescription("<p>ILM Z503 mang phong cách cổ điển cho nhu cầu chạy phố.</p>"
                + "<h3>TIÊU CHUẨN AN TOÀN</h3><p>Đạt chuẩn DOT và FMVSS 218.</p>"
                + "<p>Vỏ ngoài ABS bền chắc.</p><p>Lớp xốp EPS đa mật độ hỗ trợ hấp thụ lực.</p>");
        z503.setSpecifications("");
        z503.setSpecStats("");
        z503.setSizeGuide(null);
        z503.setSizeGuideSection(null);
        z503.setVariants(sellableSizeVariants(z503, marker));

        List<ProductEntity> products = new java.util.ArrayList<>();
        products.add(z503);
        ProductEntity mf510 = product(
                marker + "-mf510",
                "mu-bao-hiem-ilm-mf510-racing-" + marker,
                null,
                "ILM MF510 Racing",
                null,
                new BigDecimal("4550000"),
                PublishStatus.PUBLISHED,
                ProductStockState.IN_STOCK,
                true,
                helmets,
                ilm,
                now.plusSeconds(1));
        products.add(mf510);
        ProductEntity mf509 = product(
                marker + "-mf509",
                "mu-bao-hiem-ilm-mf509-" + marker,
                null,
                "ILM MF509",
                null,
                new BigDecimal("5850000"),
                PublishStatus.PUBLISHED,
                ProductStockState.IN_STOCK,
                true,
                helmets,
                ilm,
                now.plusSeconds(2));
        products.add(mf509);
        for (int index = 1; index <= 7; index++) {
            products.add(product(
                    marker + "-helmet-mid-" + index,
                    "mu-bao-hiem-nghiem-thu-mid-" + index + "-" + marker,
                    null,
                    "Mũ bảo hiểm nghiệm thu tầm trung " + index,
                    null,
                    BigDecimal.valueOf(3_000_000L + index * 100_000L),
                    PublishStatus.PUBLISHED,
                    ProductStockState.IN_STOCK,
                    true,
                    helmets,
                    ilm,
                    now.plusSeconds(2L + index)));
        }
        for (int index = 1; index <= 3; index++) {
            products.add(product(
                    marker + "-helmet-low-" + index,
                    "mu-bao-hiem-nghiem-thu-low-" + index + "-" + marker,
                    null,
                    "Mũ bảo hiểm nghiệm thu phổ thông " + index,
                    null,
                    BigDecimal.valueOf(1_200_000L + index * 250_000L),
                    PublishStatus.PUBLISHED,
                    ProductStockState.IN_STOCK,
                    true,
                    helmets,
                    ilm,
                    now.plusSeconds(10L + index)));
        }

        List<String> expensiveHeadsetNames = List.of(
                "SCS S12", "SCS T2 Plus", "SCS G7+", "SCS Cam-S", "SCS S13");
        List<BigDecimal> expensiveHeadsetPrices = List.of(
                new BigDecimal("5890000"),
                new BigDecimal("3390000"),
                new BigDecimal("3290000"),
                new BigDecimal("3290000"),
                new BigDecimal("3190000"));
        for (int index = 0; index < expensiveHeadsetNames.size(); index++) {
            products.add(product(
                    marker + "-headset-high-" + index,
                    "tai-nghe-" + (index + 1) + "-" + marker,
                    null,
                    expensiveHeadsetNames.get(index),
                    null,
                    expensiveHeadsetPrices.get(index),
                    PublishStatus.PUBLISHED,
                    ProductStockState.IN_STOCK,
                    true,
                    headsets,
                    ilm,
                    now.plusSeconds(20L + index)));
        }
        for (int index = 1; index <= 4; index++) {
            products.add(product(
                    marker + "-headset-low-" + index,
                    "tai-nghe-pho-thong-" + index + "-" + marker,
                    null,
                    "Tai nghe mũ bảo hiểm phổ thông " + index,
                    null,
                    BigDecimal.valueOf(1_000_000L + index * 250_000L),
                    PublishStatus.PUBLISHED,
                    ProductStockState.IN_STOCK,
                    true,
                    headsets,
                    ilm,
                    now.plusSeconds(30L + index)));
        }
        products.forEach(product -> createdProductIds.add(product.getId()));
        productRepository.saveAllAndFlush(products);
        acceptanceFixture = new AcceptanceFixture(helmets, headsets, z503, mf510, mf509);
        return acceptanceFixture;
    }

    private static List<ProductVariantEntity> sellableSizeVariants(ProductEntity product, String marker) {
        List<ProductVariantEntity> variants = new java.util.ArrayList<>();
        int order = 0;
        for (String size : List.of("S", "M", "L", "XL", "XXL")) {
            ProductVariantEntity variant = new ProductVariantEntity();
            variant.setId(product.getId() + "-" + size.toLowerCase(Locale.ROOT));
            variant.setProduct(product);
            variant.setSku("SKU-" + marker + "-" + size);
            variant.setName("Size " + size);
            variant.setRetailPrice(product.getRetailPrice());
            variant.setCurrency("VND");
            variant.setStockState(ProductStockState.IN_STOCK);
            variant.setQuantityOnHand(1);
            variant.setAvailable(true);
            variant.setSortOrder(order++);
            ProductVariantOptionEntity option = new ProductVariantOptionEntity();
            option.setVariant(variant);
            option.setSortOrder(0);
            option.setOptionName("Size");
            option.setOptionValue(size);
            variant.setOptions(List.of(option));
            variant.setGallery(List.of());
            variants.add(variant);
        }
        return variants;
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
                ? "I found matching products for your request. The products below are currently available at BigBike. Open a product to review its current price and details."
                : "Em đã tìm thấy sản phẩm phù hợp với yêu cầu của anh/chị. Các sản phẩm bên dưới hiện đang bán tại BigBike. Anh/chị mở sản phẩm để xem giá và thông tin hiện có.";
    }

    public static String unaccent(String value) {
        if (value == null) return null;
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase(Locale.ROOT);
    }

    private record Fixture(ProductEntity tanami, ProductEntity otherProduct) {}

    private record AcceptanceFixture(
            CategoryEntity helmets,
            CategoryEntity headsets,
            ProductEntity z503,
            ProductEntity mf510,
            ProductEntity mf509
    ) {}
}
