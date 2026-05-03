package com.bigbike.bigbike_backend.service.payment.sepay;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

@Service
public class SepayQrService {

    /**
     * VietQR.io URL — chuẩn NHNN, không cần API key, free.
     * Format: https://img.vietqr.io/image/{bank-bin}-{account}-{template}.png?amount=...&addInfo=...&accountName=...
     */
    public String buildVietQrUrl(String bankBin, String accountNumber, String accountHolder,
                                  long amountVnd, String transferContent) {
        String template = "compact2";
        String encodedName = URLEncoder.encode(accountHolder, StandardCharsets.UTF_8);
        String encodedInfo = URLEncoder.encode(transferContent, StandardCharsets.UTF_8);
        return String.format(
                "https://img.vietqr.io/image/%s-%s-%s.png?amount=%d&addInfo=%s&accountName=%s",
                bankBin, accountNumber, template, amountVnd, encodedInfo, encodedName);
    }


}
