package com.bigbike.bigbike_backend.api.customer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SaveCustomerAddressRequest(
        @NotBlank(message = "Loại địa chỉ không được để trống.")
        @Pattern(regexp = "BILLING|SHIPPING", message = "Loại địa chỉ phải là BILLING hoặc SHIPPING.")
        String type,

        @NotBlank(message = "Họ tên không được để trống.")
        @Size(max = 255, message = "Họ tên không được vượt quá 255 ký tự.")
        String fullName,

        @NotBlank(message = "Số điện thoại không được để trống.")
        @Pattern(regexp = "^\\+?[0-9]{8,15}$", message = "Số điện thoại không hợp lệ.")
        String phone,

        @Email(message = "Địa chỉ email không hợp lệ.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        @NotBlank(message = "Tỉnh/Thành phố không được để trống.")
        @Size(max = 255, message = "Tỉnh/Thành phố không được vượt quá 255 ký tự.")
        String province,

        @NotBlank(message = "Quận/Huyện không được để trống.")
        @Size(max = 255, message = "Quận/Huyện không được vượt quá 255 ký tự.")
        String district,

        @NotBlank(message = "Phường/Xã không được để trống.")
        @Size(max = 255, message = "Phường/Xã không được vượt quá 255 ký tự.")
        String ward,

        @NotBlank(message = "Địa chỉ chi tiết không được để trống.")
        @Size(max = 500, message = "Địa chỉ không được vượt quá 500 ký tự.")
        String addressLine1,

        @Size(max = 500, message = "Địa chỉ dòng 2 không được vượt quá 500 ký tự.")
        String addressLine2,

        Boolean isDefault
) {}
