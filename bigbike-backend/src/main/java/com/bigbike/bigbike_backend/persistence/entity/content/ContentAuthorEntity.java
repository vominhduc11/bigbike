package com.bigbike.bigbike_backend.persistence.entity.content;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "content_authors")
@Getter
@Setter
public class ContentAuthorEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

}
