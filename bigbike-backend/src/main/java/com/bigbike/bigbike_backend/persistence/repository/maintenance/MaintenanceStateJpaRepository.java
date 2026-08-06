package com.bigbike.bigbike_backend.persistence.repository.maintenance;

import com.bigbike.bigbike_backend.persistence.entity.maintenance.MaintenanceStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceStateJpaRepository extends JpaRepository<MaintenanceStateEntity, Short> {
}
