package com.bigbike.bigbike_backend.service.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import org.junit.jupiter.api.Test;

class InternalMailRecipientTest {

    @Test
    void trimsAndExposesTheSingleConfiguredRecipient() {
        InternalMailRecipient recipient = new InternalMailRecipient("  shop@example.test  ");

        recipient.validate();

        assertThat(recipient.address()).isEqualTo("shop@example.test");
    }

    @Test
    void rejectsMissingRecipientWithAnActionableStartupMessage() {
        InternalMailRecipient recipient = new InternalMailRecipient(" ");

        assertThatIllegalStateException()
                .isThrownBy(recipient::validate)
                .withMessageContaining("BIGBIKE_MAIL_ADMIN is required");
    }

    @Test
    void rejectsMalformedRecipientBeforeNotificationsCanStart() {
        InternalMailRecipient recipient = new InternalMailRecipient("not-an-email");

        assertThatIllegalStateException()
                .isThrownBy(recipient::validate)
                .withMessageContaining("BIGBIKE_MAIL_ADMIN must be a valid email address");
    }
}
