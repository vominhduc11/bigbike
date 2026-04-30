package com.bigbike.bigbike_backend.api.public_;

import com.bigbike.bigbike_backend.api.common.ApiDataResponse;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.public_.dto.VnAddressItem;
import com.bigbike.bigbike_backend.service.address.VnAddressService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/address")
public class VnAddressController {

    // Province/district/ward codes are short alphanumeric tokens (e.g. "01", "001", "00001").
    private static final String CODE_REGEX = "^[A-Za-z0-9]{1,16}$";

    private final VnAddressService addressService;
    private final ApiResponseFactory apiResponseFactory;

    public VnAddressController(VnAddressService addressService, ApiResponseFactory apiResponseFactory) {
        this.addressService = addressService;
        this.apiResponseFactory = apiResponseFactory;
    }

    @GetMapping("/provinces")
    public ApiDataResponse<List<VnAddressItem>> listProvinces(HttpServletRequest request) {
        return apiResponseFactory.data(addressService.listProvinces(), request);
    }

    @GetMapping("/provinces/{provinceCode}/districts")
    public ApiDataResponse<List<VnAddressItem>> listDistricts(
            @PathVariable @Pattern(regexp = CODE_REGEX, message = "Invalid province code.") String provinceCode,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(addressService.listDistricts(provinceCode), request);
    }

    @GetMapping("/districts/{districtCode}/wards")
    public ApiDataResponse<List<VnAddressItem>> listWards(
            @PathVariable @Pattern(regexp = CODE_REGEX, message = "Invalid district code.") String districtCode,
            HttpServletRequest request
    ) {
        return apiResponseFactory.data(addressService.listWards(districtCode), request);
    }
}
