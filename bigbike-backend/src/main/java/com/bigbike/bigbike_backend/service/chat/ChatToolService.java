package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatProductCardResponse;
import com.bigbike.bigbike_backend.api.order.dto.OrderListItemResponse;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlight;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariant;
import com.bigbike.bigbike_backend.domain.catalog.ProductVariantOption;
import com.bigbike.bigbike_backend.service.catalog.CatalogReadService;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.order.OrderReadService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Fixed, read-only tool allowlist for Bi. No tool accepts SQL, table names or customer identity. */
@Service
@RequiredArgsConstructor
public class ChatToolService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Pattern PRODUCT_URL = Pattern.compile(
            "/(?:product|san-pham|sp)/([a-z0-9-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MILLION = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:triệu|trieu|tr|million)");
    private static final Pattern THOUSAND = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:nghìn|nghin|ngàn|ngan|k)\\b");

    private final CatalogReadService catalogReadService;
    private final OrderReadService orderReadService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ToolOutcome resolve(
            String question,
            String lang,
            UUID customerId,
            ChatAssistantSettings.Snapshot settings
    ) {
        String normalized = normalize(question);
        boolean english = "en".equals(lang);

        if (isLeadDecline(normalized)) {
            return ToolOutcome.local(
                    english
                            ? "No problem — I won’t ask for your contact details again. You can keep chatting with me or choose Talk to staff at any time."
                            : "Dạ không sao ạ, em sẽ không hỏi lại thông tin liên hệ. Anh/chị vẫn có thể hỏi tiếp hoặc bấm Gặp nhân viên bất cứ lúc nào.",
                    "TEMPLATE", false, false, true);
        }
        if (isHumanHandoff(normalized)) {
            return ToolOutcome.local(
                    english
                            ? "This request needs a BigBike staff member to review it directly. Please choose Talk to staff below so the team can help without making an unsupported promise. I’ll keep the contact options available."
                            : "Trường hợp này cần nhân viên BigBike kiểm tra trực tiếp để hỗ trợ đúng chính sách. Anh/chị bấm Gặp nhân viên bên dưới giúp em nhé; em không tự hứa giảm giá, ngày giao hoặc ngoại lệ đổi trả. Các kênh liên hệ luôn được giữ sẵn.",
                    "TEMPLATE", false, true, false);
        }
        if (isOrderQuestion(normalized)) {
            return orderOutcome(customerId, english);
        }
        if (isShopInfoQuestion(normalized)) {
            return shopInfoOutcome(settings, english);
        }
        if (isPolicyQuestion(normalized)) {
            return policyOutcome(normalized, english);
        }
        if (isKnownOffTopic(normalized)) {
            return ToolOutcome.local(
                    english
                            ? "I can only help with products currently sold by BigBike, store policies and your signed-in orders. I can’t advise on motorcycles, politics or topics outside the shop. Please choose Talk to staff if you need other help from BigBike."
                            : "Em chỉ hỗ trợ sản phẩm BigBike đang bán, chính sách cửa hàng và đơn của tài khoản đã đăng nhập. Em không tư vấn xe, chính trị hoặc nội dung ngoài phạm vi shop. Anh/chị có thể bấm Gặp nhân viên nếu cần BigBike hỗ trợ việc khác.",
                    "TEMPLATE", true, false, false);
        }
        return productOutcome(question, normalized, lang, english);
    }

    private ToolOutcome productOutcome(
            String question, String normalized, String lang, boolean english) {
        Long maxPrice = extractMaxPrice(normalized);
        String query = extractProductQuery(question);
        PageResult<Product> page = search(query, maxPrice, lang);
        if (page.items().isEmpty()) {
            String fallback = fallbackProductQuery(normalized);
            if (!fallback.equalsIgnoreCase(query)) page = search(fallback, maxPrice, lang);
        }
        if (page.items().isEmpty()) {
            return ToolOutcome.local(
                    english
                            ? "I couldn’t find a currently published BigBike product matching that request. I won’t guess a product, price or stock status. Please try a shorter product name or choose Talk to staff."
                            : "Em chưa tìm thấy sản phẩm đang bán phù hợp với yêu cầu này trên BigBike. Em không đoán tên hàng, giá hoặc tình trạng kho. Anh/chị thử nhập tên sản phẩm ngắn hơn hoặc bấm Gặp nhân viên giúp em nhé.",
                    "TOOL", false, true, false);
        }

        List<Product> products = page.items().stream().limit(5).toList();
        List<ChatProductCardResponse> cards = products.stream()
                .limit(3)
                .map(ChatToolService::toCard)
                .toList();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tool", "search_products");
        payload.put("arguments", Map.of(
                "q", query,
                "max_price", maxPrice == null ? "" : maxPrice,
                "lang", lang));
        payload.put("results", products.stream().map(ChatToolService::productSummary).toList());

        if (asksForProductDetail(normalized)) {
            Product detail = catalogReadService.getProductBySlug(products.get(0).slug(), lang);
            payload.put("detailTool", "get_product");
            payload.put("detail", productDetail(detail));
        }

        return ToolOutcome.ai(toJson(payload), cards);
    }

    private PageResult<Product> search(String query, Long maxPrice, String lang) {
        return searchProducts(query, null, null, null, maxPrice, null, null, lang);
    }

    PageResult<Product> searchProducts(
            String query,
            String category,
            String brand,
            Long minPrice,
            Long maxPrice,
            String color,
            String gender,
            String lang
    ) {
        return catalogReadService.listProducts(
                1, 5, "price:asc", blankToNull(category), blankToNull(brand), blankToNull(query),
                blankToNull(color), blankToNull(gender), minPrice, maxPrice, null, lang);
    }

    private ToolOutcome orderOutcome(UUID customerId, boolean english) {
        if (customerId == null) {
            return ToolOutcome.local(
                    english
                            ? "I can only read orders from a signed-in BigBike account. Please sign in and ask again; guest orders can be checked on the existing order lookup page using the order number and order key. I won’t ask for an email or customer id in chat."
                            : "Em chỉ xem được đơn của tài khoản BigBike đang đăng nhập. Anh/chị đăng nhập rồi hỏi lại giúp em; đơn khách vãng lai vui lòng dùng trang Tra cứu đơn hàng có sẵn với mã đơn và khóa đơn. Em không nhận email hay mã khách hàng qua chat.",
                    "TOOL", false, false, false);
        }

        List<OrderListItemResponse> orders = orderReadService
                .listCustomerOrders(customerId, 1, 5, null).items();
        if (orders.isEmpty()) {
            return ToolOutcome.local(
                    english
                            ? "This signed-in account does not have any orders yet. I only checked the current server session and did not use an email or customer id from chat. You can choose Talk to staff if an order appears to be missing."
                            : "Tài khoản đang đăng nhập chưa có đơn hàng nào. Em chỉ kiểm tra phiên đăng nhập trên máy chủ, không dùng email hay mã khách gửi trong chat. Nếu anh/chị thấy thiếu đơn, vui lòng bấm Gặp nhân viên.",
                    "TOOL", false, false, false);
        }

        List<String> lines = orders.stream().map(order -> {
            String date = order.placedAt() == null
                    ? (english ? "date unavailable" : "chưa có ngày đặt")
                    : DATE.format(order.placedAt().atZone(VN_ZONE));
            String amount = order.totalAmount() == null
                    ? (english ? "total unavailable" : "chưa có tổng tiền")
                    : order.totalAmount().toPlainString() + " " + order.currency();
            return order.orderNumber() + " — " + order.status() + " — " + date + " — " + amount;
        }).toList();
        String answer = english
                ? "Here are the latest orders from this signed-in account: " + String.join("; ", lines)
                        + ". I’m showing only status, order date and total. Open your account order page for more details."
                : "Các đơn gần nhất của tài khoản đang đăng nhập: " + String.join("; ", lines)
                        + ". Em chỉ hiển thị tình trạng, ngày đặt và tổng tiền. Anh/chị mở trang Đơn hàng trong tài khoản để xem thêm.",
                source = "TOOL";
        return ToolOutcome.local(answer, source, false, false, false);
    }

    private static ToolOutcome shopInfoOutcome(
            ChatAssistantSettings.Snapshot settings, boolean english) {
        var contacts = settings.contacts();
        List<String> parts = new ArrayList<>();
        if (contacts.hotline() != null && !contacts.hotline().isBlank()) {
            parts.add("Hotline: " + contacts.hotline());
        }
        if (contacts.zaloDisplay() != null && !contacts.zaloDisplay().isBlank()) {
            parts.add("Zalo: " + contacts.zaloDisplay());
        }
        if (!settings.address().isBlank()) {
            parts.add((english ? "Address: " : "Địa chỉ: ") + settings.address());
        }
        List<String> openingHours = new ArrayList<>();
        if (!settings.openingHoursWeekday().isBlank()) openingHours.add(settings.openingHoursWeekday());
        if (!settings.openingHoursWeekend().isBlank()) openingHours.add(settings.openingHoursWeekend());
        if (!openingHours.isEmpty()) {
            parts.add((english ? "Opening hours: " : "Giờ mở cửa: ") + String.join("; ", openingHours));
        }
        String details = parts.isEmpty()
                ? (english ? "contact details are not available" : "chưa có dữ liệu liên hệ")
                : String.join("; ", parts);
        return ToolOutcome.local(
                english
                        ? "BigBike’s current contact information is: " + details
                                + ". Please choose Talk to staff for a direct conversation."
                        : "Thông tin liên hệ hiện có của BigBike: " + details
                                + ". Anh/chị có thể bấm Gặp nhân viên để trao đổi trực tiếp.",
                "TEMPLATE", false, false, false);
    }

    private static ToolOutcome policyOutcome(String normalized, boolean english) {
        String answer;
        if (containsAny(normalized, "doi tra", "return", "exchange")) {
            answer = english
                    ? "BigBike’s published policy allows a size/product exchange request within 7 days, and a refund/return request within 1 day, subject to the listed product-condition rules. Sale items and shipping responsibility have separate conditions. Please open the Returns and Exchanges Policy or choose Talk to staff before sending anything back."
                    : "Chính sách công bố của BigBike cho phép yêu cầu đổi size/đổi sản phẩm trong 7 ngày và yêu cầu hoàn tiền/trả hàng trong 1 ngày, tùy điều kiện nguyên trạng đã nêu. Hàng sale và phí vận chuyển có điều kiện riêng. Anh/chị vui lòng mở trang Chính sách đổi trả hoặc bấm Gặp nhân viên trước khi gửi hàng về.";
        } else if (containsAny(normalized, "bao hanh", "warranty")) {
            answer = english
                    ? "BigBike provides genuine manufacturer warranty under each brand’s policy, and the exact period is shown on each product page. Impact damage, modification and normal wear are not automatically covered. For a complex warranty case, please choose Talk to staff and send photos or video."
                    : "BigBike bảo hành chính hãng theo chính sách từng thương hiệu; thời hạn cụ thể hiển thị trên trang sản phẩm. Va đập, tự ý sửa đổi và hao mòn tự nhiên không mặc nhiên thuộc diện bảo hành. Trường hợp phức tạp, anh/chị bấm Gặp nhân viên và gửi ảnh/video giúp shop kiểm tra.";
        } else if (containsAny(normalized, "size", "kich co", "do size")) {
            answer = english
                    ? "Please use the helmet or protective-clothing size guide and compare your actual measurement with the product’s own size table when available. Some products do not yet have a size table, so I won’t infer a size from height or weight alone. Choose Talk to staff if you want BigBike to confirm the fit."
                    : "Anh/chị dùng hướng dẫn đo size mũ hoặc trang phục và đối chiếu số đo thật với bảng size riêng của sản phẩm nếu có. Một số sản phẩm chưa nhập bảng size nên em không suy ra size chỉ từ chiều cao/cân nặng. Anh/chị bấm Gặp nhân viên nếu muốn BigBike xác nhận thêm.";
        } else if (containsAny(normalized, "thanh toan", "payment")) {
            answer = english
                    ? "Storefront checkout currently uses cash on delivery (COD). Bi cannot take payment or place an order on your behalf. Please continue through the cart to review the order before confirming."
                    : "Thanh toán trên website hiện dùng hình thức COD khi nhận hàng. Bi không nhận tiền và không chốt đơn thay anh/chị. Anh/chị vui lòng đi qua Giỏ hàng để kiểm tra lại trước khi xác nhận.";
        } else {
            answer = english
                    ? "BigBike does not add a shipping fee to the current online order total, and there is no shipping-method selector at checkout. I can’t promise a delivery date because no confirmed timing data is available. Choose Talk to staff for a destination-specific estimate."
                    : "Đơn online hiện không cộng phí vận chuyển vào tổng tiền và không có bước chọn hãng giao hàng khi thanh toán. Em không cam kết ngày giao vì hệ thống chưa có dữ liệu thời gian xác nhận. Anh/chị bấm Gặp nhân viên nếu cần ước tính theo địa chỉ cụ thể.";
        }
        return ToolOutcome.local(answer, "TEMPLATE", false, false, false);
    }

    private static Map<String, Object> productSummary(Product product) {
        ChatProductCardResponse card = toCard(product);
        return Map.of(
                "slug", nullToEmpty(card.slug()),
                "name", nullToEmpty(card.name()),
                "retailPrice", card.retailPrice() == null ? "" : card.retailPrice(),
                "salePrice", card.salePrice() == null ? "" : card.salePrice(),
                "currency", nullToEmpty(card.currency()),
                "stockState", nullToEmpty(card.stockState()));
    }

    private static Map<String, Object> productDetail(Product product) {
        Map<String, Object> detail = new LinkedHashMap<>(productSummary(product));
        detail.put("shortDescription", plain(product.shortDescription(), 800));
        detail.put("description", plain(product.description(), 1800));
        detail.put("specifications", plain(product.specifications(), 1800));
        detail.put("sizeGuide", plain(product.sizeGuide(), 1200));
        detail.put("pros", highlights(product, true));
        detail.put("cons", highlights(product, false));
        detail.put("faqs", product.faqs() == null ? List.of() : product.faqs().stream()
                .limit(5)
                .map(ChatToolService::faq)
                .toList());
        detail.put("availableOptions", normalizedAvailableOptions(product.variants()));
        detail.put("availableVariants", normalizedAvailableVariants(product.variants()));
        return detail;
    }

    private static List<String> highlights(Product product, boolean positive) {
        if (product.highlights() == null) return List.of();
        List<ProductHighlight> values = positive
                ? product.highlights().positiveNotes()
                : product.highlights().negativeNotes();
        return values == null ? List.of() : values.stream()
                .map(ProductHighlight::content)
                .filter(value -> value != null && !value.isBlank())
                .limit(5)
                .toList();
    }

    private static Map<String, String> faq(ProductFaq faq) {
        return Map.of("question", nullToEmpty(faq.question()), "answer", nullToEmpty(faq.answer()));
    }

    private static Map<String, List<String>> normalizedAvailableOptions(List<ProductVariant> variants) {
        if (variants == null) return Map.of();
        Map<String, Set<String>> grouped = new LinkedHashMap<>();
        variants.stream().filter(ProductVariant::isAvailable).forEach(variant -> {
            if (variant.options() == null) return;
            for (ProductVariantOption option : variant.options()) {
                String key = canonicalAttribute(option.name());
                grouped.computeIfAbsent(key, ignored -> new LinkedHashSet<>()).add(option.value());
            }
        });
        Map<String, List<String>> result = new LinkedHashMap<>();
        grouped.forEach((key, values) -> result.put(key, List.copyOf(values)));
        return result;
    }

    static List<Map<String, String>> normalizedAvailableVariants(List<ProductVariant> variants) {
        if (variants == null) return List.of();
        return variants.stream()
                .filter(ProductVariant::isAvailable)
                .filter(variant -> variant.options() != null && !variant.options().isEmpty())
                .limit(50)
                .map(variant -> {
                    Map<String, String> combination = new LinkedHashMap<>();
                    for (ProductVariantOption option : variant.options()) {
                        String key = canonicalAttribute(option.name());
                        String value = option.value() == null ? "" : option.value().trim();
                        if (!key.isBlank() && !value.isBlank()) combination.put(key, value);
                    }
                    return Map.copyOf(combination);
                })
                .filter(combination -> !combination.isEmpty())
                .distinct()
                .toList();
    }

    private static String canonicalAttribute(String raw) {
        String normalized = normalize(raw);
        if (normalized.equals("mau") || normalized.equals("mau sac") || normalized.equals("color")) {
            return "color";
        }
        if (normalized.equals("size") || normalized.equals("kich co")) return "size";
        if (normalized.equals("model")) return "model";
        return normalized;
    }

    private static ChatProductCardResponse toCard(Product product) {
        return new ChatProductCardResponse(
                product.slug(),
                product.name(),
                product.image() == null ? null : product.image().url(),
                product.price() == null ? null : product.price().retailPrice(),
                product.price() == null ? null : product.price().salePrice(),
                product.price() == null ? "VND" : product.price().currency(),
                product.stockState() == null ? null : product.stockState().name());
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private static String extractProductQuery(String question) {
        Matcher slug = PRODUCT_URL.matcher(question);
        if (slug.find()) return slug.group(1);
        String cleaned = question
                .replaceAll("(?iu)(cho em|giúp em|giup em|tìm|tim|tư vấn|tu van|please|find me|show me)", " ")
                .replaceAll("(?iu)(trọng lượng|trong luong|nặng bao nhiêu|nang bao nhieu|weight|thông số|thong so|specifications?)", " ")
                .replaceAll("(?iu)(tầm|tam|khoảng|khoang|dưới|duoi|đổ lại|do lai|under|below).*$", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return cleaned.length() > 100 ? cleaned.substring(0, 100) : cleaned;
    }

    private static String fallbackProductQuery(String normalized) {
        if (normalized.contains("3/4")) return "3/4";
        if (normalized.contains("fullface")) return "fullface";
        if (normalized.contains("lat ham")) return "lật hàm";
        if (containsAny(normalized, "mu", "helmet")) return "mũ";
        if (containsAny(normalized, "gang", "glove")) return "găng";
        if (containsAny(normalized, "ao", "jacket")) return "áo";
        return "";
    }

    private static Long extractMaxPrice(String normalized) {
        Matcher million = MILLION.matcher(normalized);
        if (million.find()) {
            BigDecimal value = new BigDecimal(million.group(1).replace(',', '.'));
            if (normalized.contains("ruoi")) value = value.add(new BigDecimal("0.5"));
            return value.multiply(BigDecimal.valueOf(1_000_000)).longValue();
        }
        Matcher thousand = THOUSAND.matcher(normalized);
        if (thousand.find()) {
            return new BigDecimal(thousand.group(1).replace(',', '.'))
                    .multiply(BigDecimal.valueOf(1_000)).longValue();
        }
        return null;
    }

    static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static boolean asksForProductDetail(String value) {
        return containsAny(value, "trong luong", "nang", "weight", "thong so", "spec", "faq", "kich co", "size");
    }

    private static boolean isOrderQuestion(String value) {
        return containsAny(value, "don hang", "don cua toi", "my order", "order status");
    }

    private static boolean isShopInfoQuestion(String value) {
        return containsAny(value, "dia chi", "gio mo cua", "hotline", "address", "opening hour", "contact");
    }

    private static boolean isPolicyQuestion(String value) {
        return containsAny(value, "bao hanh", "doi tra", "phi ship", "giao hang", "thanh toan", "chon size", "do size",
                "warranty", "return", "exchange", "shipping", "payment", "size guide");
    }

    private static boolean isHumanHandoff(String value) {
        return containsAny(value, "khieu nai", "complaint", "thuong luong", "giam gia them", "deal gia", "bao hanh phuc tap");
    }

    private static boolean isKnownOffTopic(String value) {
        return containsAny(value, "chinh tri", "politic", "bau cu", "election", "tu van xe", "mua xe nao", "sua xe", "engine repair");
    }

    private static boolean isLeadDecline(String value) {
        return containsAny(value, "khong can lien he", "khong de lai so", "no thanks", "do not contact");
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private static String plain(String html, int max) {
        if (html == null || html.isBlank()) return "";
        String text = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public record ToolOutcome(
            boolean aiRequired,
            String localAnswer,
            String source,
            String toolJson,
            List<ChatProductCardResponse> products,
            boolean offTopic,
            boolean handoffRecommended,
            boolean leadDeclined
    ) {
        static ToolOutcome ai(String toolJson, List<ChatProductCardResponse> products) {
            return new ToolOutcome(true, null, "AI", toolJson, List.copyOf(products), false, false, false);
        }

        static ToolOutcome local(
                String answer, String source, boolean offTopic, boolean handoff, boolean leadDeclined) {
            return new ToolOutcome(false, answer, source, "{}", List.of(), offTopic, handoff, leadDeclined);
        }
    }
}
