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
        assertThat(guard.check("I can help anh/chị. Please contact BigBike through Hotline, Zalo or Messenger. We are here to help.", List.of(), "en"))
                .isEmpty();
    }

    @Test
    @DisplayName("AC23/24/25 VI+EN: fabricated urgency, promises, social proof and raw option codes are blocked")
    void blocksFabricatedSalesClaimsInBothLanguages() {
        List<String> vietnamese = List.of(
                "Mẫu này sắp hết hàng, anh/chị chốt ngay nhé.",
                "Em sẽ giảm giá riêng cho anh/chị.",
                "Em giao đúng ngày mai cho anh/chị.",
                "Nhiều người đang xem và khách khác đánh giá tốt mẫu này.",
                "Màu tem-xam và ff327-den đang có sẵn.");
        List<String> english = List.of(
                "Only a few left, so buy this model now.",
                "I will discount this item for you.",
                "Guaranteed delivery tomorrow.",
                "Many people are viewing it and customers love this model.",
                "The ronin-red option is available.");

        assertThat(vietnamese).allMatch(copy -> guard.check(copy, List.of(), "vi").isEmpty());
        assertThat(english).allMatch(copy -> guard.check(copy, List.of(), "en").isEmpty());
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
                java.util.Collections.nCopies(8, valid), "vi")).isPresent();
        assertThat(guard.check("Mức giá này đang được áp dụng. Anh/chị mở sản phẩm để xem thêm. Em luôn sẵn sàng hỗ trợ.",
                java.util.Collections.nCopies(9, valid), "vi")).isEmpty();
    }

    @Test
    @DisplayName("CHAT_RULE_007: one sentence is valid and safe overlong copy is trimmed to 10")
    void enforcesSentenceRange() {
        assertThat(guard.check("Em đã kiểm tra sản phẩm này.", List.of(), "vi"))
                .as("one precise sentence is accepted").isPresent();
        assertThat(guard.check(
                "Em đã kiểm tra sản phẩm này đang bán. Anh/chị mở thẻ bên dưới để xem thêm nhé?",
                List.of(), "vi"))
                .as("two sentences reach the customer instead of falling back").isPresent();
        assertThat(guard.check(
                "Một. Hai. Ba. Bốn. Năm. Sáu. Bảy. Tám. Chín. Mười. Mười một.", List.of(), "vi"))
                .map(ChatResponseGuard.CheckedAnswer::answer)
                .hasValue("Một. Hai. Ba. Bốn. Năm. Sáu. Bảy. Tám. Chín. Mười.");
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
                "Chào em, em đang tìm sản phẩm nào? Anh/chị nói rõ giúp trợ lý nhé.", List.of(), "vi"))
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
        assertThat(guard.check(
                "Dạ, em cần anh/chị cho em biết loại hàng cần xem. Sau khi em tìm lại, em sẽ đưa phương án phù hợp.",
                List.of(), "vi")).isPresent();
        assertThat(guard.check(
                "Dạ, kết quả đến từ tìm kiếm rộng hơn yêu cầu ban đầu. Anh/chị nói rõ hơn để em thu hẹp nhé.",
                List.of(), "vi")).isPresent();
        assertThat(guard.rejectionReason(
                "Dạ, em đã kiểm tra yêu cầu này. Em có thể hỗ trợ thêm ngay.",
                List.of(), "vi", List.of(), Set.of())).isEqualTo("NONE");
        assertThat(guard.check(
                "I can help you find a product. Please tell me what you are looking for.", List.of(), "en"))
                .isPresent();
    }

    @Test
    @DisplayName("CHAT_RULE_007: every prepared bilingual reply family passes the response guard")
    void everyPreparedBilingualReplyFamilyPasses() {
        List<PreparedReply> replies = List.of(
                new PreparedReply("vi", "Dạ, em là Trợ lý BigBike, trợ lý AI của BigBike. "
                        + "Em có thể tìm sản phẩm đang bán, tra chính sách đã công bố hoặc xem đơn của tài khoản đang đăng nhập. "
                        + "Anh/chị cho em biết tên hàng, thương hiệu, danh mục hoặc tầm giá đang quan tâm nhé."),
                new PreparedReply("en", "I am BigBike Assistant, BigBike's AI shopping assistant. "
                        + "I can find currently sold products, check published policies, or view orders for a signed-in account. "
                        + "Please tell me the product, brand, category, or budget you are interested in."),
                new PreparedReply("vi", "Dạ, anh/chị đang cần loại sản phẩm nào hoặc muốn dùng cho nhu cầu gì ạ? "
                        + "Anh/chị cho em biết loại hàng và tầm giá để em kiểm tra đúng sản phẩm đang bán nhé."),
                new PreparedReply("en", "What type of product or riding need would you like help with? "
                        + "Tell me the item and budget, and I will check currently sold products without guessing."),
                new PreparedReply("vi", "Dạ, một số nhóm hàng chính của BigBike gồm Mũ bảo hiểm, Đồ bảo hộ và Phụ kiện. "
                        + "Anh/chị đang cần nhóm nào hoặc muốn dùng cho nhu cầu gì ạ?"),
                new PreparedReply("en", "BigBike's main product groups include Helmets, Protective gear and Accessories. "
                        + "Which group or riding need would you like help with?"),
                new PreparedReply("vi", "Dạ, anh/chị muốn so sánh hai hoặc ba mẫu nào ạ? "
                        + "Em sẽ chỉ dùng thông tin sản phẩm đã lưu."),
                new PreparedReply("en", "Which two or three models would you like to compare? "
                        + "I will use only the saved product information."),
                new PreparedReply("vi", "Dạ, em chưa lấy được thông tin phù hợp cho câu hỏi này nhưng anh/chị vẫn có thể hỏi tiếp. "
                        + "Anh/chị gửi tên mẫu, loại hàng hoặc chi tiết cần kiểm tra, em sẽ tra lại theo dữ liệu BigBike đang bán nhé."),
                new PreparedReply("en", "I could not complete that lookup yet. "
                        + "Please send the product name, product type or exact detail you want checked, and I will try again from the current BigBike catalogue."),
                new PreparedReply("vi", "Dạ, em cần anh/chị nói thêm loại hàng, tên mẫu hoặc tầm giá để lọc đúng dữ liệu BigBike đang bán. "
                        + "Anh/chị cho em biết rõ thêm một chi tiết giúp em nhé."),
                new PreparedReply("en", "I still need a little more detail to help with this. "
                        + "Please tell me the product type, model or price range, and I will filter the products currently sold by BigBike."),
                new PreparedReply("vi", "Dạ, tầm giá đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này. "
                        + "Các sản phẩm bên dưới là kết quả đang bán sau khi em tìm lại. "
                        + "Anh/chị cho em tầm giá mới nếu muốn em lọc hẹp lại nhé."),
                new PreparedReply("en", "The price filter from your previous product request returned no matches, so I removed only that older filter and searched this request again. "
                        + "The products below are the currently available results after that retry. "
                        + "Tell me a new budget if you would like me to narrow the list again."),
                new PreparedReply("vi", "Dạ, các sản phẩm bên dưới đến từ tìm kiếm rộng hơn yêu cầu ban đầu của anh/chị. "
                        + "Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé."),
                new PreparedReply("en", "The products below come from a broader search than your original request. "
                        + "Please tell me a more specific name, category or budget so I can narrow the results."),
                new PreparedReply("vi", "Dạ, Trợ lý BigBike đang tạm nghỉ. "
                        + "Anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ trực tiếp."),
                new PreparedReply("en", "BigBike Assistant is temporarily paused. "
                        + "Please contact BigBike through Hotline, Zalo or Messenger for direct help."),
                new PreparedReply("vi", "Dạ, Trợ lý BigBike đã dùng hết lượt tư vấn tự động trong hôm nay. "
                        + "Anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ trực tiếp."),
                new PreparedReply("en", "BigBike Assistant has reached today's automated-chat limit. "
                        + "Please contact BigBike through Hotline, Zalo or Messenger for direct help."),
                new PreparedReply("vi", "Dạ, em đã nhận đủ 40 lượt hỏi trong hội thoại này. "
                        + "Anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger để được hỗ trợ tiếp nhé."),
                new PreparedReply("en", "This conversation has reached its 40-question limit. "
                        + "Please contact BigBike through Hotline, Zalo or Messenger for help."),
                new PreparedReply("vi", "Dạ, em tóm tắt chính sách công bố của BigBike: yêu cầu đổi size hoặc đổi sản phẩm trong 7 ngày và hoàn tiền hoặc trả hàng trong 1 ngày, tùy điều kiện nguyên trạng đã nêu. "
                        + "Hàng sale và phí vận chuyển có điều kiện riêng. Anh/chị vui lòng mở trang Chính sách đổi trả hoặc liên hệ BigBike qua Hotline, Zalo hoặc Messenger trước khi gửi hàng về."),
                new PreparedReply("en", "BigBike's published policy allows a size or product exchange request within 7 days, and a refund or return request within 1 day, subject to the listed product-condition rules. "
                        + "Sale items and shipping responsibility have separate conditions. Please open the Returns and Exchanges Policy or contact BigBike through Hotline, Zalo or Messenger before sending anything back."),
                new PreparedReply("vi", "Dạ, em xác nhận BigBike bảo hành chính hãng theo chính sách từng thương hiệu; thời hạn cụ thể hiển thị trên trang sản phẩm. "
                        + "Va đập, tự ý sửa đổi và hao mòn tự nhiên không mặc nhiên thuộc diện bảo hành. Trường hợp phức tạp, anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger và gửi ảnh hoặc video giúp shop kiểm tra."),
                new PreparedReply("en", "BigBike provides genuine manufacturer warranty under each brand's policy, and the exact period is shown on each product page. "
                        + "Impact damage, modification and normal wear are not automatically covered. For a complex warranty case, please contact BigBike through Hotline, Zalo or Messenger and send photos or video."),
                new PreparedReply("vi", "Dạ, em xác nhận BigBike hiện hỗ trợ hai hình thức thanh toán thủ công: nhận hàng trả tiền và chuyển khoản ngân hàng. "
                        + "Em không nhận tiền và không chốt đơn thay anh/chị. Anh/chị vui lòng đi qua Giỏ hàng để chọn hình thức và kiểm tra lại trước khi xác nhận."),
                new PreparedReply("en", "BigBike currently supports two manual payment methods: cash on delivery and bank transfer. "
                        + "BigBike Assistant cannot take payment or place an order on your behalf. Please continue through the cart to choose a method and review the order before confirming."),
                new PreparedReply("vi", "Đơn online hiện không cộng phí vận chuyển vào tổng tiền và không có bước chọn hãng giao hàng khi thanh toán. "
                        + "Em không cam kết ngày giao vì hệ thống chưa có dữ liệu thời gian xác nhận. Anh/chị vui lòng liên hệ BigBike qua Hotline, Zalo hoặc Messenger nếu cần ước tính theo địa chỉ cụ thể."),
                new PreparedReply("en", "BigBike does not add a shipping fee to the current online order total, and there is no shipping-method selector at checkout. "
                        + "I cannot promise a delivery date because no confirmed timing data is available. Contact BigBike through Hotline, Zalo or Messenger for a destination-specific estimate.")
        );

        List<String> rejectedReplies = replies.stream()
                .filter(reply -> guard.check(reply.text(), List.of(), reply.lang()).isEmpty())
                .map(reply -> reply.lang() + ":"
                        + guard.rejectionReason(
                                reply.text(), List.of(), reply.lang(), List.of(), Set.of())
                        + ":" + reply.text())
                .toList();

        assertThat(rejectedReplies).isEmpty();
    }

    private record PreparedReply(String lang, String text) {}

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
        assertThat(guard.checkModel(
                "BigBike does not have any helmets. Please contact BigBike through Hotline, Zalo or Messenger for help.",
                List.of(),
                "en",
                List.of())).isEmpty();
        assertThat(guard.checkModel(
                "Dạ, BigBike không có bất kỳ sản phẩm mũ nào. Anh/chị vui lòng liên hệ qua Hotline, Zalo hoặc Messenger để được hỗ trợ nhé.",
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
        assertThat(guard.check(
                "Dạ, anh/chị muốn so sánh hai hoặc ba mẫu nào ạ? Em sẽ chỉ dùng thông tin sản phẩm đã lưu.",
                List.of(), "vi")).isPresent();
        assertThat(guard.check(
                "Dạ, BigBike có ba mẫu đang bán. Anh/chị chọn mẫu cần xem nhé.",
                List.of(), "vi")).isEmpty();
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
        String displayed = "Dạ, em đang hiển thị 1 sản phẩm phù hợp bên dưới. "
                + "Anh/chị mở sản phẩm để xem thêm nhé.";

        assertThat(guard.check(displayed, List.of(card), "vi")).isPresent();
        assertThat(guard.check(
                displayed.replace("1 sản phẩm", "2 sản phẩm"), List.of(card), "vi")).isEmpty();
    }

    @Test
    @DisplayName("CHAT_RULE_005/017: model facts from history require current-turn tool evidence")
    void rejectsHistoryDerivedFactWithoutCurrentToolEvidence() {
        ChatProductCardResponse card = new ChatProductCardResponse(
                "tanami", "Mũ bảo hiểm Tanami", null,
                BigDecimal.valueOf(12_000_000), null, "VND", "IN_STOCK");
        String answer = "Dạ, Mũ bảo hiểm Tanami hiện còn hàng. "
                + "Anh/chị mở sản phẩm để xem các lựa chọn đã xác minh nhé.";

        assertThat(guard.checkModel(
                answer, List.of(card), "vi", List.of(), Set.of(), null, List.of()))
                .isEmpty();
        assertThat(guard.checkModel(
                answer, List.of(card), "vi", List.of(), Set.of(), null,
                List.of(ChatToolRegistry.GET_PRODUCT)))
                .isPresent();
    }

    @Test
    @DisplayName("unsupported count clauses are replaced by the exact displayed-card count")
    void repairsOnlyUnsupportedNumericCountClause() {
        ChatProductCardResponse card = new ChatProductCardResponse(
                "helmet", "Helmet", null, BigDecimal.valueOf(2_000_000), null, "VND", "IN_STOCK");
        String unsafe = "Dạ, shop có 4 sản phẩm phù hợp. Anh/chị mở thẻ để xem thêm nhé.";

        assertThat(guard.repairUnsupportedCountClauses(unsafe, List.of(card), "vi", Set.of(), null))
                .map(ChatResponseGuard.CheckedAnswer::answer)
                .hasValueSatisfying(answer -> assertThat(answer)
                        .contains("hiển thị 1 sản phẩm").doesNotContain("4 sản phẩm"));
    }
}
