package com.bigbike.bigbike_backend.service.checkout;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class OrderNumberGenerator {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    public String generate() {
        String date = LocalDate.now(ZoneOffset.UTC).format(DATE_FMT);
        // 6 uppercase alphanumeric chars from UUID hex — sufficient uniqueness for human-readable ID
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "BB-" + date + "-" + suffix;
    }
}
