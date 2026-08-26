package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
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
public class ChatLeadRequest {

    @NotNull(message = "Thiếu mã hội thoại.")
    private UUID conversationId;

    @Size(max = 128)
    private String visitorToken;

    private String name;

    private String phone;

    private String note;

    @Builder.Default
    @NotNull(message = "Thiếu nguồn thông tin liên hệ.")
    @Pattern(regexp = "^(FORM|ACCOUNT)$", message = "Nguồn thông tin liên hệ không hợp lệ.")
    private String contactSource = "FORM";

    @AssertTrue(message = "Khách phải đồng ý trước khi lưu thông tin liên hệ.")
    private boolean consent;

    /**
     * Account capture deliberately ignores all browser-supplied contact fields. Keep their
     * validation conditional as well, so a hostile payload cannot influence that branch by
     * sending an invalid/oversized value that the server is not going to use.
     */
    @AssertTrue(message = "Thông tin liên hệ khách tự nhập không hợp lệ.")
    private boolean hasValidFormFields() {
        if ("ACCOUNT".equals(contactSource)) return true;
        return (name == null || name.length() <= 100)
                && (note == null || note.length() <= 500)
                && phone != null
                && phone.matches("^[+0-9][0-9 .()-]{7,31}$");
    }
}
