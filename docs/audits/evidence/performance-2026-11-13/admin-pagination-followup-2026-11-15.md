# Admin pagination — independent source follow-up, 15/11/2026

Status: source review only; no implementation or new API timing in this assessment.
Canonical basis: `docs/engineering/API_CONTRACT.md` Admin Products / list filter-sort;
`docs/business/BUSINESS_RULES.md` PRODUCT_RULE_002. No SQL collation or isolation change.

Current path: `AdminCatalogReadService.java:57` calls
`JpaCatalogReadRepository.java:286`, resolves category descendants using actual
categories, applies `ProductFilterSpecifications.forAdminList`, hydrates all matching
root entities, and maps every entity through `toDomainListItem` before the service
applies homepageBlock, Java sort, total and pagination. List mapper omits long content
and variants from output, but root hydration still reads their scalar/JSON columns.

Equivalence constraints:

- Preserve all status/default/trash, stock, brand, category-tree, gender and multiword
  search predicates, including variant SKU. Preserve DISTINCT with category joins.
- EN fallback uses Java `!nameEn.isBlank()`, not SQL trim; Vietnamese Collator SECONDARY
  orders names in both locales. DESC reverses the primary key only; ID ties remain ASC.
- Price sorting uses parent retailPrice, not sale/variant price. Total is calculated
  after homepageBlock filtering. Permission products.read, page bounds and list
  response mapper remain unchanged.
- homepageOrder has nulls last in both directions and updatedAt DESC next, without
  an ID tie-break. Do not silently invent a stable ID order for that separate path.
- `findByIdsWithVariants` hydrates variants and applies its own name order; it is not
  a suitable direct replacement for ordered page rows.

A thin tuple SELECT followed by rereading root entities adds a concurrency gap.
A rename, status/category change or deletion can leave totals/order from the first
read with row contents from the second. Existing root fields remain in the JPA
persistence context from the initial read (lazy relations already have weaker
consistency). Therefore immutable-data equality alone does not prove equivalence;
no isolation/locking change is authorized merely to make this approach convenient.

Narrower candidate after real API profile: keep the single root entity read, sort
and select the page before mapping list output/relations. This can reduce mapping
and relation work outside the page, while retaining root hydration cost. Stronger
candidate: project all root fields required by list output in one SELECT, retain
those values, sort in Java and enrich only page brand/categories; do not reread root.
Both require exact filter/total/order/output and concurrent-update checks before
acceptance. Do not claim either implemented or faster based on this source review.
