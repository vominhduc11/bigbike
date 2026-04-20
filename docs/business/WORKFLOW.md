# WORKFLOW.md

> Workflow document cho BigBike.
>
> File này mô tả luồng thao tác cụ thể theo vai trò, màn hình và trạng thái vận hành.
>
> Khác với `BUSINESS_RULES.md` và `BUSINESS_PROCESS.md`:
> - Business Rules = luật.
> - Business Process = quy trình lớn end-to-end.
> - Workflow = các bước thao tác thực tế để hoàn thành việc.
>
> Một lần nữa, vì cần nhắc: file này không phải API contract, không phải DB schema, không phải design token. Nếu trộn hết, tài liệu sẽ thành món lẩu mà không ai dám ăn.

---

## 1. Purpose

`WORKFLOW.md` mô tả cách các actor sử dụng hệ thống BigBike để hoàn thành công việc cụ thể.

File này dùng cho:

- Developer hiểu flow trước khi code.
- AI agent biết không bỏ sót state.
- QA/tester biết kiểm thử happy path và edge cases.
- Product/admin thống nhất cách vận hành.
- Frontend/backend hiểu điểm giao nhau.

File này không định nghĩa:

- Enum chính thức.
- API endpoint.
- Database schema.
- UI token.
- Business formula chi tiết.

---

## 2. Workflow Principles

### 2.1 Every workflow has states

Mỗi workflow phải có:

- Initial state.
- Loading state.
- Success state.
- Empty state nếu có collection.
- Error state.
- Permission state nếu liên quan admin.
- Recovery/Retry path.

### 2.2 Every destructive action needs confirmation

Các action như xóa, hủy, disable, bulk update, publish/unpublish quan trọng phải có confirmation.

### 2.3 Backend validates final action

Frontend workflow không được là enforcement duy nhất.

Backend phải validate:

- Quyền.
- Giá.
- Tồn kho.
- Trạng thái.
- Payment/order transition.
- Dữ liệu required.

### 2.4 User should know next step

Mỗi workflow kết thúc phải nói rõ:

- Thành công hay thất bại.
- Tiếp theo nên làm gì.
- Có cần chờ shop/admin/customer không.

---

## 3. Customer Product Discovery Workflow

### 3.1 Actor

Customer.

### 3.2 Entry

- Homepage.
- Category page.
- Search result.
- Article/internal link.
- Product shared URL.

### 3.3 Steps

```text
1. Customer opens website.
2. Customer scans hero/category/search.
3. Customer searches or selects category.
4. System displays product listing.
5. Customer applies filter/sort if needed.
6. Customer opens product detail.
```

### 3.4 UI states

- Homepage loading.
- Category loading.
- Product grid skeleton.
- Empty category.
- No search result.
- Filter applied state.
- Product unavailable fallback.

### 3.5 Exit

Customer reaches PDP or contact channel.

### 3.6 Edge cases

- Search typo.
- No product result.
- Category hidden.
- Product image missing.
- Network failure.

---

## 4. Customer PDP Purchase Workflow

### 4.1 Actor

Customer.

### 4.2 Entry

Customer opens product detail page.

### 4.3 Steps

```text
1. Customer reviews product image, name, price, stock.
2. Customer selects variant if required.
3. Customer selects quantity.
4. Customer reviews warranty/shipping/return snippets.
5. Customer clicks Add to cart or Buy now.
6. System validates selected variant/quantity.
7. System adds item to cart or routes to checkout.
```

### 4.4 UI states

- PDP loading.
- Gallery loading.
- Variant unselected.
- Variant disabled.
- Quantity invalid.
- Add-to-cart loading.
- Add-to-cart success.
- Add-to-cart error.
- Out-of-stock/preorder/contact state.

### 4.5 Exit

- Item added to cart.
- Customer proceeds to checkout.
- Customer contacts shop.

### 4.6 Edge cases

- Product unpublished.
- Price changed.
- Stock changed.
- Variant no longer available.
- Cart API fail.
- Customer clicks CTA repeatedly.

---

## 5. Customer Cart Workflow

### 5.1 Actor

Customer.

### 5.2 Entry

Customer opens cart.

### 5.3 Steps

```text
1. System loads cart.
2. Customer reviews items.
3. Customer changes quantity or removes item if needed.
4. System updates cart and recalculates subtotal.
5. Customer clicks checkout.
```

### 5.4 UI states

- Cart loading.
- Empty cart.
- Item updating.
- Item remove loading.
- Cart recalculating.
- Price/stock changed notice.
- Cart error.
- Checkout disabled if cart invalid.

### 5.5 Exit

Customer enters checkout.

### 5.6 Edge cases

- Item unavailable.
- Quantity exceeds stock.
- Cart item deleted.
- Network failure.
- Duplicate cart update.

---

## 6. Customer Checkout Workflow

### 6.1 Actor

Customer.

### 6.2 Entry

Customer opens checkout from cart/buy-now.

### 6.3 Steps

```text
1. System loads checkout summary.
2. Customer enters contact information.
3. Customer enters delivery/address information if required.
4. Customer selects payment/shipping method if available.
5. Customer reviews order summary.
6. Customer submits order.
7. Frontend disables submit button.
8. Backend validates cart/customer/price/stock.
9. Backend creates order.
10. Customer sees order success page.
```

### 6.4 UI states

- Checkout loading.
- Field validation errors.
- Order summary loading.
- Submit loading.
- Submit success.
- Submit error.
- Network retry.
- Price/stock changed.
- Duplicate-submit prevention.

### 6.5 Exit

Order created or checkout remains with recoverable error.

### 6.6 Edge cases

- Required field missing.
- Invalid phone/email.
- Product out of stock.
- Payment method unavailable.
- Backend rejects price/total.
- Network timeout after submit.
- Customer refreshes page.

---

## 7. Customer Order Success Workflow

### 7.1 Actor

Customer.

### 7.2 Entry

Order created successfully.

### 7.3 Steps

```text
1. System shows success confirmation.
2. System shows order code if available.
3. System explains next step.
4. Customer can continue shopping or contact shop.
```

### 7.4 UI states

- Success.
- Missing order detail fallback.
- Contact support CTA.

### 7.5 Exit

Customer leaves, continues shopping, or contacts shop.

---

## 8. Manual Contact Order Workflow

### 8.1 Actors

- Customer.
- Sales/support/admin.

### 8.2 Entry

Customer contacts via hotline/Zalo/Messenger/contact form/comment.

### 8.3 Steps

```text
1. Customer provides product interest.
2. Staff asks for missing product/contact/shipping info.
3. Staff checks product availability/price.
4. Staff confirms customer intent.
5. Staff creates order in admin if system supports manual order.
6. Backend validates product/price/quantity.
7. Staff confirms next step with customer.
```

### 8.4 States

- Lead/contact received.
- Waiting customer info.
- Ready to create order.
- Order created.
- Cannot fulfill.
- Duplicate contact/order.

### 8.5 Edge cases

- Customer gives incomplete info.
- Product out of stock.
- Price changed.
- Customer changes item.
- Duplicate request from multiple channels.

---

## 9. Admin Login Workflow

### 9.1 Actor

Admin/operator.

### 9.2 Entry

Admin opens `bigbike-admin`.

### 9.3 Steps

```text
1. Admin enters credentials.
2. System validates credentials.
3. System loads permissions/profile.
4. Admin enters dashboard.
```

### 9.4 States

- Initial.
- Submitting.
- Invalid credentials.
- Permission denied.
- Session expired.
- Network error.
- Logged in.

### 9.5 Edge cases

- Expired session.
- User disabled.
- Missing role.
- Backend unavailable.

---

## 10. Admin Dashboard Workflow

### 10.1 Actor

Admin/operator.

### 10.2 Entry

Admin logs in or navigates to dashboard.

### 10.3 Steps

```text
1. System loads dashboard metrics.
2. System loads priority lists.
3. Admin scans pending actions.
4. Admin clicks target module/detail.
```

### 10.4 States

- Loading metrics.
- Partial data.
- Empty metrics.
- Error retry.
- Permission-limited dashboard.

### 10.5 Exit

Admin goes to order/product/content/support module.

---

## 11. Admin Product List Workflow

### 11.1 Actor

Admin/operator.

### 11.2 Entry

Admin opens product list.

### 11.3 Steps

```text
1. System loads product table.
2. Admin searches/filters/sorts.
3. Admin reviews product rows.
4. Admin opens detail/edit or creates new product.
5. Admin performs row/bulk action if allowed.
```

### 11.4 States

- Table loading.
- Empty list.
- No filter result.
- Error loading.
- Row action loading.
- Bulk selection.
- Permission denied.

### 11.5 Edge cases

- Product image missing.
- Product has invalid data.
- Bulk action partially fails.
- Search query no result.
- Product deleted by another admin.

---

## 12. Admin Product Create Workflow

### 12.1 Actor

Admin/editor.

### 12.2 Entry

Admin clicks `Create product`.

### 12.3 Steps

```text
1. Admin fills basic product information.
2. Admin uploads/selects product media.
3. Admin sets category/brand.
4. Admin sets price.
5. Admin sets stock/visibility/publish state.
6. Admin adds description/specs/SEO fields if available.
7. Admin saves draft or publishes.
8. Backend validates.
9. System shows success or validation errors.
```

### 12.4 States

- Initial empty form.
- Uploading media.
- Dirty form.
- Saving.
- Save success.
- Validation error.
- Upload error.
- Permission denied.

### 12.5 Edge cases

- Missing required field.
- Invalid price.
- Duplicate SKU/slug if applicable.
- Media upload fail.
- Publish blocked due to incomplete data.

---

## 13. Admin Product Edit Workflow

### 13.1 Actor

Admin/editor.

### 13.2 Entry

Admin opens edit product.

### 13.3 Steps

```text
1. System loads existing product.
2. Admin changes fields.
3. Admin saves.
4. Backend validates.
5. System updates product.
6. Public website reflects changes if product is published.
```

### 13.4 States

- Loading product.
- Product not found.
- Dirty changes.
- Saving.
- Save success.
- Validation error.
- Conflict/stale data if supported.
- Permission denied.

### 13.5 Edge cases

- Product archived/deleted.
- Another admin changed product.
- Slug change impacts SEO.
- Price change affects active cart/order if business handles it.

---

## 14. Admin Product Publish / Unpublish Workflow

### 14.1 Actor

Admin/editor with permission.

### 14.2 Entry

Admin changes publish state.

### 14.3 Steps

```text
1. Admin selects publish/unpublish.
2. System checks required fields.
3. If risky, system asks confirmation.
4. Backend validates permission/state.
5. Product visibility updates.
6. System shows success/error.
```

### 14.4 States

- Publish ready.
- Publish blocked.
- Publishing.
- Published.
- Unpublished.
- Error.

### 14.5 Edge cases

- Missing image/price/category.
- Product URL indexed and unpublish affects SEO.
- Product in active campaign.
- Permission denied.

---

## 15. Admin Order List Workflow

### 15.1 Actor

Admin/operator.

### 15.2 Entry

Admin opens order list.

### 15.3 Steps

```text
1. System loads order table.
2. Admin searches by order/customer/contact if supported.
3. Admin filters by status/date/payment if supported.
4. Admin opens order detail.
5. Admin performs row/bulk action if allowed.
```

### 15.4 States

- Table loading.
- Empty order list.
- No filter result.
- Error retry.
- Row action loading.
- Permission denied.

### 15.5 Edge cases

- Unknown status.
- Partial data.
- Order updated by another admin.
- Filter returns large dataset.

---

## 16. Admin Order Detail Workflow

### 16.1 Actor

Admin/operator.

### 16.2 Entry

Admin opens order detail.

### 16.3 Steps

```text
1. System loads order detail.
2. Admin reviews customer/items/payment/shipping/status.
3. Admin contacts customer if needed.
4. Admin updates status or note if allowed.
5. Backend validates transition.
6. System records update/history if supported.
```

### 16.4 States

- Loading.
- Order not found.
- Partial data.
- Updating status.
- Update success.
- Transition rejected.
- Permission denied.

### 16.5 Edge cases

- Invalid transition.
- Missing customer info.
- Product item unavailable.
- Payment mismatch.
- Order cancelled while viewing.
- Backend conflict.

---

## 17. Admin Cancel Order Workflow

### 17.1 Actor

Admin/operator with permission.

### 17.2 Entry

Admin clicks cancel action.

### 17.3 Steps

```text
1. Admin clicks Cancel order.
2. System opens confirmation dialog.
3. Admin enters/selects reason if required.
4. Admin confirms.
5. Backend validates permission and current order state.
6. Backend cancels order if valid.
7. System shows success or rejection.
```

### 17.4 States

- Confirmation open.
- Cancelling.
- Cancelled.
- Cancel rejected.
- Permission denied.

### 17.5 Edge cases

- Order already completed.
- Order already cancelled.
- Payment/refund rule not handled.
- Inventory reversal needed but backend fails.
- Missing reason if required.

---

## 18. Admin Content Create/Edit Workflow

### 18.1 Actor

Admin/editor/content manager.

### 18.2 Entry

Admin opens content module.

### 18.3 Steps

```text
1. Admin creates or opens content.
2. Admin writes title/body/slug/meta.
3. Admin adds cover/media if needed.
4. Admin saves draft.
5. Admin previews.
6. Admin publishes.
7. Public website shows content.
```

### 18.4 States

- Draft.
- Saving.
- Saved.
- Preview loading.
- Publishing.
- Published.
- Validation error.
- Permission denied.

### 18.5 Edge cases

- Duplicate slug.
- Missing title.
- Broken image.
- Policy content outdated.
- Published content has wrong link.

---

## 19. Admin Promotion Workflow

### 19.1 Actor

Admin/marketing/editor.

### 19.2 Entry

Admin opens promotion/campaign module if available.

### 19.3 Steps

```text
1. Admin creates campaign.
2. Admin defines copy/time/scope if supported.
3. Admin selects products/categories if supported.
4. Admin previews campaign.
5. Admin activates/publishes.
6. Public website displays campaign.
7. Campaign expires or admin disables it.
```

### 19.4 States

- Draft.
- Scheduled.
- Active.
- Expired.
- Disabled.
- Error.

### 19.5 Edge cases

- Campaign active but product unavailable.
- Conflicting discount copy.
- Empty target product list.
- Expired campaign still visible.

---

## 20. Admin Support Workflow

### 20.1 Actor

Admin/support/sales.

### 20.2 Entry

Admin opens support/contact module.

### 20.3 Steps

```text
1. System loads support/contact list.
2. Admin opens request.
3. Admin reviews customer message.
4. Admin replies or adds internal note if supported.
5. Admin updates status.
6. Request is resolved/closed.
```

### 20.4 States

- New.
- In progress.
- Waiting customer.
- Resolved/closed.
- Error.
- Permission denied.

### 20.5 Edge cases

- Spam.
- Missing contact info.
- Duplicate request.
- Attachment unavailable.
- Internal note vs public reply confusion.

---

## 21. Warranty / Return Workflow

### 21.1 Actor

Customer, support/admin.

### 21.2 Entry

Customer contacts shop with warranty/return request.

### 21.3 Steps

```text
1. Customer provides order/product/problem info.
2. Staff verifies policy eligibility.
3. Admin records request if system supports it.
4. Staff requests more information if needed.
5. Staff approves/rejects/processes request.
6. Resolution is communicated.
```

### 21.4 States

- New request.
- Needs information.
- Under review.
- Approved.
- Rejected.
- Completed.
- Cancelled.

Exact status must come from data/business contract.

### 21.5 Edge cases

- No order reference.
- Product not eligible.
- Outside policy period.
- Missing evidence.
- Conflicting policy copy.

---

## 22. Account / Session Workflow

### 22.1 Customer auth if available

```text
Customer opens login/register
-> submits credentials/info
-> backend validates
-> customer accesses account/order history if supported
```

States:

- Initial.
- Submitting.
- Invalid credentials.
- Account created.
- Password recovery sent.
- Session expired.

### 22.2 Admin session

```text
Admin session expires
-> system blocks protected actions
-> user sees session expired message
-> user logs in again
-> system resumes or redirects safely
```

Rule:

- Do not silently fail protected actions.
- Do not expose protected data after session expires.

---

## 23. SEO URL Change Workflow

### 23.1 Actor

Admin/content/product owner/developer.

### 23.2 Entry

Slug/URL change needed for product/category/article.

### 23.3 Steps

```text
1. Identify old URL.
2. Define new URL.
3. Check SEO impact.
4. Create redirect if required.
5. Update internal links.
6. Verify page/canonical/metadata.
7. Monitor broken links if tooling exists.
```

### 23.4 Edge cases

- Old URL indexed.
- Duplicate slug.
- Redirect loop.
- Broken internal link.
- Product unpublished instead of redirected.

---

## 24. Release / Change Workflow

### 24.1 Actor

Developer/AI agent/reviewer.

### 24.2 Entry

A code/docs/design change is planned.

### 24.3 Steps

```text
1. Identify impacted app/doc.
2. Read relevant docs.
3. Make focused change.
4. Run lint/test/build if available.
5. Smoke test main route/workflow.
6. Review business/design/API consistency.
7. Commit/PR.
```

### 24.4 Required doc reading

For web UI changes:

```text
BRAND_GUIDELINES.md
DESIGN_SYSTEM.md
WEB_DESIGN.md
WEB_DESIGN_TOKENS.md
BUSINESS_RULES.md if behavior changes
```

For admin UI changes:

```text
BRAND_GUIDELINES.md
DESIGN_SYSTEM.md
ADMIN_DESIGN.md
ADMIN_DESIGN_TOKENS.md
BUSINESS_RULES.md if behavior changes
```

For backend/business changes:

```text
BUSINESS_RULES.md
BUSINESS_PROCESS.md
WORKFLOW.md
API_CONTRACT.md
DATA_CONTRACT.md
```

### 24.5 Edge cases

- UI change contradicts business rule.
- API change not reflected in contract.
- Status enum changed but UI mapping not updated.
- SEO URL changed without redirect.
- Token hardcoded instead of using docs.

---

## 25. Workflow State Requirements

Every workflow screen/component should handle:

- Loading.
- Empty.
- Error.
- Success.
- Disabled.
- Permission denied.
- Submitting/updating.
- Partial data.
- Unknown state.
- Network failure if relevant.

Không render raw `null`, `undefined`, empty array hoặc crash.

---

## 26. Workflow Testing Checklist

For each workflow:

- [ ] Happy path works.
- [ ] Loading state exists.
- [ ] Empty state exists where relevant.
- [ ] Error state exists.
- [ ] Retry path exists if possible.
- [ ] Permission denied handled.
- [ ] Double-submit guarded.
- [ ] Dangerous action has confirmation.
- [ ] Backend validation failure handled.
- [ ] Unknown status handled safely.
- [ ] Mobile flow works if public/customer-facing.
- [ ] SEO semantics not broken for public pages.

---

## 27. AI Agent Rules

When modifying workflows:

1. Do not invent new states.
2. Do not skip error/empty/loading states.
3. Do not rely only on frontend validation.
4. Do not create destructive action without confirmation.
5. Do not change URL/slug flow without SEO consideration.
6. Do not mix admin workflow into public customer UX.
7. Do not mix public marketing UX into admin workflow.
8. Do not update workflow without checking business rules.
9. Do not expose raw backend errors to users.
10. Do not silently swallow backend failures.

---

## 28. Relationship With Other Docs

- `BUSINESS_RULES.md`: defines what is allowed.
- `BUSINESS_PROCESS.md`: defines end-to-end processes.
- `WORKFLOW.md`: defines operational/user workflows.
- `DATA_CONTRACT.md`: defines official data/status contract.
- `API_CONTRACT.md`: defines backend/API behavior.
- `WEB_DESIGN.md`: defines public website UX.
- `ADMIN_DESIGN.md`: defines admin UX.
- `DESIGN_SYSTEM.md`: defines shared UI rules.

---

## Final Rule

A BigBike workflow is only complete when the user knows:

1. What state they are in.
2. What action is available.
3. What happens after the action.
4. What went wrong if it fails.
5. What to do next.

Nếu một flow chỉ chạy được khi mọi thứ hoàn hảo, đó không phải workflow. Đó là demo trong ngày trời đẹp.
