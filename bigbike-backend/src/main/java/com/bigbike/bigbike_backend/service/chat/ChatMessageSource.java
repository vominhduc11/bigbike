package com.bigbike.bigbike_backend.service.chat;

import java.util.Set;

/**
 * Nguồn chân lý duy nhất cho cột {@code chat_messages.source}.
 *
 * <p>Danh sách này phải luôn khớp ràng buộc {@code ck_chat_message_source} trong Flyway
 * (bản mới nhất: {@code V1080__chat_message_source_and_session_memory.sql}). Bộ test mặc định
 * chạy trên H2 với Flyway tắt nên không thấy ràng buộc CHECK — vì vậy
 * {@code ChatMessageSourcePostgresTest} đối chiếu tập hằng số này với schema PostgreSQL thật.
 * Thêm giá trị mới ở đây mà quên migration sẽ làm khách mất trắng câu trả lời
 * (xem docs/engineering/DATA_CONTRACT.md, mục {@code chat_messages}).
 */
public final class ChatMessageSource {

    /** Câu trả lời do model sinh ra và đã qua lớp an toàn. */
    public static final String AI = "AI";
    /** Câu trả lời tất định do backend soạn: chào, chính sách, thông tin cửa hàng, từ chối lịch sự. */
    public static final String RULE = "RULE";
    /** Câu trả lời dựng từ mẫu có tham số. */
    public static final String TEMPLATE = "TEMPLATE";
    /** Câu trả lời dựng từ kết quả công cụ đọc catalog/policy. */
    public static final String TOOL = "TOOL";
    /** Câu mời khách tự liên hệ Hotline/Zalo/Messenger. */
    public static final String CONTACT_FALLBACK = "CONTACT_FALLBACK";
    /** Câu xin lỗi khi nhà cung cấp AI không trả lời được sau các lần thử hợp lệ. */
    public static final String PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE";
    /** Câu từ chối vì câu hỏi nằm ngoài phạm vi bán hàng. */
    public static final String OUT_OF_SCOPE = "OUT_OF_SCOPE";
    /** Câu từ chối vì nội dung không phù hợp. */
    public static final String CONTENT_REFUSAL = "CONTENT_REFUSAL";
    /** Câu giữ vai trò khi khách yêu cầu trợ lý đóng vai khác. */
    public static final String ROLE_DEFENSE = "ROLE_DEFENSE";

    public static final Set<String> ALLOWED = Set.of(
            AI, RULE, TEMPLATE, TOOL, CONTACT_FALLBACK,
            PROVIDER_UNAVAILABLE, OUT_OF_SCOPE, CONTENT_REFUSAL, ROLE_DEFENSE);

    private ChatMessageSource() {
    }

    /** Chặn ngay tại biên lưu trữ để một giá trị lạ không âm thầm thành lỗi CSDL. */
    public static String require(String source) {
        if (source == null || !ALLOWED.contains(source)) {
            throw new IllegalArgumentException(
                    "Nguồn tin nhắn chat không hợp lệ: " + source
                            + ". Giá trị hợp lệ: " + ALLOWED);
        }
        return source;
    }
}
