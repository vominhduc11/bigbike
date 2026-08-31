package com.bigbike.bigbike_backend.service.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import com.bigbike.bigbike_backend.service.email.InternalMailRecipient;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class InventoryOutOfStockDigestEmailServiceTest {

    @Mock private EmailDispatchService emailDispatchService;
    @Mock private ObjectMapper objectMapper;

    private InventoryOutOfStockDigestEmailService service;

    @BeforeEach
    void setUp() {
        service = new InventoryOutOfStockDigestEmailService(
                emailDispatchService,
                new InternalMailRecipient("sales@example.test"),
                objectMapper,
                "https://admin.example.test/");
    }

    @Test
    void sendsOneCompleteBilingualAggregateAndRendersEveryLongListRow() throws Exception {
        Instant generatedAt = Instant.parse("2026-08-31T01:00:00Z");
        List<InventoryOutOfStockDigest.ProductItem> full = IntStream.range(0, 80)
                .mapToObj(index -> new InventoryOutOfStockDigest.ProductItem(
                        "full-" + index,
                        "Sản phẩm " + index,
                        "Product " + index,
                        "SKU-" + index,
                        "/admin/products/full-" + index,
                        generatedAt.minusSeconds(index * 86_400L),
                        index,
                        index == 0))
                .toList();
        var unavailableVariant = new InventoryOutOfStockDigest.VariantItem(
                "variant-xl", "Đen - XL", "Black - XL", "PARTIAL-XL",
                generatedAt.minusSeconds(4 * 86_400L), 4, false);
        var partial = new InventoryOutOfStockDigest.PartialProductItem(
                "partial-1", "Áo giáp thiếu cỡ", "Armour missing sizes", "PARTIAL-1",
                "/admin/products/partial-1", generatedAt.minusSeconds(4 * 86_400L),
                4, false, List.of(unavailableVariant));
        InventoryOutOfStockDigest digest = new InventoryOutOfStockDigest(
                1,
                LocalDate.of(2026, 8, 31),
                generatedAt,
                new InventoryOutOfStockDigest.Counts(80, 1, 1),
                full,
                List.of(partial));
        when(objectMapper.readValue("{snapshot}", InventoryOutOfStockDigest.class)).thenReturn(digest);
        when(emailDispatchService.send(
                eq("sales@example.test"), any(), eq("inventory-out-of-stock-digest"), any()))
                .thenReturn(true);

        assertThat(service.sendPayload("{snapshot}")).isTrue();

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Context> context = ArgumentCaptor.forClass(Context.class);
        verify(emailDispatchService, times(1)).send(
                eq("sales@example.test"), subject.capture(),
                eq("inventory-out-of-stock-digest"), context.capture());
        assertThat(subject.getValue())
                .contains("Hàng hết cần xử lý")
                .contains("Out-of-stock action needed")
                .contains("31/08/2026");

        @SuppressWarnings("unchecked")
        List<InventoryOutOfStockDigestEmailService.EmailProduct> renderedFull =
                (List<InventoryOutOfStockDigestEmailService.EmailProduct>)
                        context.getValue().getVariable("fullProducts");
        assertThat(renderedFull).hasSize(80);
        assertThat(renderedFull.get(0).duration()).contains("Ít nhất").contains("At least");
        assertThat(renderedFull.get(79).editUrl())
                .isEqualTo("https://admin.example.test/admin/products/full-79");

        String html = templateEngine().process("email/inventory-out-of-stock-digest", context.getValue());
        assertThat(html)
                .contains("Hết sạch / Fully out of stock")
                .contains("Thiếu cỡ hoặc màu / Missing size or colour")
                .contains("Sản phẩm 0")
                .contains("Product 79")
                .contains("Đen - XL")
                .contains("https://admin.example.test/admin/products/partial-1");
    }

    @Test
    void malformedStoredSnapshotDoesNotAttemptEmail() throws Exception {
        when(objectMapper.readValue("broken", InventoryOutOfStockDigest.class))
                .thenThrow(new IllegalArgumentException("invalid snapshot"));

        assertThat(service.sendPayload("broken")).isFalse();

        verify(emailDispatchService, never()).send(any(), any(), any(), any());
    }

    private static SpringTemplateEngine templateEngine() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setCharacterEncoding("UTF-8");
        resolver.setCacheable(false);
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }
}
