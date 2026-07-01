package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.VnAddressItem;
import com.bigbike.bigbike_backend.service.address.VnAddressService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/address")
@RequiredArgsConstructor
public class VnAddressController {

    // Province/ward codes are short alphanumeric tokens (e.g. "01", "00001").
    private static final String CODE_REGEX = "^[A-Za-z0-9]{1,16}$";

    private final VnAddressService addressService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/provinces")
    public ApiDataResponse<List<VnAddressItem>> listProvinces(HttpServletRequest request) {
        return apiResponseFactory.data(addressService.listProvinces(), request);
    }

    @GetMapping("/provinces/{provinceCode}/wards")
    public ApiDataResponse<List<VnAddressItem>> listWards(
            @PathVariable @Pattern(regexp = CODE_REGEX, message = "Invalid province code.") String provinceCode,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(addressService.listWards(provinceCode), request);
    }
}
