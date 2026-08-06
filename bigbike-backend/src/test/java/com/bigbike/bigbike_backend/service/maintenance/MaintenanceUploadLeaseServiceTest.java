package com.bigbike.bigbike_backend.service.maintenance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class MaintenanceUploadLeaseServiceTest {

    @Test
    void pendingAndUploadingLeasesBlockTheMaintenanceBoundaryUntilCompleted() {
        MaintenanceUploadLeaseService service = new MaintenanceUploadLeaseService();
        UUID adminId = UUID.randomUUID();

        service.update(adminId, "upload-1", "PENDING");
        service.update(adminId, "upload-2", "UPLOADING");
        assertThat(service.activity()).satisfies(activity -> {
            assertThat(activity.active()).isTrue();
            assertThat(activity.count()).isEqualTo(2);
        });

        service.update(adminId, "upload-1", "DONE");
        service.update(adminId, "upload-2", "ERROR");
        assertThat(service.activity().active()).isFalse();
    }

    @Test
    void leasesAreScopedToTheAdminAndUploadId() {
        MaintenanceUploadLeaseService service = new MaintenanceUploadLeaseService();

        service.update(UUID.randomUUID(), "same-name", "UPLOADING");
        service.update(UUID.randomUUID(), "same-name", "UPLOADING");

        assertThat(service.activity().count()).isEqualTo(2);
    }
}
