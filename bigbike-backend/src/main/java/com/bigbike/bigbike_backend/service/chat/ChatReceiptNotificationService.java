package com.bigbike.bigbike_backend.service.chat;

import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** Only a private transcript reference is forwarded. No payment or order write exists here. */
@Service
@RequiredArgsConstructor
public class ChatReceiptNotificationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void receive(UUID conversationId, UUID messageId) {
        Boolean valid = jdbc.queryForObject("""
                select exists(select 1 from chat_messages m where m.id = ? and m.conversation_id = ?
                  and m.role = 'CUSTOMER' and exists(select 1 from chat_images i
                    where i.customer_message_id = m.id and i.intent_code = 'BANK_TRANSFER_RECEIPT'
                      and i.status = 'READY' and i.deleted_at is null))
                """, Boolean.class, messageId, conversationId);
        if (!Boolean.TRUE.equals(valid)) throw new IllegalArgumentException("Receipt message is unavailable");
        String payload = mapper.writeValueAsString(Map.of("schemaVersion", 1,
                "conversationId", conversationId, "messageId", messageId));
        jdbc.update("""
                insert into admin_notifications(id, type, chat_message_id, payload, created_at)
                values (?, 'CHAT_BANK_TRANSFER_RECEIPT', ?, ?, now())
                on conflict (chat_message_id) where chat_message_id is not null do nothing
                """, UUID.randomUUID(), messageId, payload);
    }
}
