package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatHandoffEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatHandoffJpaRepository;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

@Service
@RequiredArgsConstructor
public class ChatHandoffEmailService {

    private final ChatHandoffJpaRepository handoffRepo;
    private final ChatHandoffSettings settings;
    private final EmailDispatchService emailDispatch;

    @Value("${bigbike.admin.base-url:https://admin.bigbike.vn}")
    private String adminBaseUrl;

    @Async
    @Transactional(readOnly = true)
    public void send(UUID handoffId) {
        ChatHandoffSettings.Snapshot current = settings.load();
        if (!current.emailEnabled() || current.recipient() == null
                || current.recipient().isBlank() || !emailDispatch.isEnabled()) {
            return;
        }
        ChatHandoffEntity handoff = handoffRepo.findById(handoffId).orElse(null);
        if (handoff == null) return;

        Context context = new Context();
        context.setVariable("question", blankFallback(handoff.getQuestionSummary(), "Chưa có câu hỏi"));
        context.setVariable("products", ChatHandoffProductJson.read(handoff.getProductsJson()));
        context.setVariable("customerKind", "SIGNED_IN".equals(handoff.getCustomerKind())
                ? "Khách đã đăng nhập" : "Khách lạ");
        context.setVariable("adminChatUrl", adminBaseUrl + "/admin/chat/" + handoff.getConversationId());
        emailDispatch.send(
                current.recipient(),
                "[BigBike] Khách đang chờ gặp nhân viên",
                "admin-chat-handoff",
                context);
    }

    private static String blankFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
