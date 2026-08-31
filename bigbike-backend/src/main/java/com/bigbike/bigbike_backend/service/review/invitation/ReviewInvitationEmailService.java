package com.bigbike.bigbike_backend.service.review.invitation;

import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import org.thymeleaf.context.Context;

@Service
public class ReviewInvitationEmailService {

    private final EmailDispatchService emailDispatchService;
    private final String siteBaseUrl;

    public ReviewInvitationEmailService(
            EmailDispatchService emailDispatchService,
            @Value("${bigbike.site.base-url:https://bigbike.vn}") String siteBaseUrl) {
        this.emailDispatchService = emailDispatchService;
        this.siteBaseUrl = trimTrailingSlash(siteBaseUrl);
    }

    public boolean send(ReviewInvitationDispatchClaim claim) {
        boolean english = "en".equals(claim.locale());
        List<EmailProduct> products = claim.products().stream()
                .map(product -> new EmailProduct(
                        product.name(),
                        productUrl(claim.locale(), product.slug(), product.token())))
                .toList();

        Context context = new Context(Locale.forLanguageTag(claim.locale()));
        context.setVariable("english", english);
        context.setVariable("customerName", claim.customerName());
        context.setVariable("orderNumber", claim.orderNumber());
        context.setVariable("products", products);
        context.setVariable("unsubscribeUrl", unsubscribeUrl(claim.locale(), claim.unsubscribeToken()));

        String subject = english
                ? "[BigBike] How’s your new riding gear?"
                : "[BigBike] Anh/chị thấy món đồ bảo hộ vừa nhận thế nào?";
        return emailDispatchService.send(
                claim.recipientEmail(), subject, "review-invitation", context);
    }

    String productUrl(String locale, String slug, String token) {
        String prefix = "en".equals(locale) ? "/en/product/" : "/product/";
        return siteBaseUrl + prefix
                + UriUtils.encodePathSegment(slug, StandardCharsets.UTF_8)
                + "/#write-review=" + token;
    }

    String unsubscribeUrl(String locale, String token) {
        String path = "en".equals(locale)
                ? "/en/review-invitations/unsubscribe/"
                : "/tu-choi-thu-moi-danh-gia/";
        return siteBaseUrl + path + "#token=" + token;
    }

    private static String trimTrailingSlash(String value) {
        String normalized = value == null ? "" : value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    @Getter
    public static final class EmailProduct {
        private final String name;
        private final String url;

        private EmailProduct(String name, String url) {
            this.name = name;
            this.url = url;
        }
    }
}
