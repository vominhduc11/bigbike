create table sliders (
    id varchar(64) primary key,
    sort_order integer not null,
    location varchar(64) not null,
    desktop_image json,
    mobile_image json,
    product_id varchar(64),
    external_link text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint fk_sliders_product_id
        foreign key (product_id) references products (id) on delete set null,
    constraint uq_sliders_location_sort_order
        unique (location, sort_order),
    constraint ck_sliders_location
        check (length(trim(location)) > 0)
);

create index idx_sliders_location_sort_order on sliders (location, sort_order);
create index idx_sliders_product_id on sliders (product_id);
