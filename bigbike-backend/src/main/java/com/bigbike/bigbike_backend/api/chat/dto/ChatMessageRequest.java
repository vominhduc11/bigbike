package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
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

    /** Optional for legacy clients; new clients reuse it when retrying one logical turn. */
    private UUID requestId;

    @NotBlank(message = "Tin nhắn không được để trống.")
    @Size(max = 1000, message = "Tin nhắn không được dài quá 1.000 ký tự.")
    private String message;

    @NotBlank(message = "Ngôn ngữ không được để trống.")
    @Pattern(regexp = "^(vi|en)$", message = "Ngôn ngữ phải là vi hoặc en.")
    private String lang;
}
