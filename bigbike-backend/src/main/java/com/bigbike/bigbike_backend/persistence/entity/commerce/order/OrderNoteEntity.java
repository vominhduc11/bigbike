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
@Table(name = "order_notes")
@Getter
@Setter
public class OrderNoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderEntity order;

    @Column(name = "author_type", nullable = false, length = 50)
    private String authorType;

    @Column(name = "author_id")
    private UUID authorId;

    @Column(name = "note_type", nullable = false, length = 50)
    private String noteType;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "is_customer_visible", nullable = false)
    private boolean customerVisible = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
