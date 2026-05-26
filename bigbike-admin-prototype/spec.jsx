/* global React */
// ─────────────────────────────────────────────────────────────────────────
// spec.jsx — Codebase inventory, IA, per-page spec, implementation guidance.
// All inventory items below are grounded in real files from
// bigbike-admin/src/screens/* and bigbike-admin/src/App.jsx.
// ─────────────────────────────────────────────────────────────────────────

function Pill({ children, kind }) {
  return <span className={`pill ${kind || ""}`}>{children}</span>;
}

function PageSpec({ name, route, purpose, primary, secondary, dataKey, layout, empty, loading, error, responsive, components, problems, recs, recommend, code }) {
  return (
    <div className="pagecard">
      <h4>{name} <code>{route}</code> {recommend && <Pill kind="warn">Recommendation</Pill>}</h4>
      <p style={{margin: "2px 0 0", color:"var(--bb-text-secondary)"}}>{purpose}</p>
      <div className="pagebody">
        <div>
          <div className="label">Primary action</div>
          <div>{primary || "—"}</div>
          <div className="label">Secondary actions</div>
          <div>{secondary || "—"}</div>
          <div className="label">Data chính</div>
          <div>{dataKey || "—"}</div>
          <div className="label">Layout</div>
          <div>{layout || "—"}</div>
          <div className="label">Component dùng lại</div>
          <div className="tagrow">{(components || []).map(c => <Pill key={c}>{c}</Pill>)}</div>
        </div>
        <div>
          <div className="label">Empty state</div>
          <div>{empty || "—"}</div>
          <div className="label">Loading state</div>
          <div>{loading || "—"}</div>
          <div className="label">Error state</div>
          <div>{error || "—"}</div>
          <div className="label">Responsive</div>
          <div>{responsive || "—"}</div>
          {(problems || recs) && <>
            <div className="label">Vấn đề hiện tại / Đề xuất sửa</div>
            <div>
              {problems && <ul style={{margin:"4px 0 4px 16px", paddingLeft:0}}>{problems.map((p,i)=><li key={i}>{p}</li>)}</ul>}
              {recs && <ul style={{margin:"4px 0 4px 16px", paddingLeft:0}}>{recs.map((p,i)=><li key={i}><strong>Sửa:</strong> {p}</li>)}</ul>}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

function SpecDoc() {
  return (
    <div className="bb-spec">
      <h1>BigBike Admin · Spec & Implementation Guide</h1>
      <p className="lede">
        Tài liệu thiết kế lại bigbike-admin dựa trên codebase thực tại. Mọi page, module và component liệt kê dưới đây đều
        đối chiếu với file thật trong <code>bigbike-admin/src</code>. Không phát minh chức năng mới ngoài mục
        "Recommendation". Đây là spec để dev có thể implement nhất quán mà không cần backend đổi.
      </p>

      {/* ═══════════ 1. INVENTORY ═══════════ */}
      <h2>1. Codebase UI inventory</h2>

      <h3>1.1 Layout shell & nền tảng</h3>
      <ul>
        <li><code>src/App.jsx</code> — root router, lazy-load 40 screens, định nghĩa <code>NAV_GROUP_DEFS</code> (5 nhóm sidebar) và mapping permission → route.</li>
        <li><code>src/components/AdminShell.jsx</code> — sidebar + topbar + breadcrumb, focus mode (F11) cho form, mobile drawer, global search, notification bell, language switcher, theme toggle, user menu.</li>
        <li><code>src/lib/auth.jsx</code> + <code>LoginScreen.jsx</code> — auth flow, permission checking qua <code>hasPermission()</code>.</li>
        <li><code>src/lib/adminWebSocket.js</code> — realtime updates (đơn hàng mới, sync queries).</li>
        <li><code>src/styles/admin-tokens.css</code> — design tokens đầy đủ (brand, surfaces, status, typography, spacing, radius, shadow, dark mode).</li>
      </ul>

      <h3>1.2 Modules thực tại (40 routes)</h3>
      <table>
        <thead><tr><th>Module</th><th>Routes</th><th>Screen file</th></tr></thead>
        <tbody>
          <tr><td>Dashboard</td><td><code>/admin/dashboard</code></td><td>DashboardScreen.jsx</td></tr>
          <tr><td>Orders</td><td><code>/admin/orders</code>, <code>/admin/orders/:id</code></td><td>OrderListScreen, OrderDetailScreen</td></tr>
          <tr><td>POS</td><td><code>/admin/pos</code></td><td>PosScreen.jsx</td></tr>
          <tr><td>Customers</td><td><code>/admin/customers</code>, <code>/admin/customers/:id</code></td><td>CustomerListScreen, CustomerDetailScreen</td></tr>
          <tr><td>Newsletter</td><td><code>/admin/newsletter-subscribers</code></td><td>NewsletterSubscribersScreen.jsx</td></tr>
          <tr><td>Returns</td><td><code>/admin/returns</code></td><td>ReturnListScreen.jsx</td></tr>
          <tr><td>Receivables</td><td><code>/admin/receivables</code>, <code>/:id</code></td><td>ReceivablesListScreen, ReceivableDetailScreen</td></tr>
          <tr><td>Reviews</td><td><code>/admin/reviews</code>, <code>/:id</code></td><td>ReviewListScreen, ReviewDetailScreen</td></tr>
          <tr><td>Coupons</td><td><code>/admin/coupons</code></td><td>CouponListScreen.jsx</td></tr>
          <tr><td>Products</td><td><code>/admin/products</code>, <code>/:id</code>, <code>/new</code></td><td>ProductListScreen, ProductDetailScreen</td></tr>
          <tr><td>Featured products</td><td><code>/admin/featured-products</code></td><td>FeaturedProductsScreen.jsx</td></tr>
          <tr><td>Inventory</td><td><code>/admin/inventory</code></td><td>InventoryScreen.jsx</td></tr>
          <tr><td>Serials</td><td><code>/admin/serials</code></td><td>SerialListScreen.jsx</td></tr>
          <tr><td>Warranties</td><td><code>/admin/warranties</code></td><td>WarrantyListScreen.jsx</td></tr>
          <tr><td>Categories</td><td><code>/admin/categories</code>, <code>/:id</code>, <code>/new</code></td><td>CategoryListScreen, CategoryDetailScreen</td></tr>
          <tr><td>Brands</td><td><code>/admin/brands</code>, <code>/:id</code>, <code>/new</code></td><td>BrandListScreen, BrandDetailScreen</td></tr>
          <tr><td>Attributes</td><td><code>/admin/attributes</code></td><td>AttributeListScreen.jsx</td></tr>
          <tr><td>Content</td><td><code>/admin/content</code>, <code>/admin/content/:type/:id</code></td><td>ContentListScreen, ContentDetailScreen</td></tr>
          <tr><td>Sliders / Banner</td><td><code>/admin/sliders</code></td><td>SliderListScreen.jsx</td></tr>
          <tr><td>Home videos</td><td><code>/admin/home-videos</code></td><td>HomeVideoListScreen.jsx</td></tr>
          <tr><td>Home highlights</td><td><code>/admin/home-highlights</code></td><td>HomeHighlightsScreen.jsx</td></tr>
          <tr><td>Redirects</td><td><code>/admin/redirects</code></td><td>RedirectListScreen.jsx</td></tr>
          <tr><td>Menus</td><td><code>/admin/menus</code></td><td>MenuScreen.jsx</td></tr>
          <tr><td>Media library</td><td><code>/admin/media</code></td><td>MediaLibraryScreen.jsx</td></tr>
          <tr><td>Reports</td><td><code>/admin/reports</code></td><td>ReportsScreen.jsx</td></tr>
          <tr><td>Shipping</td><td><code>/admin/shipping</code></td><td>ShippingScreen.jsx</td></tr>
          <tr><td>Settings</td><td><code>/admin/settings</code></td><td>SettingsScreen.jsx</td></tr>
          <tr><td>Admin users</td><td><code>/admin/admin-users</code></td><td>AdminUsersScreen.jsx</td></tr>
          <tr><td>Roles</td><td><code>/admin/roles</code></td><td>RolesScreen.jsx</td></tr>
          <tr><td>Audit logs</td><td><code>/admin/audit-logs</code></td><td>AuditLogListScreen.jsx</td></tr>
        </tbody>
      </table>

      <h3>1.3 Component inventory (đã có sẵn — phải dùng lại)</h3>
      <div className="tagrow">
        {[
          "AdminShell","AdminTable","BlockEditor","BulkActionBar","ConfirmDialog","DateRangePicker","DetailSection",
          "ErrorBoundary","ExportButton","FilterChips","GlobalSearch","ImageUrlInput","LanguageSwitcher","MediaCard",
          "MediaCardSkeleton","MediaDetailModal","MediaDetailPanel","MediaFolderSidebar","MediaListRow","MediaPickerModal",
          "MediaPreviewLightbox","NotificationBell","OrderNotificationToast","PaginationControls","ReadOnlyBanner",
          "RefundModal","RichTextEditor","StatePanel","StatusBadge","TagInput","ThemeToggle","VideoPickerModal",
          "layout/FilterBar","layout/FormField","layout/MobileCardList","layout/Modal","layout/Screen","layout/ScreenHeader",
          "layout/StickyActionBar","layout/SummaryCard","layout/Tabs","ui/alert","ui/badge","ui/button","ui/checkbox",
          "ui/dialog","ui/dropdown-menu","ui/input","ui/label","ui/popover","ui/radio-group","ui/select","ui/separator",
          "ui/table","ui/tabs","ui/textarea","ui/tooltip",
        ].map(c => <Pill key={c}>{c}</Pill>)}
      </div>

      <h3>1.4 Nhận xét nhanh về UI/UX hiện tại</h3>
      <ul>
        <li><strong>Tốt:</strong> design token đầy đủ, có dark mode, có ConfirmDialogProvider, có realtime ws, có audit log, có permission check ở mọi route.</li>
        <li><strong>Cần chuẩn hoá:</strong> nhiều screen tự inline CSS thay vì dùng <code>SummaryCard</code> / <code>layout/Screen</code> đã có sẵn — dẫn đến không nhất quán paddings và badge style.</li>
        <li><strong>Cần kiểm tra:</strong> 40 route — pattern filter/sort/pagination phải dùng cùng <code>useAdminList</code> + <code>FilterBar</code>; bất kỳ list nào tự viết lại cần refactor.</li>
        <li><strong>Cảnh báo:</strong> brand đỏ <code>#e8281e</code> hiện đôi khi bị lạm dụng cho icon, link, button cùng lúc trong cùng card — primary action mất spotlight. Dùng đỏ chỉ cho 1 vai trò trong mỗi vùng nhìn.</li>
        <li><strong>Cảnh báo:</strong> trong file <code>DashboardScreen.jsx</code> dùng recharts — cần verify accessibility & dark mode khi đổi background.</li>
      </ul>

      {/* ═══════════ 2. PRINCIPLES ═══════════ */}
      <h2>2. Admin design principles</h2>
      <ol>
        <li><strong>Vận hành trước trình diễn.</strong> Không có animation thừa. Mọi pixel phải phục vụ thao tác.</li>
        <li><strong>Mỗi màn = 1 câu hỏi rõ.</strong> Khi mở screen, admin phải trả lời ngay: đây là gì → việc tiếp theo là gì → dữ liệu quan trọng là cái nào.</li>
        <li><strong>Một primary action / màn.</strong> Đỏ brand chỉ dùng cho 1 nút quan trọng nhất. Phần còn lại là secondary/ghost.</li>
        <li><strong>Danger phải tách biệt.</strong> Huỷ, xoá, hoàn tiền nằm cuối card hoặc "Danger zone" riêng. Luôn có confirm dialog nêu rõ đối tượng và hậu quả.</li>
        <li><strong>Feedback nhất quán.</strong> Mọi mutation → toast 3-4s ở góc phải. Mọi delete/cancel → confirm dialog. Mọi error → inline alert hoặc field-level error.</li>
        <li><strong>Mật độ dữ liệu cao.</strong> Bảng row 44px, font 13px. Admin xem 200 đơn/ngày — đừng bắt họ scroll thêm.</li>
        <li><strong>Status badge bắt buộc dùng palette.</strong> Không tự đặt màu. 5 tone: success / warning / danger / info / neutral.</li>
        <li><strong>Filter "phổ biến" luôn hiện sẵn.</strong> Status tabs + search + 1-2 select; lọc nâng cao gom vào nút "Lọc nâng cao" → drawer.</li>
        <li><strong>Nhất quán trên 40 screen.</strong> Mỗi list screen = page header + filter bar + table + pagination. Detail screen = header + 2 cột (form trái, meta phải).</li>
        <li><strong>Responsive là phải, không "đẹp mobile".</strong> Desktop ưu tiên; tablet không vỡ; mobile có drawer sidebar và bảng → card list (đã có <code>layout/MobileCardList</code>).</li>
      </ol>

      {/* ═══════════ 3. IA ═══════════ */}
      <h2>3. Information architecture</h2>

      <h3>3.1 Sidebar grouping (giữ nguyên codebase)</h3>
      <dl className="grid">
        <dt>Bán hàng</dt><dd>Dashboard · Đơn hàng · POS · Khách hàng · Email đăng ký · Đổi trả · Công nợ · Đánh giá · Mã giảm giá</dd>
        <dt>Sản phẩm</dt><dd>Sản phẩm · Sản phẩm nổi bật · Kho hàng · Quản lý serial · Bảo hành · Danh mục · Thương hiệu · Thuộc tính</dd>
        <dt>Nội dung & Marketing</dt><dd>Nội dung · Banner · Video trang chủ · Highlights · Chuyển hướng · Menu · Thư viện</dd>
        <dt>Báo cáo</dt><dd>Báo cáo</dd>
        <dt>Hệ thống</dt><dd>Vận chuyển · Cài đặt · Quản trị viên · Phân quyền · Nhật ký</dd>
      </dl>

      <h3>3.2 Header behavior</h3>
      <ul>
        <li>Topbar 52px, sticky. Bên trái: <strong>global search</strong> (⌘K). Bên phải: pill kết nối ws · theme toggle · ngôn ngữ · thông báo · trợ giúp · user chip.</li>
        <li>Page title không lặp lại trong topbar — đã có trong page header bên dưới breadcrumb.</li>
        <li>Notification dot trên chuông khi có item chưa đọc. Click → drawer hiển thị 20 thông báo gần nhất + nút "Xoá tất cả".</li>
      </ul>

      <h3>3.3 Breadcrumb / Page title convention</h3>
      <ul>
        <li>Breadcrumb: <code>Tổng quan / [Module] / [Detail|Tạo mới]</code>. Max 3 cấp.</li>
        <li>Page header gồm: eyebrow (group), title (module/screen), description (1 dòng nói rõ ai làm gì ở đây), actions cluster bên phải.</li>
        <li>Khi vào detail: eyebrow chuyển thành "← Danh sách [module]" — click quay lại list giữ filter cũ (đã có <code>useUrlSyncedState</code>).</li>
      </ul>

      <h3>3.4 Action placement convention</h3>
      <ul>
        <li><strong>Trang list:</strong> Primary nằm góc phải page header. Filter ngay dưới. Bulk action bar nổi từ dưới khi có item được chọn.</li>
        <li><strong>Trang detail (form):</strong> Primary "Lưu" + secondary "Lưu nháp" ở header. Sticky action bar ở chân trang khi scroll dài (đã có <code>StickyActionBar</code>).</li>
        <li><strong>Trang detail (read):</strong> Primary là action workflow chính (vd "Xác nhận đơn"). Danger gom vào card "Thao tác nguy hiểm" ở cột phải, dưới cùng.</li>
      </ul>

      {/* ═══════════ 4. DESIGN SYSTEM SPEC ═══════════ */}
      <h2>4. Design system / component spec</h2>

      <h3>4.1 Layout shell</h3>
      <ul>
        <li><strong>Sidebar:</strong> 248px, nền <code>#0d1117</code>, group label uppercase 10px, item 13px / 7px padding ngang 10px, active có 3px brand bar bên trái + bg <code>#20293a</code>. Badge "cần xử lý" dạng pill đỏ brand cho /orders; muted gray cho các module khác.</li>
        <li><strong>Topbar:</strong> 52px, surface trắng, border-bottom 1px. Search input 32px, max-width 480px.</li>
        <li><strong>Content gutter:</strong> 24px ngang, 20px trên, 64px dưới (để chỗ cho sticky action bar).</li>
        <li><strong>Mobile:</strong> sidebar trở thành drawer (đã có sẵn trong <code>AdminShell</code>); breadcrumb có thể ẩn dưới 640px.</li>
      </ul>

      <h3>4.2 Buttons</h3>
      <table>
        <thead><tr><th>Variant</th><th>Dùng khi</th><th>Token</th></tr></thead>
        <tbody>
          <tr><td>Primary</td><td>1 hành động quan trọng nhất / màn</td><td>bg <code>--bb-brand</code>, text white</td></tr>
          <tr><td>Secondary</td><td>Hành động phụ ngang hàng primary</td><td>bg surface, border <code>--bb-border-strong</code></td></tr>
          <tr><td>Ghost</td><td>Inline, utility, "Xoá bộ lọc", "Xem tất cả"</td><td>bg transparent, hover surface-hover</td></tr>
          <tr><td>Danger</td><td>Xoá vĩnh viễn, huỷ đơn, hoàn tiền — phải kèm confirm</td><td>bg <code>--bb-danger</code></td></tr>
          <tr><td>Danger ghost</td><td>Trong "Danger zone" cùng card</td><td>text <code>--bb-danger</code>, bg transparent</td></tr>
          <tr><td>Icon</td><td>Row actions, topbar utilities</td><td>32×32, no label, có tooltip</td></tr>
        </tbody>
      </table>
      <p>Heights: <code>sm 26px · default 32px · lg 38px</code>. Loading state: disable + label đổi sang "Đang lưu…".</p>

      <h3>4.3 Form controls</h3>
      <ul>
        <li>Label luôn nằm trên control. Required dấu (<span style={{color:"var(--bb-danger)"}}>*</span>) đỏ. Helper text 11.5px dưới control.</li>
        <li>Error state: viền đỏ + helper text chuyển đỏ thay thế. Error phải nêu lỗi VÀ cách sửa (vd "Slug chỉ gồm chữ thường, số và dấu gạch ngang").</li>
        <li>Không dùng placeholder thay label.</li>
        <li>Input/Select/Textarea: 34px height, radius 6px, focus = brand border + brand-muted ring 3px.</li>
        <li>Switch dùng cho boolean nhanh; checkbox cho multi-select; radio cho single-select ≤4 options.</li>
        <li>Date range, media picker, rich text — đã có sẵn, dùng lại nguyên bản, KHÔNG viết mới.</li>
      </ul>

      <h3>4.4 Data table</h3>
      <ul>
        <li>Header: bg <code>surface-muted</code>, font 11.5px uppercase 0.04em, padding 10×12.</li>
        <li>Row: 44px height, font 13px, hover bg <code>surface-muted</code>, selected bg <code>brand-subtle</code>.</li>
        <li>Mã đơn, SKU, ID dùng font mono.</li>
        <li>Cột tiền/số dùng <code>text-align: right</code> + <code>font-variant-numeric: tabular-nums</code>.</li>
        <li>Cột action ở cuối, width: 1%, white-space: nowrap, 1-3 icon button.</li>
        <li>Empty: dùng <code>StatePanel</code> với CTA quay về hành động kế.</li>
        <li>Loading: skeleton 5 rows (đã có pattern trong codebase).</li>
        <li>Error: state panel màu danger + nút "Thử lại".</li>
        <li>Pagination: server-driven, dùng <code>PaginationControls</code> đã có. Page size 20/50/100.</li>
        <li>Responsive: dưới 640px, mỗi row thành card 2 cột (label/value) qua <code>MobileCardList</code>.</li>
      </ul>

      <h3>4.5 Status badge palette</h3>
      <table>
        <thead><tr><th>Loại</th><th>success</th><th>warning</th><th>danger</th><th>info</th><th>neutral</th></tr></thead>
        <tbody>
          <tr><td>Đơn hàng</td><td>Hoàn thành</td><td>Chờ xác nhận</td><td>Thất bại</td><td>Đang xử lý</td><td>Tạm giữ / Huỷ / Hoàn tiền</td></tr>
          <tr><td>Thanh toán</td><td>Đã thanh toán</td><td>Chưa thanh toán / Đang chờ</td><td>Thất bại</td><td>—</td><td>Đã huỷ / Đã hoàn</td></tr>
          <tr><td>Tồn kho</td><td>Còn hàng</td><td>Sắp hết</td><td>Hết hàng</td><td>—</td><td>Không rõ</td></tr>
          <tr><td>Xuất bản</td><td>Đã xuất bản</td><td>—</td><td>—</td><td>—</td><td>Nháp / Ẩn / Lưu trữ</td></tr>
          <tr><td>Công nợ</td><td>Đã thanh toán</td><td>Còn nợ</td><td>Quá hạn</td><td>—</td><td>—</td></tr>
          <tr><td>Khách hàng</td><td>Hoạt động</td><td>Chờ duyệt</td><td>Bị cấm</td><td>—</td><td>Tạm khoá</td></tr>
        </tbody>
      </table>

      <h3>4.6 Feedback (toast / alert / confirm)</h3>
      <ul>
        <li><strong>Toast:</strong> 4 tone, vị trí top-right, auto-dismiss 4-5s. Title + 1 dòng message. Không lồng action complex vào toast.</li>
        <li><strong>Inline alert:</strong> 4 tone, đặt trong page hoặc card. Dùng cho cảnh báo persistent (vd "Checklist chưa hoàn thành", "Đang ở chế độ chỉ đọc").</li>
        <li><strong>Confirm dialog:</strong> Title phải nêu rõ đối tượng và hậu quả ("Huỷ đơn hàng BB-25-04822?"). Nút primary nằm bên phải, danger nếu là phá huỷ. Modal width 440px (lg 640px).</li>
      </ul>

      <h3>4.7 Empty / loading / error states</h3>
      <ul>
        <li>Mọi list/detail bắt buộc có cả 3. Dùng <code>StatePanel</code> đã có.</li>
        <li>Empty phải có CTA hoặc gợi ý: "Tạo sản phẩm đầu tiên", "Xoá bộ lọc".</li>
        <li>Submitting state: button disabled + label "Đang lưu…" + opacity 0.5. Tránh double submit.</li>
      </ul>

      <h3>4.8 Responsive rules</h3>
      <table>
        <thead><tr><th>Breakpoint</th><th>Hành vi</th></tr></thead>
        <tbody>
          <tr><td>≥1100px</td><td>2-cột detail (form 1fr / meta 320px). KPI 4-6 cột. Sidebar mở.</td></tr>
          <tr><td>900-1100px</td><td>Detail xếp 1 cột (meta xuống dưới). KPI 3 cột. Sidebar vẫn mở.</td></tr>
          <tr><td>640-900px</td><td>Sidebar thành drawer (đã có). Table giữ horizontal scroll trong container có border. KPI 2 cột.</td></tr>
          <tr><td>≤640px</td><td>Table → card list. Filter bar wrap. Page actions trải hàng riêng. KPI 1 cột.</td></tr>
        </tbody>
      </table>

      {/* ═══════════ 5. PAGE-BY-PAGE SPEC ═══════════ */}
      <h2>5. Page-by-page design spec</h2>

      <h3>5.1 Bán hàng</h3>

      <PageSpec
        name="Dashboard"
        route="/admin/dashboard"
        purpose="Tổng quan kinh doanh thời gian thực. Admin mở đầu ngày để biết: hôm nay có việc gì cần làm trước, có vấn đề gì cần xử lý."
        primary="—"
        secondary="Refresh · Chuyển kỳ 7/30/90 ngày"
        dataKey="6 KPI · Việc cần xử lý · Doanh thu theo ngày · Cơ cấu đơn hàng · Đơn gần nhất · Top sản phẩm"
        layout="Greeting + period seg → KPI grid (6 cols) → 'Việc cần xử lý' card → 2-col charts (revenue + donut) → 2-col list (recent orders + top products)"
        components={["SummaryCard","StatePanel","StatusBadge","AdminTable","layout/Screen"]}
        empty="Khi tài khoản mới: card 'Chưa có đơn hàng nào — đơn mới sẽ xuất hiện tại đây'"
        loading="Skeleton cho từng card riêng biệt — không block toàn page"
        error="StatePanel danger ở vị trí KPI nếu API fail; các block còn lại vẫn render"
        responsive="6 KPI → 4 / 3 / 2 / 1 col theo breakpoint. Charts xếp dọc ≤900px."
        problems={[
          "Greeting hiện chiếm nhiều chiều cao trong khi ít giá trị vận hành.",
          "Section 'Việc cần xử lý' bị chèn xa khỏi KPI — admin phải scroll mới thấy.",
        ]}
        recs={[
          "Gom greeting + period selector vào 1 hàng.",
          "Đưa 'Việc cần xử lý' lên ngay dưới KPI, trước khi đến charts.",
          "Sắp xếp lại KPI: tài chính trước (revenue, AR), vận hành sau (pending, low stock).",
        ]}
      />

      <PageSpec
        name="Đơn hàng (list)"
        route="/admin/orders"
        purpose="Trung tâm vận hành. Admin scan, lọc, xác nhận, in phiếu giao, huỷ hàng loạt."
        primary="Tạo đơn POS"
        secondary="Export CSV · Lọc nâng cao · Reset filter"
        dataKey="Mã đơn · Thời gian · Khách hàng · Tổng tiền · Trạng thái · Thanh toán · Vận chuyển"
        layout="Header → status segmented tabs (8) → filter bar → table → bulk action bar (sticky bottom khi có chọn)"
        components={["AdminTable","FilterBar","BulkActionBar","layout/Tabs","StatusBadge","PaginationControls"]}
        empty="StatePanel với 2 CTA: 'Xoá bộ lọc' hoặc 'Tạo đơn POS'"
        loading="Skeleton 10 rows"
        error="StatePanel + 'Thử lại'"
        responsive="Ẩn cột Vận chuyển ≤1024px; ẩn cột Thanh toán ≤900px; chuyển card list ≤640px"
        problems={[
          "Status tabs hiện đôi khi wrap xuống 2 hàng làm rối filter.",
          "Cột actions ở cuối lúc dài có thể bị tràn ngang.",
        ]}
        recs={[
          "Cho status tabs scroll ngang ≤900px thay vì wrap.",
          "Đảm bảo cột action cố định (sticky right) khi table scroll ngang.",
        ]}
      />

      <PageSpec
        name="Chi tiết đơn hàng"
        route="/admin/orders/:id"
        purpose="Xử lý 1 đơn cụ thể: xác nhận, in phiếu, đổi địa chỉ, ghi nhận thanh toán, huỷ/hoàn tiền."
        primary="Xác nhận đơn (theo trạng thái hiện tại)"
        secondary="In phiếu giao · Sao chép đơn · Sửa địa chỉ giao"
        dataKey="Status flow (5 step) · Items table · Tổng tiền · Khách · Giao hàng · Thanh toán · Lịch sử thao tác · Danger zone"
        layout="Header (badge + actions) → status flow visual → 2-col grid: trái (items, notes, activity); phải (customer, shipping, payment, danger)"
        components={["DetailSection","StatusBadge","RefundModal","ConfirmDialog","StickyActionBar"]}
        empty="Trường hợp đơn không có items → empty card 'Đơn không có sản phẩm — vui lòng kiểm tra'"
        loading="Skeleton header + skeleton 2-col"
        error="StatePanel danger toàn trang nếu không load được"
        responsive="2-col → 1-col ≤1100px. Status flow co lại, vẫn 5 step ngang."
        problems={[
          "Hiện tại danger actions trộn lẫn với action thường → nguy cơ click nhầm.",
          "Status flow không trực quan — phải đọc badge để biết đang ở đâu.",
        ]}
        recs={[
          "Tách 'Danger zone' thành card riêng border đỏ ở cuối cột phải.",
          "Thêm progress flow 5-step ở đầu detail để admin scan trạng thái không cần đọc.",
        ]}
      />

      <PageSpec
        name="POS"
        route="/admin/pos"
        purpose="Tạo đơn tại quầy. Nhân viên cần thao tác cực nhanh — barcode/SKU search, chọn variant, tính tiền, thanh toán đa phương thức, in hoá đơn."
        primary="Thanh toán"
        secondary="Lưu giỏ tạm · In hoá đơn · Xoá giỏ"
        dataKey="Search bar · Sản phẩm grid/list · Giỏ hàng (variant, qty, giá) · Tổng · Phương thức thanh toán"
        layout="Full-bleed (ẩn breadcrumb), 2 cột chính: trái search+products grid (2/3), phải giỏ hàng + thanh toán (1/3, sticky)"
        components={["AdminTable","Modal","StatusBadge","RefundModal"]}
        empty="Giỏ trống: 'Quét mã hoặc tìm sản phẩm để bắt đầu'"
        loading="—"
        error="Inline alert trong giỏ nếu sản phẩm hết hàng"
        responsive="Tablet vẫn 2-col; mobile (≤640) giỏ thành bottom sheet"
        problems={["UI POS hiện gần giống admin thường — không tối ưu cho thao tác bằng phím."]}
        recs={[
          "Cho focus tự động vào ô search khi mở.",
          "Hotkey: F2 thanh toán, F4 lưu giỏ tạm, F9 in hoá đơn.",
          "Nút thanh toán cao 48px, full-width trong cột phải.",
        ]}
      />

      <PageSpec
        name="Khách hàng (list)"
        route="/admin/customers"
        purpose="Tìm khách, xem chi tiêu tích luỹ, mở hồ sơ."
        primary="Thêm khách hàng"
        secondary="Export"
        dataKey="Mã KH · Tên · Liên hệ · Số đơn · Tổng chi · Trạng thái"
        layout="Header → filter bar → table → pagination"
        components={["AdminTable","FilterBar","StatusBadge"]}
        empty="StatePanel + 'Thêm khách hàng đầu tiên'"
        loading="Skeleton"
        error="StatePanel + retry"
        responsive="Ẩn cột liên hệ ≤900px; card list ≤640px"
      />

      <PageSpec
        name="Chi tiết khách hàng"
        route="/admin/customers/:id"
        purpose="Hồ sơ + lịch sử mua hàng + công nợ + ghi chú nội bộ."
        primary="Tạo đơn cho khách này"
        secondary="Sửa hồ sơ · Tạm khoá tài khoản · Reset mật khẩu"
        dataKey="Profile · Stats (tổng đơn, tổng chi, LTV) · Lịch sử đơn · Công nợ liên kết · Ghi chú"
        layout="2-col grid như order detail"
        components={["DetailSection","StatusBadge","AdminTable"]}
        empty="—" loading="Skeleton" error="StatePanel + retry"
        responsive="2-col → 1-col"
      />

      <PageSpec
        name="Email đăng ký nhận tin"
        route="/admin/newsletter-subscribers"
        purpose="Quản lý subscriber list cho marketing."
        primary="Export danh sách"
        secondary="Xoá subscriber"
        dataKey="Email · Ngày đăng ký · Nguồn · Trạng thái"
        layout="List đơn giản, không cần detail page"
        components={["AdminTable","FilterBar"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Đổi trả"
        route="/admin/returns"
        purpose="Xử lý yêu cầu đổi/trả từ khách."
        primary="—"
        secondary="Duyệt yêu cầu · Từ chối"
        dataKey="Mã yêu cầu · Đơn gốc · Khách · Lý do · Trạng thái · Ngày tạo"
        layout="Status tabs (chờ duyệt / đã duyệt / từ chối) + table"
        components={["AdminTable","StatusBadge","ConfirmDialog"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Công nợ (list)"
        route="/admin/receivables"
        purpose="Theo dõi và thu hồi công nợ. Cảnh báo quá hạn rõ ràng."
        primary="Tạo phiếu thu"
        secondary="Export"
        dataKey="Mã phiếu · Khách · Tổng nợ · Đã trả · Còn lại · Đến hạn · Trạng thái"
        layout="4 KPI (tổng phải thu, quá hạn, đến hạn 7 ngày, thu trong tháng) → status tabs → filter → table"
        components={["SummaryCard","AdminTable","FilterBar","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="KPI 2 cols ≤900px; card list ≤640px"
        recs={["Cột 'Đến hạn' phải hiển thị cả ngày + 'Còn N ngày' / 'Quá N ngày' để admin scan nhanh."]}
      />

      <PageSpec
        name="Chi tiết công nợ"
        route="/admin/receivables/:id"
        purpose="Ghi nhận thu tiền, xoá nợ, xem lịch sử thanh toán."
        primary="Ghi nhận thanh toán"
        secondary="Xoá nợ · Gửi nhắc nợ"
        dataKey="Thông tin phiếu · Lịch sử trả · Đơn liên kết · Activity"
        layout="2-col detail"
        components={["DetailSection","ConfirmDialog","AdminTable"]}
        empty="—" loading="Skeleton" error="StatePanel"
        responsive="1-col ≤1100px"
      />

      <PageSpec
        name="Đánh giá (list + detail)"
        route="/admin/reviews"
        purpose="Duyệt review từ khách trước khi hiển thị public."
        primary="Duyệt review"
        secondary="Ẩn · Đánh dấu spam"
        dataKey="Sản phẩm · Khách · Rating · Trích nội dung · Trạng thái"
        layout="Status tabs + table + detail modal/page"
        components={["AdminTable","StatusBadge","ConfirmDialog"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Mã giảm giá"
        route="/admin/coupons"
        purpose="Tạo và quản lý coupon."
        primary="Tạo mã giảm giá"
        secondary="Sao chép · Vô hiệu hoá"
        dataKey="Code · Loại (%, ₫) · Giá trị · Bắt đầu · Hết hạn · Đã dùng/Tổng · Trạng thái"
        layout="Filter + table; tạo/sửa trong modal (form vừa phải, không cần page riêng)"
        components={["AdminTable","Modal","StatusBadge","DateRangePicker"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <h3>5.2 Sản phẩm</h3>

      <PageSpec
        name="Sản phẩm (list)"
        route="/admin/products"
        purpose="Catalog management. Admin tạo, sửa, kiểm tra status, đẩy sản phẩm lên trang chủ."
        primary="Tạo sản phẩm"
        secondary="Export · Lọc nâng cao"
        dataKey="Thumb · Tên + SKU · Brand · Category · Giá · Publish · Stock · Cập nhật"
        layout="Header → filter bar (search + 4 select) → table → pagination"
        components={["AdminTable","FilterBar","StatusBadge","PaginationControls"]}
        empty="StatePanel + 'Tạo sản phẩm đầu tiên'"
        loading="Skeleton 10 rows"
        error="StatePanel + retry"
        responsive="Ẩn cột Brand/Cập nhật ≤900px; card list ≤640px"
      />

      <PageSpec
        name="Tạo / Sửa sản phẩm"
        route="/admin/products/:id  ·  /admin/products/new"
        purpose="Form dài chia section. Hỗ trợ checklist trước khi publish, focus mode (F11)."
        primary="Lưu thay đổi"
        secondary="Xem trên site · Lưu nháp · Sao chép · Xoá"
        dataKey="Thông tin cơ bản · Giá & trạng thái · Biến thể · Media & SEO · Specs · FAQs · Nội dung dài · Related"
        layout="2-col: trái (form sections); phải (Checklist + Phân công + Info)"
        components={["BlockEditor","RichTextEditor","MediaPickerModal","TagInput","ImageUrlInput","ConfirmDialog","StickyActionBar"]}
        empty="Khi chưa có biến thể: empty card 'Chưa có biến thể. Thêm biến thể đầu tiên.'"
        loading="Skeleton form" error="StatePanel + 'Quay lại danh sách'"
        responsive="1-col ≤1100px; sticky bar bottom thay vì header save"
        problems={[
          "Form quá dài, không có section navigator → khó scroll.",
          "Checklist không nhìn thấy khi form gập 1 col.",
        ]}
        recs={[
          "Thêm sidebar navigator (anchor links) bên trái khi viewport ≥1200px.",
          "Khi gập 1 col, đưa Checklist lên đầu thay vì cuối.",
        ]}
      />

      <PageSpec
        name="Sản phẩm nổi bật"
        route="/admin/featured-products"
        purpose="Sắp xếp sản phẩm hiển thị ở khối nổi bật / gợi ý trên home page (giới hạn 12)."
        primary="Lưu thứ tự"
        secondary="Thêm sản phẩm · Reset"
        dataKey="Block (Featured/Recommended) · Drag-drop list · Limit warning"
        layout="Tabs theo block → drag-and-drop list + add picker"
        components={["MediaPickerModal","StatusBadge"]}
        empty="StatePanel + 'Thêm sản phẩm đầu tiên'"
        loading="Skeleton" error="StatePanel"
        responsive="1-col"
        recs={["Hiển thị warning rõ khi vượt limit: 'Trang chủ chỉ hiển thị 12 sản phẩm — số dư bị bỏ qua âm thầm.'"]}
      />

      <PageSpec
        name="Kho hàng"
        route="/admin/inventory"
        purpose="Theo dõi tồn kho theo SKU, cảnh báo sắp hết / hết hàng, điều chỉnh thủ công."
        primary="Điều chỉnh tồn"
        secondary="Export · Nhập kho (CSV)"
        dataKey="SKU · Biến thể · Brand · Tồn hiện tại · Ngưỡng cảnh báo · Trạng thái"
        layout="4 KPI → filter + status seg → table"
        components={["SummaryCard","AdminTable","FilterBar","StatusBadge","ConfirmDialog"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="KPI 2 ≤900px; card list ≤640px"
      />

      <PageSpec
        name="Quản lý serial"
        route="/admin/serials"
        purpose="Quản lý serial number cho từng sản phẩm có serial (vd nón AGV)."
        primary="Nhập serial"
        secondary="Export · Tra cứu"
        dataKey="Serial · Sản phẩm · Trạng thái (in_stock/sold/warranty) · Khách · Đơn gốc"
        layout="Filter + table"
        components={["AdminTable","FilterBar","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Bảo hành"
        route="/admin/warranties"
        purpose="Phiếu bảo hành — tra cứu, xác nhận BH, đóng phiếu."
        primary="Tạo phiếu BH"
        secondary="—"
        dataKey="Mã phiếu · Serial · Khách · Ngày BH · Trạng thái"
        layout="Filter + table; detail trong modal hoặc page riêng"
        components={["AdminTable","FilterBar","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Danh mục"
        route="/admin/categories  ·  /admin/categories/:id  ·  /new"
        purpose="CRUD danh mục sản phẩm. Hỗ trợ cây phân cấp."
        primary="Tạo danh mục"
        secondary="—"
        dataKey="Tên · Slug · Sản phẩm count · Trạng thái"
        layout="Tree view + side panel detail, hoặc list + detail page (tuỳ codebase hiện hỗ trợ)"
        components={["AdminTable","StatusBadge","ImageUrlInput"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="1-col ≤900px"
      />

      <PageSpec
        name="Thương hiệu"
        route="/admin/brands  ·  /:id  ·  /new"
        purpose="CRUD brand."
        primary="Tạo thương hiệu"
        secondary="—"
        dataKey="Logo · Tên · Slug · Sản phẩm count"
        layout="List + detail"
        components={["AdminTable","ImageUrlInput"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Thuộc tính"
        route="/admin/attributes"
        purpose="Quản lý attribute (vd Màu sắc, Size) và giá trị."
        primary="Tạo thuộc tính"
        secondary="—"
        dataKey="Tên · Loại · Số giá trị"
        layout="List + nested values (drawer)"
        components={["AdminTable","TagInput"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="1-col"
      />

      <h3>5.3 Nội dung & Marketing</h3>

      <PageSpec
        name="Nội dung (Pages / Articles)"
        route="/admin/content  ·  /admin/content/:type/:id  ·  /new"
        purpose="CMS đơn giản: trang tĩnh và bài viết. Editor block-based."
        primary="Xuất bản"
        secondary="Lưu nháp · Xem trên site"
        dataKey="Tiêu đề · Slug · Loại · Trạng thái · Tác giả · Cập nhật"
        layout="List → detail editor 2-col (content + meta/SEO)"
        components={["BlockEditor","RichTextEditor","StatusBadge","MediaPickerModal"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Editor 1-col ≤900px"
      />

      <PageSpec
        name="Banner"
        route="/admin/sliders"
        purpose="Quản lý slider hero/banner trên home."
        primary="Thêm banner"
        secondary="Sắp xếp"
        dataKey="Ảnh · Tiêu đề · Link · Thứ tự · Trạng thái"
        layout="Card grid với drag-reorder"
        components={["MediaPickerModal","ImageUrlInput","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="2-col ≤900px; 1-col ≤640px"
      />

      <PageSpec
        name="Video trang chủ"
        route="/admin/home-videos"
        purpose="Quản lý video showcase trên home (YouTube embed hoặc upload)."
        primary="Thêm video"
        secondary="—"
        dataKey="Thumbnail · Tiêu đề · URL · Trạng thái"
        layout="List/grid"
        components={["VideoPickerModal","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Grid 1-col ≤640px"
      />

      <PageSpec
        name="Highlights trang chủ"
        route="/admin/home-highlights"
        purpose="Cấu hình các block nổi bật trên home."
        primary="Lưu cấu hình"
        secondary="—"
        dataKey="Block · Tiêu đề · Nội dung · Link"
        layout="Form sections, mỗi block 1 card"
        components={["MediaPickerModal","ImageUrlInput"]}
        empty="—" loading="Skeleton" error="StatePanel"
        responsive="1-col ≤900px"
      />

      <PageSpec
        name="Chuyển hướng"
        route="/admin/redirects"
        purpose="Quản lý 301/302 redirects để giữ SEO khi đổi URL."
        primary="Thêm chuyển hướng"
        secondary="Import CSV · Export"
        dataKey="From · To · Loại (301/302) · Trạng thái · Cập nhật"
        layout="Filter + table; tạo/sửa trong modal"
        components={["AdminTable","Modal","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Menu"
        route="/admin/menus"
        purpose="Quản lý menu header/footer site."
        primary="Lưu menu"
        secondary="Thêm mục"
        dataKey="Tree menu items"
        layout="Tree drag-drop + form mục bên phải"
        components={["DetailSection"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="1-col"
      />

      <PageSpec
        name="Thư viện (Media library)"
        route="/admin/media"
        purpose="Quản lý ảnh/video upload — folder, tìm kiếm, dùng lại trong product/content."
        primary="Upload"
        secondary="Tạo folder · Xoá"
        dataKey="Folder tree · Grid ảnh · Detail panel (size, dimension, alt, dùng ở đâu)"
        layout="3-pane: folder tree trái · grid giữa · detail panel phải"
        components={["MediaCard","MediaFolderSidebar","MediaDetailPanel","MediaPreviewLightbox","useDragDropUpload"]}
        empty="StatePanel + 'Upload ảnh đầu tiên'"
        loading="MediaCardSkeleton grid" error="StatePanel"
        responsive="Hide detail panel ≤1100px (mở modal); hide folder tree ≤900px (drawer)"
      />

      <h3>5.4 Báo cáo</h3>

      <PageSpec
        name="Báo cáo"
        route="/admin/reports"
        purpose="Báo cáo doanh thu, đơn, sản phẩm, khách hàng theo kỳ."
        primary="Export báo cáo"
        secondary="Chuyển kỳ · Đổi loại báo cáo"
        dataKey="Date range picker · Loại report · KPI tổng · Chart · Bảng chi tiết"
        layout="Header với date picker + report-type select → KPI → chart → table"
        components={["DateRangePicker","SummaryCard","AdminTable","StatePanel"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="KPI 2-col ≤900px"
      />

      <h3>5.5 Hệ thống</h3>

      <PageSpec
        name="Vận chuyển"
        route="/admin/shipping"
        purpose="Cấu hình đơn vị vận chuyển (GHN, GHTK, …) và bảng phí."
        primary="Lưu cấu hình"
        secondary="—"
        dataKey="List providers · Bảng phí theo vùng/cân nặng"
        layout="Tabs theo provider + form"
        components={["DetailSection","layout/Tabs"]}
        empty="—" loading="Skeleton" error="StatePanel"
        responsive="1-col ≤900px"
      />

      <PageSpec
        name="Cài đặt"
        route="/admin/settings"
        purpose="Cấu hình toàn cục: doanh nghiệp, store, payment, email, SEO mặc định, sao lưu."
        primary="Lưu cài đặt"
        secondary="—"
        dataKey="Multiple section tabs"
        layout="Tabs ngang → form sections"
        components={["layout/Tabs","DetailSection","FormField"]}
        empty="—" loading="Skeleton" error="StatePanel"
        responsive="1-col ≤900px"
      />

      <PageSpec
        name="Quản trị viên"
        route="/admin/admin-users"
        purpose="CRUD admin staff."
        primary="Thêm quản trị viên"
        secondary="—"
        dataKey="Tên · Email · Roles · Trạng thái · Lần cuối đăng nhập"
        layout="List + modal create/edit"
        components={["AdminTable","Modal","StatusBadge"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      <PageSpec
        name="Phân quyền"
        route="/admin/roles"
        purpose="CRUD role và assign permissions."
        primary="Tạo role"
        secondary="—"
        dataKey="Role · Số người dùng · Số permissions"
        layout="List + detail page (matrix permissions)"
        components={["AdminTable","ConfirmDialog"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="1-col"
      />

      <PageSpec
        name="Nhật ký (Audit logs)"
        route="/admin/audit-logs"
        purpose="Trace hoạt động admin để debug và đảm bảo tuân thủ."
        primary="Export"
        secondary="—"
        dataKey="Time · User · Action · Object · IP"
        layout="Filter (user, action, date range) + table"
        components={["AdminTable","FilterBar","DateRangePicker"]}
        empty="StatePanel" loading="Skeleton" error="StatePanel"
        responsive="Card list ≤640px"
      />

      {/* ═══════════ 7. IMPLEMENTATION GUIDANCE ═══════════ */}
      <h2>6. Implementation guidance cho dev</h2>

      <h3>6.1 Refactor / Reuse</h3>
      <ul>
        <li><strong>Refactor list pages</strong> để đều dùng <code>useAdminList</code> + <code>FilterBar</code> + <code>AdminTable</code>. Audit từng screen để loại các inline CSS lặp lại.</li>
        <li><strong>Refactor SummaryCard</strong> — thêm prop <code>tone</code> và <code>icon</code> để dùng nhất quán cả 4-6 KPI dashboard và 4-KPI inventory/receivables.</li>
        <li><strong>StatusBadge</strong> — bắt buộc dùng cho TẤT CẢ status. Audit screen nào còn render badge bằng span+inline-style → thay thế.</li>
        <li><strong>Sticky action bar</strong> — áp dụng nhất quán cho cả product detail, content detail, settings.</li>
        <li><strong>MobileCardList</strong> — wrap mọi table bằng pattern này để tự động chuyển card ≤640px.</li>
      </ul>

      <h3>6.2 Token / style chuẩn hoá</h3>
      <ul>
        <li>Mọi screen mới phải dùng <code>--admin-color-*</code> tokens từ <code>admin-tokens.css</code>. Cấm hex literal trong JSX style trừ khi là demo.</li>
        <li>Bổ sung short alias đã có (<code>--c-text-primary</code>, <code>--c-danger</code>, …) cho code mới — đỡ verbose.</li>
        <li>Spacing: chỉ dùng 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40. Không có 5, 14, 18, 22.</li>
        <li>Radius: 4 (input mini) / 6 (input, button) / 8 (card) / 12 (modal) / 9999 (pill).</li>
      </ul>

      <h3>6.3 Thay đổi chỉ là UI (an toàn)</h3>
      <ul>
        <li>Sửa CSS tokens (lạnh hơn slate), sửa spacing/density bảng dữ liệu.</li>
        <li>Thay vị trí 'Việc cần xử lý' trên Dashboard.</li>
        <li>Sắp xếp lại sidebar (giữ nguyên 5 group hiện có).</li>
        <li>Thêm status flow visual trong Order detail (UI overlay đọc từ <code>order.status</code>).</li>
        <li>Tách Danger zone trong Order detail thành card riêng.</li>
        <li>Áp pattern <code>MobileCardList</code> cho tất cả list pages.</li>
      </ul>

      <h3>6.4 Cần backend / API support (đánh dấu rõ)</h3>
      <ul>
        <li><Pill kind="warn">Recommendation</Pill> <strong>Bulk action xác nhận đơn:</strong> cần API <code>POST /admin/orders/bulk-confirm</code>. Hiện chỉ có per-order endpoint.</li>
        <li><Pill kind="warn">Recommendation</Pill> <strong>Dashboard "Việc cần xử lý" aggregate:</strong> cần 1 endpoint trả về counts cho pending orders, overdue receivables, pending returns, low stock — thay vì FE gọi 4 endpoint.</li>
        <li><Pill kind="warn">Recommendation</Pill> <strong>Inventory threshold per-SKU:</strong> nếu backend chưa lưu ngưỡng cảnh báo per-SKU, đề xuất thêm trường <code>lowStockThreshold</code>.</li>
        <li><Pill kind="warn">Recommendation</Pill> <strong>Audit log search by object:</strong> để có thể click 1 đơn → xem mọi log liên quan đơn đó.</li>
      </ul>

      <h3>6.5 Risk list</h3>
      <ul>
        <li><strong>Dark mode regression:</strong> nhiều screen cũ inline hex literal — đổi token có thể không phủ. Cần audit toàn bộ.</li>
        <li><strong>Recharts colors:</strong> đã reference token rồi, nhưng nếu đổi background sidebar/page thì cần re-check contrast.</li>
        <li><strong>I18n:</strong> Mọi label mới phải vào <code>locales/vi.json</code> và <code>en.json</code>. Có script <code>scripts/check-i18n.js</code> sẽ fail nếu thiếu.</li>
        <li><strong>Permission gating:</strong> Mọi action mới (vd bulk confirm) phải kiểm tra <code>hasPermission()</code> tương ứng — không hard-code true.</li>
        <li><strong>WS sync:</strong> List screen có subscribe ws phải invalidate query đúng — cẩn thận khi đổi cấu trúc URL/query.</li>
        <li><strong>Focus mode:</strong> Sticky action bar có thể chồng nội dung khi focus mode bật — kiểm tra z-index.</li>
      </ul>

      {/* ═══════════ 8. ACCEPTANCE ═══════════ */}
      <h2>7. Acceptance criteria</h2>
      <ol>
        <li>Mọi list screen trong codebase render đúng pattern: header + filter bar + table + pagination. Không screen nào tự định nghĩa layout riêng.</li>
        <li>Mọi detail screen dùng đúng 2-col grid (form/meta) và xếp 1-col ≤1100px mà KHÔNG vỡ layout.</li>
        <li>Mọi thao tác phá huỷ (huỷ đơn, xoá, hoàn tiền, write-off, vô hiệu hoá user) có confirm dialog nêu rõ đối tượng + hậu quả.</li>
        <li>Mọi mutation success → toast 4-5s tone success, message ngắn.</li>
        <li>Mọi form field có label nằm trên, không dùng placeholder thay label. Error nêu rõ lỗi + cách sửa.</li>
        <li>Status badge dùng đúng 5 tone từ palette. Không có màu badge ngoài palette.</li>
        <li>Submitting state disable button + thay label "Đang lưu…". Không thể double submit.</li>
        <li>Text contrast: body text ratio ≥4.5:1 với background. Muted text ≥3:1.</li>
        <li>Không có scroll ngang ở any breakpoint trừ trong container table có border.</li>
        <li>Không có element CSS animation chạy {">"} 200ms ngoài skeleton shimmer.</li>
        <li>Sidebar nav active state rõ ràng (brand bar trái + bg distinct).</li>
        <li>Mọi page có loading skeleton, empty state với CTA, error state với retry.</li>
        <li>Dark mode pass toàn bộ 40 screens — không có "ô trắng" leak.</li>
        <li>Mobile (≤640px): bảng → card list; sidebar → drawer; KPI 1-col.</li>
        <li>Không screen nào bị bỏ sót so với route inventory mục 1.2.</li>
      </ol>

      <h2>Phụ lục: Quick-ref</h2>
      <ul>
        <li>Brand color phải dùng có chủ đích — primary button + active sidebar + 1-2 nơi nhỏ. Không dùng cho icon trang trí.</li>
        <li>Mã đơn, SKU, ID luôn font mono — dễ nhận biết.</li>
        <li>Cột tiền luôn right-aligned, tabular-nums.</li>
        <li>Mọi cards group quanh 1 chủ đề rõ — không bỏ chung "info + activity + actions" vào 1 card.</li>
        <li>Khi nghi ngờ, ưu tiên ÍT hơn nhiều hơn.</li>
      </ul>
    </div>
  );
}

window.SpecDoc = SpecDoc;
