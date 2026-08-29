package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageRequest {

    private UUID conversationId;

    /** Disclosed first-party memory token; never derived from browser fingerprint or IP. */
    @Size(max = 128)
    private String visitorToken;

    /** Optional for legacy clients; new clients reuse it when retrying one logical turn. */
    private UUID requestId;

    @Valid
    private ChatPageContextRequest pageContext;

    /** Optional quick-choice metadata. The visible option label remains the customer message. */
    @Valid
    private ChatClarificationSelectionRequest clarificationSelection;

    @Size(max = 1000, message = "Tin nhắn không được dài quá 1.000 ký tự.")
    private String message;

    @Size(max = 1, message = "Mỗi lượt chỉ gửi được một ảnh.")
    private List<UUID> imageIds;

    @NotBlank(message = "Ngôn ngữ không được để trống.")
    @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.")
    private String lang;

    @AssertTrue(message = "Tin nhắn hoặc ảnh không được để trống.")
    public boolean isMessageOrImageProvided() {
        return (message != null && !message.isBlank()) || (imageIds != null && !imageIds.isEmpty());
    }
}
