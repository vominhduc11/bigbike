package com.bigbike.bigbike_backend.service.inventory;

import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import com.bigbike.bigbike_backend.service.email.InternalMailRecipient;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.PartialProductItem;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.ProductItem;
import com.bigbike.bigbike_backend.service.inventory.InventoryOutOfStockDigest.VariantItem;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import tools.jackson.databind.ObjectMapper;

@Service
@Slf4j
public class InventoryOutOfStockDigestEmailService {

    private static final DateTimeFormatter SUBJECT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EmailDispatchService emailDispatchService;
    private final InternalMailRecipient internalMailRecipient;
    private final ObjectMapper objectMapper;
    private final String adminBaseUrl;

    public InventoryOutOfStockDigestEmailService(
            EmailDispatchService emailDispatchService,
            InternalMailRecipient internalMailRecipient,
            ObjectMapper objectMapper,
            @Value("${bigbike.admin.base-url:https://admin.bigbike.vn}") String adminBaseUrl
    ) {
        this.emailDispatchService = emailDispatchService;
        this.internalMailRecipient = internalMailRecipient;
        this.objectMapper = objectMapper;
        this.adminBaseUrl = stripTrailingSlash(adminBaseUrl);
    }

    public boolean sendPayload(String payload) {
        InventoryOutOfStockDigest digest;
        try {
            digest = objectMapper.readValue(payload, InventoryOutOfStockDigest.class);
        } catch (Exception exception) {
            log.error("Cannot read the stored out-of-stock digest payload.", exception);
            return false;
        }

        Context context = new Context(Locale.forLanguageTag("vi"));
        context.setVariable("digestDate", digest.digestDate().format(SUBJECT_DATE));
        context.setVariable("counts", digest.counts());
        context.setVariable("fullProducts", digest.fullyOutOfStock().stream().map(this::emailProduct).toList());
        context.setVariable("partialProducts", digest.partiallyOutOfStock().stream().map(this::emailProduct).toList());

        String subject = "[BigBike] Hàng hết cần xử lý / Out-of-stock action needed — "
                + digest.digestDate().format(SUBJECT_DATE);
        return emailDispatchService.send(
                internalMailRecipient.address(),
                subject,
                "inventory-out-of-stock-digest",
                context);
    }

    private EmailProduct emailProduct(ProductItem item) {
        return new EmailProduct(
                item.nameVi(), item.nameEn(), item.sku(), adminBaseUrl + item.editPath(),
                duration(item.outOfStockDays(), item.outOfStockSinceEstimated()), List.of());
    }

    private EmailProduct emailProduct(PartialProductItem item) {
        return new EmailProduct(
                item.nameVi(), item.nameEn(), item.sku(), adminBaseUrl + item.editPath(),
                duration(item.outOfStockDays(), item.outOfStockSinceEstimated()),
                item.unavailableVariants().stream().map(this::emailVariant).toList());
    }

    private EmailVariant emailVariant(VariantItem item) {
        return new EmailVariant(
                item.nameVi(), item.nameEn(), item.sku(),
                duration(item.outOfStockDays(), item.outOfStockSinceEstimated()));
    }

    private static String duration(long days, boolean estimated) {
        if (estimated) {
            return "Ít nhất " + days + " ngày — theo dõi từ ngày bắt đầu theo dõi"
                    + " / At least " + days + " days — tracked since monitoring began";
        }
        if (days == 0) {
            return "Hết hôm nay / Out today";
        }
        return days + " ngày / " + days + " days";
    }

    private static String stripTrailingSlash(String value) {
        String normalized = value == null ? "" : value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    public record EmailProduct(
            String nameVi, String nameEn, String sku, String editUrl, String duration,
            List<EmailVariant> variants
    ) {}

    public record EmailVariant(String nameVi, String nameEn, String sku, String duration) {}
}
