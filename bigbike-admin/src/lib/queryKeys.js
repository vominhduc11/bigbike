// Nguồn định nghĩa tập trung cho các React Query key mà NHIỀU màn hình/component
// cùng đọc (nên phải khớp params tuyệt đối, nếu không sẽ vô tình share nhầm cache
// giữa 2 chỗ có ngữ cảnh khác nhau). Key chỉ dùng ở đúng 1 nơi thì KHÔNG cần khai
// báo ở đây — literal tại chỗ vẫn hợp lệ.
export const queryKeys = {
  // Cây danh mục theo ngôn ngữ nội dung — dùng chung bởi màn danh sách Sản phẩm/
  // Danh mục (theo contentLang hiện tại) và form chi tiết Sản phẩm/Menu (cố định
  // 'vi' cho danh sách đầy đủ, 'en' cho overlay tên đã dịch).
  categoriesTree: (lang) => ['categories', 'tree', lang],

  // Danh sách thương hiệu ĐẦY ĐỦ theo ngôn ngữ — dùng cho ô chọn form chi tiết Sản
  // phẩm (cần đủ cả mục chưa dịch để overlay tên EN, KHÔNG sort theo tên).
  brandsAll: (lang) => ['brands-all', lang],

  // Danh sách thương hiệu cho bộ lọc màn duyệt Sản phẩm — sort theo tên + strict-EN
  // (PRODUCT_RULE_004, ẩn mục chưa dịch). Tách key riêng khỏi brandsAll() vì query
  // params khác nhau (sort khác, không overlay) — dùng chung key trước đây khiến 2
  // màn hình đọc nhầm cache của nhau khi cùng contentLang.
  brandsFilter: (lang) => ['brands-filter', lang],

  // Banner "Phân công" (vai trò + đầu việc) — cùng 1 cache entry cho ProductDetailScreen,
  // ContentAssignmentBanner (bài viết) và AssignmentRolesScreen (Cài đặt) để sửa ở Cài đặt
  // là 2 banner kia cập nhật ngay qua invalidateQueries, không cần F5.
  productAssignment: () => ['product-assignment'],
}
