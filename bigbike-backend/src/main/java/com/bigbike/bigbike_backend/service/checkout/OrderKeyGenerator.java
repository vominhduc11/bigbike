package com.bigbike.bigbike_backend.service.checkout;

import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class OrderKeyGenerator {

    public String generate() {
        return "bb_order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }
}
