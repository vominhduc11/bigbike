package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatToolServiceTest {

    @Test
    @DisplayName("get_my_orders refuses a guest before the order service can run")
    void guestOrderQuestionNeverReadsOrders() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        ChatToolService tools = new ChatToolService(catalog, orders);
        ChatAssistantSettings.Snapshot settings = new ChatAssistantSettings.Snapshot(
                true,
                60,
                "Xin chào",
                List.of("A", "B", "C"),
                new ChatContactResponse("0900", "", "", "", ""),
                "", "", "");

        ChatToolService.ToolOutcome outcome = tools.resolve(
                "Kiểm tra đơn hàng của tôi", "vi", null, settings);

        assertThat(outcome.aiRequired()).isFalse();
        assertThat(outcome.localAnswer()).contains("đăng nhập").doesNotContain("địa chỉ");
        verifyNoInteractions(orders);
    }

    @Test
    @DisplayName("variant attribute normalization ignores case and Vietnamese diacritics")
    void normalizerRemovesCaseAndDiacritics() {
        assertThat(ChatToolService.normalize("MÀU SẮC")).isEqualTo("mau sac");
        assertThat(ChatToolService.normalize("Size")).isEqualTo("size");
        assertThat(ChatToolService.normalize("MODEL")).isEqualTo("model");
    }

    @Test
    @DisplayName("get_product keeps only exact in-stock size and color combinations")
    void availableVariantCombinationsStayCoupled() {
        ProductVariant available = variant(true, "Màu sắc", "Đen", "SIZE", "M");
        ProductVariant unavailable = variant(false, "color", "Đỏ", "size", "L");

        assertThat(ChatToolService.normalizedAvailableVariants(List.of(available, unavailable)))
                .containsExactly(Map.of("color", "Đen", "size", "M"));
    }

    @Test
    @DisplayName("search_products forwards only the fixed filters and caps the result at five")
    void productSearchUsesFixedAllowlistedArguments() {
        CatalogReadService catalog = mock(CatalogReadService.class);
        OrderReadService orders = mock(OrderReadService.class);
        when(catalog.listProducts(
                1, 5, "price:asc", "mu-bao-hiem", "ls2", "3/4", "Đen", "UNISEX",
                1_000_000L, 2_500_000L, null, "vi"))
                .thenReturn(new PageResult<>(List.of(), 1, 5, 0, 0));
        ChatToolService tools = new ChatToolService(catalog, orders);

        tools.searchProducts(
                "3/4", "mu-bao-hiem", "ls2", 1_000_000L, 2_500_000L,
                "Đen", "UNISEX", "vi");

        verify(catalog).listProducts(
                1, 5, "price:asc", "mu-bao-hiem", "ls2", "3/4", "Đen", "UNISEX",
                1_000_000L, 2_500_000L, null, "vi");
        verifyNoInteractions(orders);
    }

    private static ProductVariant variant(
            boolean available,
            String colorName,
            String colorValue,
            String sizeName,
            String sizeValue
    ) {
        return new ProductVariant(
                "variant", "SKU", "Variant",
                List.of(
                        new ProductVariantOption(colorName, colorValue),
                        new ProductVariantOption(sizeName, sizeValue)),
                null, null, null, List.of(), available);
    }
}
