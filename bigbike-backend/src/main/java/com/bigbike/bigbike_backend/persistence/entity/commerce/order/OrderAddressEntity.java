package com.bigbike.bigbike_backend.persistence.entity.commerce.order;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_addresses")
@Getter
@Setter
public class OrderAddressEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderEntity order;

    @Column(nullable = false, length = 50)
    private String type;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(length = 255)
    private String company;

    @Column(length = 255)
    private String email;

    @Column(length = 50)
    private String phone;

    @Column(length = 10)
    private String country = "VN";

    @Column(length = 127)
    private String province;

    @Column(length = 127)
    private String district;

    @Column(length = 127)
    private String ward;

    @Column(name = "address_line1", columnDefinition = "text")
    private String addressLine1;

    @Column(name = "address_line2", columnDefinition = "text")
    private String addressLine2;

    @Column(length = 20)
    private String postcode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
