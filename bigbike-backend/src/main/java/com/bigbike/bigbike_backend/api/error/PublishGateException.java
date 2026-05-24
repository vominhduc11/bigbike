package com.bigbike.bigbike_backend.api.error;

import com.bigbike.bigbike_backend.api.common.ApiErrorDetail;
import java.util.List;
import org.springframework.http.HttpStatus;

public class PublishGateException extends ApiException {

    public PublishGateException(List<ApiErrorDetail> details) {
        super(HttpStatus.valueOf(422), "PRODUCT_NOT_READY_TO_PUBLISH",
              "Product is missing required data to publish.", details);
    }
}
