package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatResponseGuardTest {

    private final ChatResponseGuard guard = new ChatResponseGuard();

    @Test
    @DisplayName("customer text rejects technical vocabulary and raw internal status")
    void rejectsTechnicalCustomerText() {
        assertThat(guard.check("Đây là JSON của đơn hàng. API đang lỗi. Anh/chị thử lại nhé.", List.of(), "vi"))
                .isEmpty();
        assertThat(guard.check("Đơn này có trạng thái CANCELLED. Anh/chị xem lại giúp em nhé.", List.of(), "vi"))
                .isEmpty();
        assertThat(guard.check("Tổng tiền là 1590000.00 ₫. Anh/chị mở đơn để xem thêm. Em luôn sẵn sàng hỗ trợ.", List.of(), "vi"))
                .isEmpty();
        assertThat(guard.check("Em vừa nhận một functionCall. Backend đã xử lý xong. Anh/chị thử lại nhé.", List.of(), "vi"))
                .isEmpty();
        assertThat(guard.check("Màu ronin-red đang được lưu nội bộ. Anh/chị chọn màu khác giúp em nhé.", List.of(), "vi"))
                .isEmpty();
    }

    @Test
    @DisplayName("English customer text cannot fall back to Vietnamese copy")
    void rejectsMixedLanguageText() {
        assertThat(guard.check("I can help anh/chị. Please choose Talk to staff. We are here to help.", List.of(), "en"))
                .isEmpty();
    }

    @Test
    @DisplayName("product cards are capped and require a priced in-stock product")
    void validatesProductCards() {
        ChatProductCardResponse valid = new ChatProductCardResponse(
                "helmet", "Helmet", null, BigDecimal.valueOf(2_000_000), null, "VND", "IN_STOCK");
        ChatProductCardResponse invalid = new ChatProductCardResponse(
                "sold-out", "Sold out", null, BigDecimal.valueOf(2_000_000), null, "VND", "OUT_OF_STOCK");

        assertThat(guard.check("Mức giá này đang được áp dụng. Anh/chị mở sản phẩm để xem thêm. Em luôn sẵn sàng hỗ trợ.",
                List.of(valid), "vi")).isPresent();
        assertThat(guard.check("Mức giá này đang được áp dụng. Anh/chị mở sản phẩm để xem thêm. Em luôn sẵn sàng hỗ trợ.",
                List.of(invalid), "vi")).isEmpty();
        assertThat(guard.check("Mức giá này đang được áp dụng. Anh/chị mở sản phẩm để xem thêm. Em luôn sẵn sàng hỗ trợ.",
                List.of(valid, valid, valid, valid), "vi")).isEmpty();
    }

    @Test
    @DisplayName("CHAT_RULE_007: answers of 2 to 5 sentences pass, shorter or longer do not")
    void enforcesSentenceRange() {
        assertThat(guard.check("Em đã kiểm tra sản phẩm này.", List.of(), "vi"))
                .as("one sentence is still too short").isEmpty();
        assertThat(guard.check(
                "Em đã kiểm tra sản phẩm này đang bán. Anh/chị mở thẻ bên dưới để xem thêm nhé?",
                List.of(), "vi"))
                .as("two sentences reach the customer instead of falling back").isPresent();
        assertThat(guard.check(
                "Một. Hai. Ba. Bốn. Năm. Sáu.", List.of(), "vi"))
                .as("six sentences stay rejected").isEmpty();
    }

    @Test
    @DisplayName("model answers cannot echo customer email or phone")
    void rejectsModelPiiEcho() {
        assertThat(guard.checkModel(
                "Em đã nhận email khach@example.com. Em sẽ dùng email này để kiểm tra. Anh/chị vui lòng chờ.",
                List.of(), "vi", List.of())).isEmpty();
        assertThat(guard.checkModel(
                "Em đã nhận số 0900 123 456. Em sẽ dùng số này để kiểm tra. Anh/chị vui lòng chờ.",
                List.of(), "vi", List.of())).isEmpty();
        assertThat(guard.checkModel(
                "Dạ, em xác nhận Hotline công khai là 0900 123 456. Anh/chị có thể liên hệ trong giờ mở cửa. BigBike sẽ hỗ trợ trực tiếp.",
                List.of(), "vi", List.of("0900 123 456"))).isPresent();
        assertThat(guard.checkModel(
                "Hotline shop là 0900 123 456. Số khách là 0912 345 678. Anh/chị có thể liên hệ BigBike trực tiếp.",
                List.of(), "vi", List.of("0900 123 456"))).isEmpty();
    }

    @Test
    @DisplayName("model must disclose every backend-controlled search widening")
    void enforcesRequiredSearchDisclosures() {
        String silentWidening = "Em đã tìm thấy một số sản phẩm đang bán. "
                + "Anh/chị xem các thẻ bên dưới để cân nhắc. Em có thể hỗ trợ lọc tiếp.";
        assertThat(guard.checkModel(
                silentWidening,
                List.of(),
                "vi",
                List.of(),
                Set.of(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS)))
                .isEmpty();

        String disclosedPriceMiss = "Tầm giá anh/chị hỏi hiện chưa có sản phẩm phù hợp. "
                + "Các lựa chọn bên dưới là phương án gần nhất đang có. "
                + "Anh/chị có thể nói rõ thêm nhu cầu để em lọc tiếp.";
        assertThat(guard.checkModel(
                disclosedPriceMiss,
                List.of(),
                "vi",
                List.of(),
                Set.of(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS)))
                .isPresent();

        String disclosedBroadening = "Danh sách này đang rộng hơn yêu cầu ban đầu. "
                + "Anh/chị có thể nói cụ thể hơn để em thu hẹp kết quả. "
                + "Em chỉ hiển thị các sản phẩm đang bán.";
        assertThat(guard.checkModel(
                disclosedBroadening,
                List.of(),
                "vi",
                List.of(),
                Set.of(ChatToolService.RequiredDisclosure.BROADENED_SEARCH)))
                .isPresent();
    }

    @Test
    @DisplayName("Vietnamese assistant copy forbids customer-as-em and curt language without mandatory pronouns")
    void enforcesVietnameseAssistantTone() {
        assertThat(guard.check(
                "Chào em, em đang tìm sản phẩm nào? Anh/chị nói rõ giúp Bi nhé.", List.of(), "vi"))
                .isEmpty();
        assertThat(guard.check(
                "Dạ, em đã nhận yêu cầu của anh/chị. Em vui lòng chọn một mẫu để em kiểm tra thêm nhé.",
                List.of(),
                "vi"))
                .as("a customer-directed 'em' remains unsafe even when anh/chị appears elsewhere")
                .isEmpty();
        assertThat(guard.check(
                "Dạ, em đã lọc sản phẩm phù hợp. Em có thể tham khảo các thẻ bên dưới. Anh/chị cho em biết nếu cần lọc tiếp nhé.",
                List.of(),
                "vi"))
                .as("a customer-directed recommendation cannot call the customer em")
                .isEmpty();
        assertThat(guard.check(
                "Dạ, em có thể hỗ trợ tìm sản phẩm. Anh/chị cho em biết loại hàng cần xem nhé?", List.of(), "vi"))
                .isPresent();
        assertThat(guard.check(
                "Dạ, shop hiện có dữ liệu phù hợp. Mời xem thẻ sản phẩm để chọn mẫu cần kiểm tra.",
                List.of(), "vi")).isPresent();
        assertThat(guard.check(
                "Tự xem đi. Dừng hỏi nữa.", List.of(), "vi")).isEmpty();
        assertThat(guard.rejectionReason(
                "Dạ, em đã kiểm tra yêu cầu này. Em có thể hỗ trợ thêm ngay.",
                List.of(), "vi", List.of(), Set.of())).isEqualTo("NONE");
        assertThat(guard.check(
                "I can help you find a product. Please tell me what you are looking for.", List.of(), "en"))
                .isPresent();
    }

    @Test
    @DisplayName("model prose cannot infer a warehouse-wide count or absence from product cards")
    void rejectsUngroundedWarehouseWideClaims() {
        assertThat(guard.checkModel(
                "Dạ, em đã kiểm tra các thẻ sản phẩm hiện có. BigBike chỉ có ba mẫu mũ đang bán. Anh/chị mở thẻ để xem thêm nhé.",
                List.of(),
                "vi",
                List.of())).isEmpty();
        assertThat(guard.checkModel(
                "Dạ, em đã xem kết quả hiện có. Tất cả sản phẩm mũ BigBike đều dưới mức này. Anh/chị mở thẻ để xem thêm nhé.",
                List.of(),
                "vi",
                List.of())).isEmpty();
        String unsupportedCount = "Dạ, em đã kiểm tra các thẻ sản phẩm hiện có. "
                + "BigBike có ba sản phẩm mũ đang bán. "
                + "Anh/chị mở thẻ để xem thêm nhé.";
        assertThat(guard.check(unsupportedCount, List.of(), "vi")).isEmpty();
        assertThat(guard.rejectionReason(unsupportedCount, List.of(), "vi", List.of(), Set.of()))
                .isEqualTo("UNSUPPORTED_CATALOG_CLAIM");
        assertThat(guard.checkModel(
                "Dạ, em chưa tìm thấy sản phẩm đang bán trong tầm giá anh/chị hỏi. Các thẻ bên dưới là phương án gần nhất đang có.",
                List.of(),
                "vi",
                List.of(),
                Set.of(ChatToolService.RequiredDisclosure.PRICE_RANGE_MISS))).isPresent();
    }

    @Test
    @DisplayName("CHAT_RULE_020: only the exact current scope and range totals may be stated")
    void acceptsOnlyBackendSuppliedCatalogTotals() {
        ChatToolService.CatalogTotals totals = new ChatToolService.CatalogTotals(1, 8, 1L);
        String supported = "Dạ, em đã kiểm tra: shop hiện có 8 mẫu tai nghe. "
                + "Trong tầm giá đang áp dụng, shop có 1 mẫu. "
                + "Anh/chị mở thẻ sản phẩm để xem thêm nhé.";

        assertThat(guard.checkModel(supported, List.of(), "vi", List.of(), Set.of(), totals)).isPresent();
        assertThat(guard.checkModel(
                supported.replace("có 1 mẫu", "có 2 mẫu"),
                List.of(), "vi", List.of(), Set.of(), totals)).isEmpty();
        assertThat(guard.checkModel(
                "Dạ, em đã kiểm tra: shop hiện có 8 mẫu tai nghe trong 1–2 triệu. "
                        + "Anh/chị mở thẻ sản phẩm để xem thêm nhé.",
                List.of(), "vi", List.of(), Set.of(), totals)).isEmpty();
        assertThat(guard.checkModel(supported, List.of(), "vi", List.of())).isEmpty();
    }

    @Test
    @DisplayName("a one-sided price range keeps its verified count instead of becoming a warehouse claim")
    void acceptsVerifiedAbovePriceRangeCount() {
        ChatProductCardResponse card = new ChatProductCardResponse(
                "headset", "Tai nghe", null, BigDecimal.valueOf(3_500_000), null, "VND", "IN_STOCK");
        ChatToolService.CatalogTotals totals = new ChatToolService.CatalogTotals(5, 9, 5L);
        String answer = "Dạ, trong tầm giá từ 3 triệu trở lên, shop có 5 mẫu tai nghe. "
                + "Em đang hiển thị 3 thẻ tiêu biểu trong tổng 5 mẫu phù hợp. "
                + "Anh/chị mở từng thẻ để xem thông tin và lựa chọn hiện có nhé.";

        assertThat(guard.check(answer, List.of(card, card, card), "vi", Set.of(), totals)).isPresent();
        assertThat(guard.rejectionDiagnostic(answer, List.of(card, card, card), "vi", List.of(), Set.of(), totals)
                .reason()).isEqualTo("NONE");
    }

    @Test
    @DisplayName("CHAT_RULE_020: an explicit displayed-card count is allowed only when it equals attached cards")
    void validatesDisplayedCardCountSeparatelyFromCatalogTotals() {
        ChatProductCardResponse card = new ChatProductCardResponse(
                "helmet", "Helmet", null, BigDecimal.valueOf(2_000_000), null, "VND", "IN_STOCK");
        String displayed = "Dạ, em đang hiển thị 1 thẻ sản phẩm phù hợp bên dưới. "
                + "Anh/chị mở thẻ để xem thêm nhé.";

        assertThat(guard.check(displayed, List.of(card), "vi")).isPresent();
        assertThat(guard.check(displayed.replace("1 thẻ", "2 thẻ"), List.of(card), "vi")).isEmpty();
    }

    @Test
    @DisplayName("unsupported count clauses are replaced by the exact displayed-card count")
    void repairsOnlyUnsupportedNumericCountClause() {
        ChatProductCardResponse card = new ChatProductCardResponse(
                "helmet", "Helmet", null, BigDecimal.valueOf(2_000_000), null, "VND", "IN_STOCK");
        String unsafe = "Dạ, shop có 4 sản phẩm phù hợp. Anh/chị mở thẻ để xem thêm nhé.";

        assertThat(guard.repairUnsupportedCountClauses(unsafe, List.of(card), "vi", Set.of(), null))
                .map(ChatResponseGuard.CheckedAnswer::answer)
                .hasValueSatisfying(answer -> assertThat(answer).contains("hiển thị 1 thẻ").doesNotContain("4 sản phẩm"));
    }
}
