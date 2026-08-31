package com.bigbike.bigbike_backend.service.email;

import jakarta.annotation.PostConstruct;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The one shared recipient for shop-owned internal email notifications.
 *
 * <p>The value must come from {@code BIGBIKE_MAIL_ADMIN}; keeping validation here prevents
 * individual notification flows from inventing their own fallback mailbox.</p>
 */
@Component
public class InternalMailRecipient {

    private static final Pattern EMAIL = Pattern.compile(
            "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);

    private final String address;

    public InternalMailRecipient(@Value("${bigbike.mail.admin:}") String configuredAddress) {
        this.address = configuredAddress == null ? "" : configuredAddress.trim();
    }

    @PostConstruct
    void validate() {
        if (address.isBlank()) {
                    throw new IllegalStateException(
                            "BIGBIKE_MAIL_ADMIN is required: set the shared internal notification email "
                            + "for new-order alerts before starting the backend.");
        }
        if (!EMAIL.matcher(address).matches()) {
            throw new IllegalStateException(
                    "BIGBIKE_MAIL_ADMIN must be a valid email address; the configured value is invalid.");
        }
    }

    public String address() {
        return address;
    }
}
