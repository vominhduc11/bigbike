package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.email.InternalMailRecipient;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ChatHandoffSettings {

    private static final Pattern EMAIL = Pattern.compile(
            "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);

    private final SiteSettingJpaRepository settingRepo;
    private final InternalMailRecipient internalMailRecipient;

    @Transactional(readOnly = true)
    public Snapshot load() {
        boolean enabled = settingRepo.findBySettingKey("ai_assistant_handoff_email_enabled")
                .map(item -> "true".equalsIgnoreCase(item.getSettingValue()))
                .orElse(true);
        String configured = settingRepo.findBySettingKey("ai_assistant_handoff_email_recipient")
                .map(item -> item.getSettingValue() == null ? "" : item.getSettingValue().trim())
                .orElse("");
        String recipient = EMAIL.matcher(configured).matches()
                ? configured
                : internalMailRecipient.address();
        return new Snapshot(enabled, recipient);
    }

    public record Snapshot(boolean emailEnabled, String recipient) {}
}
