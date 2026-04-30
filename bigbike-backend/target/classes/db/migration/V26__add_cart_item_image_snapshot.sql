alter table cart_items
    add column product_image_id varchar(255);

alter table cart_items
    add column product_image_url text;

alter table cart_items
    add column product_image_alt text;

alter table cart_items
    add column product_image_width integer;

alter table cart_items
    add column product_image_height integer;

alter table cart_items
    add column product_image_mime_type varchar(255);

update cart_items ci
set product_image_id = (select p.image_id from products p where p.id = cast(ci.product_id as varchar)),
    product_image_url = (select p.image_url from products p where p.id = cast(ci.product_id as varchar)),
    product_image_alt = (select p.image_alt from products p where p.id = cast(ci.product_id as varchar)),
    product_image_width = (select p.image_width from products p where p.id = cast(ci.product_id as varchar)),
    product_image_height = (select p.image_height from products p where p.id = cast(ci.product_id as varchar)),
    product_image_mime_type = (select p.image_mime_type from products p where p.id = cast(ci.product_id as varchar))
where ci.product_id is not null
  and exists (select 1 from products p where p.id = cast(ci.product_id as varchar));
