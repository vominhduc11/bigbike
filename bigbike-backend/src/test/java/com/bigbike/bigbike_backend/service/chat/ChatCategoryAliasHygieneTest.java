package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatClarificationSelectionRequest;
import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Regression cover for the alias corruption measured on the live shop on 2026-09-06.
 *
 * <p>Category names and slugs are split into short aliases so a customer can type "tai nghe"
 * instead of a full title. Registering every fragment of every slug turned ordinary Vietnamese
 * grammar into product routing: "cho" matched "Phụ kiện cho xe", "đi" matched "Áo mưa, đồ đi mưa
 * moto", and "hông" inside "không" matched "Túi đeo hông". Each one silently replaced the product
 * group the customer was already shopping in.
 *
 * <p>The fixture in {@code ChatClarificationDecisionTest} has six categories and none of them
 * collide with a function word, which is exactly why the defect survived. This fixture mirrors the
 * real catalogue instead.
 */
class ChatCategoryAliasHygieneTest {

    private CatalogReadService catalog;
    private ChatToolService tools;

    @BeforeEach
    void setUp() {
        catalog = mock(CatalogReadService.class);
        tools = new ChatToolService(catalog, mock(OrderReadService.class));
        List<Category> categories = categories();
        List<Product> products = catalogProducts();
        when(catalog.listAssistantCategories("vi")).thenReturn(categories);
        when(catalog.listAssistantCategories("en")).thenReturn(categories);
        when(catalog.listAssistantDecisionProducts("vi")).thenReturn(products);
        when(catalog.listAssistantDecisionProducts("en")).thenReturn(products);
        when(catalog.assistantCompletedSales(anyList()))
                .thenReturn(new CatalogReadService.AssistantSalesSnapshot(0, List.of()));
    }

    @Test
    @DisplayName("a function word inside the question never picks a product group")
    void functionWordsDoNotPickCategories() {
        ChatToolService.ConversationContext helmets = helmetContext();

        assertThat(groupOf(answer("Cứ cho em xem tất cả", helmets))).isEqualTo("helmet");
        assertThat(groupOf(answer("Đi phố hằng ngày", helmets))).isEqualTo("helmet");
        assertThat(groupOf(answer("Shop còn mũ 3/4 màu đen không?", helmets))).isEqualTo("helmet");
    }

    @Test
    @DisplayName("pressing a quick choice keeps the product group the customer already chose")
    void quickChoiceKeepsTheChosenGroup() {
        ChatToolService.ConversationContext helmets = helmetContext();
        ChatToolService.PendingClarification pending = helmets.productDecision().pending();
        assertThat(pending).isNotNull();

        for (ChatToolService.PendingClarificationOption option : pending.options()) {
            ChatToolService.ToolOutcome outcome = tools.resolveFastPath(
                            option.label(), "vi", null, settings(), helmets,
                            new ChatClarificationSelectionRequest(pending.id(), option.id()))
                    .orElseThrow();

            assertThat(outcome.nextProductDecision().group())
                    .as("option %s must stay in the helmet group", option.label())
                    .isEqualTo("helmet");
            assertThat(outcome.products())
                    .as("option %s must only offer helmets", option.label())
                    .allSatisfy(card -> assertThat(card.slug()).startsWith("mu-"));
        }
    }

    @Test
    @DisplayName("a customer who names a different group in words is still heard")
    void typedGroupChangeStillWorks() {
        ChatToolService.ToolOutcome outcome = answer(
                "cho tôi xem găng tay", helmetContext());

        assertThat(outcome.nextProductDecision().group()).isEqualTo("gloves");
    }

    @Test
    @DisplayName("show-everything before a group is chosen samples across groups, not the cheapest")
    void showAllWithoutGroupSamplesEveryGroup() {
        ChatToolService.ToolOutcome first = tools.resolveFastPath(
                "tôi muốn tìm sản phẩm dưới 5 triệu", "vi", null, settings(),
                ChatToolService.ConversationContext.empty()).orElseThrow();
        ChatToolService.ConversationContext context = tools.recordConversationContext(
                ChatToolService.ConversationContext.empty(), "tôi muốn tìm sản phẩm dưới 5 triệu",
                "vi", first.products(), List.of(), first.effectiveSearchScope(),
                first.nextProductDecision());

        ChatToolService.ToolOutcome outcome = answer("Cứ cho em xem tất cả", context);

        List<String> slugs = outcome.products().stream()
                .map(ChatProductCardResponse::slug).toList();
        assertThat(slugs).isNotEmpty();
        assertThat(slugs).as("must not be the cheapest tail of the whole warehouse")
                .doesNotContain("phu-kien-bu-long-1", "phu-kien-bu-long-2");
        assertThat(slugs.stream().filter(slug -> slug.startsWith("mu-")).count())
                .as("helmets must still be visible in the sample").isGreaterThan(0);
    }

    private ChatToolService.ToolOutcome answer(
            String question, ChatToolService.ConversationContext context) {
        return tools.resolveFastPath(question, "vi", null, settings(), context).orElseThrow();
    }

    private String groupOf(ChatToolService.ToolOutcome outcome) {
        return outcome.nextProductDecision() == null ? null : outcome.nextProductDecision().group();
    }

    /** The state right after "Tôi muốn mua mũ bảo hiểm", with a use-case question pending. */
    private ChatToolService.ConversationContext helmetContext() {
        ChatToolService.ToolOutcome first = answer(
                "Tôi muốn mua mũ bảo hiểm", ChatToolService.ConversationContext.empty());
        return tools.recordConversationContext(
                ChatToolService.ConversationContext.empty(), "Tôi muốn mua mũ bảo hiểm", "vi",
                first.products(), List.of(), first.effectiveSearchScope(),
                first.nextProductDecision());
    }

    private static ChatAssistantSettings.Snapshot settings() {
        return new ChatAssistantSettings.Snapshot(
                true, 60, true,
                new ChatContactResponse("0900", "", "", "", ""), "", "", "", 12,
                ChatAssistantSettings.BankDetails.empty(),
                ChatAssistantSettings.PolicyText.empty(), ChatAssistantSettings.PolicyText.empty());
    }

    /** Shaped like the live catalogue, including the names that collide with function words. */
    private static List<Category> categories() {
        return List.of(
                category("helmet-root", "mu-bao-hiem", "Mũ bảo hiểm", null, 1),
                category("helmet-fullface", "mu-bao-hiem-fullface", "Mũ bảo hiểm fullface",
                        "helmet-root", 2),
                category("helmet-dual", "mu-bao-hiem-dual-sport", "Mũ bảo hiểm dual sport",
                        "helmet-root", 3),
                category("helmet-three-quarter", "mu-bao-hiem-3-4", "Mũ bảo hiểm 3/4 và nửa đầu",
                        null, 4),
                category("gloves-root", "gang-tay-xe-may-moto", "Găng tay xe máy moto", null, 5),
                category("apparel-root", "ao-quan-bao-ho", "Áo quần mô tô", null, 6),
                category("bags-root", "balo-tui-deo-tui-treo-xe", "Balo – Túi đeo – Túi treo xe",
                        null, 7),
                category("bags-hip", "tui-deo-hong-tui-deo-dui", "Túi đeo hông, túi đeo đùi",
                        "bags-root", 8),
                category("rain-root", "phu-kien-do-lot-do-mua-moto",
                        "Đồ mưa, đồ lót giáp và phụ kiện", null, 9),
                category("rain-suit", "ao-mua-do-di-mua-moto", "Áo mưa, đồ đi mưa moto",
                        "rain-root", 10),
                category("mount-root", "gia-do-dien-thoai-phu-kien-camera",
                        "Giá đỡ điện thoại và phụ kiện camera", null, 11),
                category("mount-bike", "phu-kien-cho-xe", "Phụ kiện cho xe", "mount-root", 12));
    }

    private static Category category(
            String id, String slug, String name, String parentId, int sortOrder) {
        return new Category(
                id, slug, null, name, null, parentId, null, null, null,
                null, null, true, false, null, sortOrder,
                null, null, Instant.now(), Instant.now());
    }

    private static List<Product> catalogProducts() {
        ArrayList<Product> result = new ArrayList<>();
        // Helmets, deliberately the most expensive group.
        for (int index = 0; index < 12; index++) {
            String slug = index < 6 ? "mu-bao-hiem-fullface" : "mu-bao-hiem-3-4";
            String need = index < 4 ? "đi phố đô thị hằng ngày"
                    : index < 8 ? "touring đường dài" : "dual sport đường đất địa hình";
            result.add(product("mu-mau-" + index, "Mũ bảo hiểm mẫu " + index, need, slug,
                    2_000_000L + index * 100_000L, true,
                    index == 0 ? HomepageBlock.FEATURED_GRID : null, index));
        }
        for (int index = 0; index < 5; index++) {
            result.add(product("gang-tay-" + index, "Găng tay moto " + index,
                    "đi phố quãng ngắn trời nóng", "gang-tay-xe-may-moto",
                    600_000L + index * 50_000L, true, null, index));
        }
        for (int index = 0; index < 5; index++) {
            result.add(product("ao-giap-" + index, "Áo giáp moto " + index,
                    "hằng ngày trời nóng mùa hè", "ao-quan-bao-ho",
                    1_500_000L + index * 50_000L, true, null, index));
        }
        for (int index = 0; index < 2; index++) {
            result.add(product("ao-mua-" + index, "Đồ đi mưa moto " + index,
                    "áo mưa đi mưa", "ao-mua-do-di-mua-moto",
                    400_000L + index * 20_000L, true, null, index));
        }
        for (int index = 0; index < 2; index++) {
            result.add(product("tui-hong-" + index, "Túi đeo hông moto " + index,
                    "đeo hông đeo đùi", "tui-deo-hong-tui-deo-dui",
                    500_000L + index * 20_000L, true, null, index));
        }
        // The cheapest items in the shop; these are what "show me everything" used to return.
        result.add(product("phu-kien-bu-long-1", "Bu lông nâng chân gương",
                "phụ kiện gắn lên xe", "phu-kien-cho-xe", 30_000L, true, null, 0));
        result.add(product("phu-kien-bu-long-2", "Dây ràng hành lý đàn hồi",
                "phụ kiện gắn lên xe", "phu-kien-cho-xe", 45_000L, true, null, 1));
        return List.copyOf(result);
    }

    private static Product product(
            String slug,
            String name,
            String shortDescription,
            String categorySlug,
            long price,
            boolean inStock,
            HomepageBlock homepageBlock,
            Integer homepageOrder
    ) {
        CategorySummary category = new CategorySummary(
                categorySlug, categorySlug, null, categorySlug, true, false);
        return new Product(
                "product-" + slug,
                "SKU-" + slug,
                slug,
                null,
                name,
                shortDescription,
                null,
                null,
                category,
                List.of(category),
                null,
                List.of(),
                List.of(),
                new ProductPrice(BigDecimal.valueOf(price), null, "VND"),
                List.of(),
                inStock ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK,
                inStock,
                PublishStatus.PUBLISHED,
                false,
                null,
                homepageBlock,
                homepageOrder,
                null,
                null,
                List.of(),
                List.of(),
                ProductHighlights.EMPTY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                null,
                null,
                null,
                null,
                null,
                Instant.now(),
                Instant.now());
    }
}
