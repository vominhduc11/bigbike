-- Gỡ cột "Sản xuất tại [nước]" (origin_manufacture_country, thêm ở V175).
-- Trường này không còn hiển thị ở bất kỳ đâu trên web; admin cũng bỏ ô nhập tương ứng.
-- Xuất xứ thương hiệu (origin_brand_country) vẫn giữ.
alter table products
    drop column if exists origin_manufacture_country;
