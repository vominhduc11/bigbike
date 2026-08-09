package com.bigbike.bigbike_backend.api.chat.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
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

    @Size(max = 100, message = "Tên không được dài quá 100 ký tự.")
    private String name;

    @NotBlank(message = "Số điện thoại hoặc Zalo không được để trống.")
    @Size(max = 32, message = "Số liên hệ không được dài quá 32 ký tự.")
    @Pattern(
            regexp = "^[+0-9][0-9 .()-]{7,31}$",
            message = "Số điện thoại hoặc Zalo không hợp lệ.")
    private String phone;

    @Size(max = 500, message = "Ghi chú không được dài quá 500 ký tự.")
    private String note;

    @AssertTrue(message = "Khách phải đồng ý trước khi lưu thông tin liên hệ.")
    private boolean consent;
}
