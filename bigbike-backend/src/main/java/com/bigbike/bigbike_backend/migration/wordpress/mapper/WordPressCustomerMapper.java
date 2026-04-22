package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressCustomerMapper {

    public record MappedCustomer(
            long sourceId,
            String email,
            String legacyPasswordHash,  // phpass — stored as-is for backward-compat login
            String displayName,
            String billingFirstName,
            String billingLastName,
            String billingPhone,
            String billingAddress1,
            String billingCity,
            String billingState,
            String billingCountry,
            String shippingFirstName,
            String shippingLastName,
            String shippingAddress1,
            String shippingCity,
            boolean isSynthetic,
            List<String> warnings
    ) {}

    public MappedCustomer map(WpUser user, List<WpUserMeta> userMetas) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = userMetas.stream()
                .filter(m -> m.userId() == user.id())
                .filter(m -> m.metaKey() != null).collect(Collectors.toMap(WpUserMeta::metaKey, m -> m.metaValue() != null ? m.metaValue() : "", (a, b) -> a));

        if (user.userEmail() == null || user.userEmail().isBlank()) {
            warnings.add("Missing email for user id=" + user.id());
        }

        return new MappedCustomer(
                user.id(),
                user.userEmail(),
                user.userPass(),  // phpass hash preserved
                user.displayName(),
                meta.get("billing_first_name"),
                meta.get("billing_last_name"),
                meta.get("billing_phone"),
                meta.get("billing_address_1"),
                meta.get("billing_city"),
                meta.get("billing_state"),
                meta.getOrDefault("billing_country", "VN"),
                meta.get("shipping_first_name"),
                meta.get("shipping_last_name"),
                meta.get("shipping_address_1"),
                meta.get("shipping_city"),
                false,
                warnings
        );
    }

    /** Creates a synthetic customer record from order billing data (guest orders). */
    public MappedCustomer mapSynthetic(long orderId, Map<String, String> billingMeta) {
        return new MappedCustomer(
                -orderId,  // negative to distinguish from real WP user IDs
                billingMeta.getOrDefault("_billing_email", ""),
                null,
                billingMeta.getOrDefault("_billing_first_name", "") + " " +
                        billingMeta.getOrDefault("_billing_last_name", ""),
                billingMeta.get("_billing_first_name"),
                billingMeta.get("_billing_last_name"),
                billingMeta.get("_billing_phone"),
                billingMeta.get("_billing_address_1"),
                billingMeta.get("_billing_city"),
                billingMeta.get("_billing_state"),
                billingMeta.getOrDefault("_billing_country", "VN"),
                null, null, null, null,
                true,
                List.of("Synthetic customer from order id=" + orderId)
        );
    }
}
