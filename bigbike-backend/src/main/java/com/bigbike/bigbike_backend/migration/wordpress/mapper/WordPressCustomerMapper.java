package com.bigbike.bigbike_backend.migration.wordpress.mapper;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpUser;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpUserMeta;
import com.bigbike.bigbike_backend.migration.wordpress.parser.WordPressRoleParser;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class WordPressCustomerMapper {

    private final WordPressRoleParser roleParser;

    public WordPressCustomerMapper(WordPressRoleParser roleParser) {
        this.roleParser = roleParser;
    }

    public record MappedCustomer(
            // ── Core identity ─────────────────────────────────────────────────
            long sourceId,
            String email,
            String legacyPasswordHash,   // phpass — preserved as-is; NOT converted
            String displayName,
            String firstName,
            String lastName,
            String phone,
            String status,               // ACTIVE | DISABLED
            boolean isSynthetic,
            // ── Billing address ───────────────────────────────────────────────
            String billingFirstName,
            String billingLastName,
            String billingCompany,
            String billingAddress1,
            String billingAddress2,
            String billingCity,
            String billingState,
            String billingPostcode,
            String billingCountry,
            String billingEmail,
            String billingPhone,
            // ── Shipping address ──────────────────────────────────────────────
            String shippingFirstName,
            String shippingLastName,
            String shippingCompany,
            String shippingAddress1,
            String shippingAddress2,
            String shippingCity,
            String shippingState,
            String shippingPostcode,
            String shippingCountry,
            List<String> warnings
    ) {}

    /**
     * Maps a WpUser + its metas to MappedCustomer.
     * Returns null if the user should be excluded (privileged role: administrator, editor, etc.).
     *
     * @param user        WP user row
     * @param userMetas   all usermeta rows for this user (pre-filtered by userId is optional)
     * @param tablePrefix WP table prefix e.g. "kd_" for capability meta key resolution
     */
    public MappedCustomer map(WpUser user, List<WpUserMeta> userMetas, String tablePrefix) {
        List<String> warnings = new ArrayList<>();
        Map<String, String> meta = userMetas.stream()
                .filter(m -> m.userId() == user.id())
                .filter(m -> m.metaKey() != null)
                .collect(Collectors.toMap(
                        WpUserMeta::metaKey,
                        m -> m.metaValue() != null ? m.metaValue() : "",
                        (a, b) -> a
                ));

        // Role check: {prefix}capabilities first, wp_capabilities fallback
        String capKey = (tablePrefix != null && !tablePrefix.isBlank())
                ? tablePrefix + "capabilities"
                : "wp_capabilities";
        String capabilities = meta.getOrDefault(capKey,
                meta.getOrDefault("wp_capabilities", null));

        WordPressRoleParser.ParsedRole role = roleParser.parse(capabilities);
        warnings.addAll(role.warnings());

        if (role.isPrivileged()) {
            return null;  // caller increments excludedPrivileged count
        }

        String email = user.userEmail();
        if (email == null || email.isBlank()) {
            warnings.add("Missing email for user id=" + user.id());
        } else if (!email.contains("@")) {
            warnings.add("Invalid email format for user id=" + user.id() + ": " + email);
        }

        String status = "0".equals(user.userStatus()) || user.userStatus() == null
                ? "ACTIVE" : "DISABLED";

        String phone = meta.getOrDefault("billing_phone", "");

        return new MappedCustomer(
                user.id(),
                email,
                user.userPass(),
                user.displayName(),
                meta.getOrDefault("first_name", ""),
                meta.getOrDefault("last_name", ""),
                phone.isBlank() ? null : phone,
                status,
                false,
                meta.get("billing_first_name"),
                meta.get("billing_last_name"),
                meta.get("billing_company"),
                meta.get("billing_address_1"),
                meta.get("billing_address_2"),
                meta.get("billing_city"),
                meta.get("billing_state"),
                meta.get("billing_postcode"),
                meta.getOrDefault("billing_country", "VN"),
                meta.get("billing_email"),
                meta.get("billing_phone"),
                meta.get("shipping_first_name"),
                meta.get("shipping_last_name"),
                meta.get("shipping_company"),
                meta.get("shipping_address_1"),
                meta.get("shipping_address_2"),
                meta.get("shipping_city"),
                meta.get("shipping_state"),
                meta.get("shipping_postcode"),
                meta.getOrDefault("shipping_country", "VN"),
                warnings
        );
    }

    /** Backward-compatible overload — defaults to kd_ table prefix. */
    public MappedCustomer map(WpUser user, List<WpUserMeta> userMetas) {
        return map(user, userMetas, "kd_");
    }

    /**
     * Creates a synthetic (guest) customer from order billing metadata.
     * isSynthetic = true. No password hash.
     * Always returns a record; caller decides whether to use it based on email/phone availability.
     */
    public MappedCustomer mapSynthetic(long orderId, Map<String, String> billingMeta) {
        String email = billingMeta.getOrDefault("_billing_email", "").trim();
        String phone = billingMeta.getOrDefault("_billing_phone", "").trim();
        String firstName = billingMeta.getOrDefault("_billing_first_name", "");
        String lastName  = billingMeta.getOrDefault("_billing_last_name", "");

        List<String> warnings = new ArrayList<>();
        warnings.add("Synthetic customer from guest order id=" + orderId);

        return new MappedCustomer(
                -orderId,
                email.isEmpty() ? null : email,
                null,
                (firstName + " " + lastName).trim(),
                firstName,
                lastName,
                phone.isEmpty() ? null : phone,
                "ACTIVE",
                true,
                firstName,
                lastName,
                billingMeta.get("_billing_company"),
                billingMeta.get("_billing_address_1"),
                billingMeta.get("_billing_address_2"),
                billingMeta.get("_billing_city"),
                billingMeta.get("_billing_state"),
                billingMeta.get("_billing_postcode"),
                billingMeta.getOrDefault("_billing_country", "VN"),
                email.isEmpty() ? null : email,
                phone.isEmpty() ? null : phone,
                null, null, null, null, null, null, null, null, "VN",
                warnings
        );
    }
}
