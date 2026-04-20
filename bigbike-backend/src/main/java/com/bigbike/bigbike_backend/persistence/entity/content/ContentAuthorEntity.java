package com.bigbike.bigbike_backend.persistence.entity.content;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "content_authors")
public class ContentAuthorEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
