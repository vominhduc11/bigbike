package com.bigbike.bigbike_backend.service.chat;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/** Conservative, local pre-provider guard. It never logs or returns the submitted text. */
@Component
public class ChatInputGuard {

    private static final Pattern ROLE_ATTACK = Pattern.compile(
            "(?i)(ignore (?:all |the )?(?:previous|system)|reveal (?:your )?(?:prompt|instructions)|"
                    + "you are now|developer message|system prompt|bỏ qua (?:mọi )?(?:hướng dẫn|chỉ dẫn)|"
                    + "tiết lộ (?:prompt|chỉ dẫn)|đóng vai (?:một )?(?:hacker|ai khác))");
    private static final Pattern ADULT = Pattern.compile(
            "(?i)(porn|sex video|nude|xxx|khiêu dâm|ảnh nóng|quan hệ tình dục)");
    private static final Pattern SELF_HARM = Pattern.compile(
            "(?i)(suicide|kill myself|self[- ]harm|tự tử|tự sát|tự hại|cắt cổ tay|làm hại bản thân)");
    private static final Pattern MALICIOUS_INTENT = Pattern.compile(
            "(?i)((?:cách|hướng dẫn(?: tôi)?|chỉ tôi|how to|want to|muốn)\\s+(?:giết|đâm|đánh|gây thương|"
                    + "chế bom|lừa đảo|hack|đánh cắp)|(?:kill|stab|injure|make a bomb|steal credentials))");
    private static final Pattern ABUSE = Pattern.compile(
            "(?i)(đồ ngu|cút đi|fuck you|you are stupid|địt mẹ)");
    private static final Pattern CLEARLY_OUT_OF_SCOPE = Pattern.compile(
            "(?i)(dự báo thời tiết|weather forecast|viết code|write code|giải bài tập|solve my homework|"
                    + "công thức nấu ăn|recipe for|tin chính trị|political news|tỷ giá hôm nay|exchange rate today)");

    public Optional<Decision> evaluate(String text, String lang) {
        if (text == null || text.isBlank()) return Optional.empty();
        String value = text.trim().toLowerCase(Locale.ROOT);
        boolean english = "en".equals(lang);
        if (ROLE_ATTACK.matcher(value).find()) {
            return Optional.of(new Decision(
                    "ROLE_DEFENSE",
                    english
                            ? "I can only help with BigBike products, store policies and supported shopping tasks. Please tell me what product or shopping information you need."
                            : "Em chỉ hỗ trợ sản phẩm, chính sách và các nhu cầu mua sắm tại BigBike. Anh/chị cho em biết sản phẩm hoặc thông tin mua hàng cần hỗ trợ nhé."));
        }
        if (SELF_HARM.matcher(value).find()) {
            return Optional.of(new Decision(
                    "CONTENT_REFUSAL",
                    english
                            ? "I cannot help with self-harm. If you may be in immediate danger, please contact local emergency services or a trusted person near you now."
                            : "Em không thể hỗ trợ nội dung tự làm hại bản thân. Nếu anh/chị có nguy cơ ngay lúc này, hãy liên hệ dịch vụ khẩn cấp tại địa phương hoặc một người đáng tin đang ở gần ngay nhé."));
        }
        if (ADULT.matcher(value).find() || MALICIOUS_INTENT.matcher(value).find()
                || ABUSE.matcher(value).find()) {
            return Optional.of(new Decision(
                    "CONTENT_REFUSAL",
                    english
                            ? "I cannot help with that content. I can still assist with BigBike products, protective gear and store policies."
                            : "Em không thể hỗ trợ nội dung này. Em vẫn có thể tư vấn sản phẩm, đồ bảo hộ và chính sách của BigBike."));
        }
        if (CLEARLY_OUT_OF_SCOPE.matcher(value).find()) {
            return Optional.of(new Decision(
                    "OUT_OF_SCOPE",
                    english
                            ? "That is outside BigBike Assistant's scope. I can help with products, sizing, availability and BigBike store policies."
                            : "Nội dung này nằm ngoài phạm vi của Trợ lý BigBike. Em có thể hỗ trợ sản phẩm, chọn size, tình trạng hàng và chính sách của BigBike."));
        }
        return Optional.empty();
    }

    public record Decision(String source, String answer) {}
}
