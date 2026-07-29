package com.bigbike.bigbike_backend.service.admin;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.bigbike.bigbike_backend.service.customer.CustomerAvatarStorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class AdminCustomerAvatarCleanupTest {

    private static final String AVATAR_URL =
            "/media/customers/00000000-0000-0000-0000-000000000001/avatar.webp";

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void rollbackDoesNotDeleteAvatarObject() {
        CustomerAvatarStorageService storage = mock(CustomerAvatarStorageService.class);
        AdminCustomerService service = serviceWith(storage);
        TransactionSynchronizationManager.initSynchronization();

        service.deleteAvatarAfterCommit(AVATAR_URL);
        verify(storage, never()).deleteAvatar(AVATAR_URL);

        // A rollback clears registered callbacks without invoking afterCommit.
        TransactionSynchronizationManager.clearSynchronization();
        verify(storage, never()).deleteAvatar(AVATAR_URL);
    }

    @Test
    void committedTransactionDeletesAvatarObjectOnce() {
        CustomerAvatarStorageService storage = mock(CustomerAvatarStorageService.class);
        AdminCustomerService service = serviceWith(storage);
        TransactionSynchronizationManager.initSynchronization();

        service.deleteAvatarAfterCommit(AVATAR_URL);
        verify(storage, never()).deleteAvatar(AVATAR_URL);

        for (TransactionSynchronization synchronization
                : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        verify(storage).deleteAvatar(AVATAR_URL);
    }

    private static AdminCustomerService serviceWith(CustomerAvatarStorageService storage) {
        return new AdminCustomerService(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                storage);
    }
}
