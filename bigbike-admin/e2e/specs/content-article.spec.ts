import type { Locator } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { navigateSpa, gotoAdmin } from '../utils/quality'

/**
 * Real create/edit "Tin tức" (article) flow against the live backend (no mocking) —
 * verifies the mutation actually succeeds (2xx + toast + data persisted after a full
 * reload, not just optimistic UI), that the hidden required-EN-title rule
 * (TRANSLATION_RULE_002, createContentSchema in src/lib/schemas.js) is satisfied the
 * same way a real admin would have to, and that Vietnamese diacritics round-trip
 * correctly through the Notion-style BlockEditor.
 *
 * The article body ("Nội dung chính") uses BlockEditor in non-productMode, whose
 * paragraph block is a plain RichTextEditor (TipTap contenteditable, class
 * "ProseMirror") — unlike product-crud.spec.ts there is no "Mã HTML" source tab here,
 * so text is typed via real keystrokes (pressSequentially) instead of filling a
 * textarea.
 *
 * Test data is prefixed [E2E] + RUN_ID and archived (moved to Thùng rác) in the last
 * test so nothing lingers as real content. The optional publish test always reverts
 * to Thùng rác in a try/finally so nothing stays publicly live even if the
 * verification step itself fails.
 */

const RUN_ID = Date.now()

function articleTitle(retry: number) {
  return `[E2E] Kiểm thử tự động tạo tin tức ${RUN_ID}${retry ? ` r${retry}` : ''}`
}
function articleTitleEn(retry: number) {
  return `[E2E] Automated Test Article ${RUN_ID}${retry ? ` r${retry}` : ''}`
}
const BODY_TEXT =
  'Đây là đoạn nội dung kiểm thử tự động (E2E) cho bigbike-admin, dùng để kiểm tra luồng tạo bài viết. Đây không phải nội dung thật và sẽ được dọn dẹp sau khi test chạy xong.'
const BODY_TEXT_EDITED =
  'Nội dung này đã được SỬA trong bước kiểm thử tự động (E2E) để xác nhận thao tác chỉnh sửa bài viết lưu đúng dữ liệu, không bị mất hay ghi đè sai.'

// Shared across tests in this file — plain test(), not .serial() (mirrors
// product-crud.spec.ts) — so an earlier failure never skips the cleanup test at the end.
let createdArticleId: string | null = null
let createdArticleTitle: string | null = null
let createdArticleSlug: string | null = null

// content-detail/SectionCard.jsx renders `<h2>`, NOT the `<h3>` that
// ProductDetailScreen's SectionCard uses — a different helper from product-crud's is
// required or every sectionCard() lookup here would silently match zero cards.
function sectionCard(page: Page, title: string): Locator {
  return page.locator('.bb-card').filter({ has: page.locator('.bb-card-header h2', { hasText: title }) })
}

// CONTENT_MENU (components/block-editor/constants.js) only offers heading/paragraph/
// list/image for articles. Paragraph uses plain RichTextEditor here (productMode is
// false), so there is no HTML-source tab — type real keystrokes into the ProseMirror
// node instead of filling a textarea.
async function addParagraphBlock(page: Page, bodyCard: Locator, text: string) {
  await bodyCard.getByRole('button', { name: 'Thêm khối' }).click()
  await page.getByRole('menuitem', { name: 'Đoạn văn', exact: true }).click()
  const editable = bodyCard.locator('.ProseMirror')
  await editable.click()
  await editable.pressSequentially(text)
}

async function replaceParagraphBlockText(bodyCard: Locator, text: string) {
  const editable = bodyCard.locator('.ProseMirror')
  await editable.click()
  await editable.press('Control+A')
  await editable.press('Backspace')
  await editable.pressSequentially(text)
}

// English title is required on EVERY article save regardless of which content
// language is active in the admin UI (TRANSLATION_RULE_002) — without this step the
// "Tạo bài viết"/"Lưu thay đổi" click silently no-ops (client validation blocks the
// API call). Mirrors fillEnglishName in product-crud.spec.ts. Add the block BEFORE
// calling this: switching to EN swaps "Nội dung chính" to a different (EN body)
// editor entirely, but form.bodyBlocks itself lives in parent state and survives the
// round-trip untouched.
async function fillEnglishTitle(page: Page, basicCard: Locator, titleEn: string) {
  const langSwitcher = page.locator('.lang-switcher')
  await langSwitcher.getByRole('button', { name: 'EN', exact: true }).click()
  await basicCard.getByLabel('Tiêu đề', { exact: false }).fill(titleEn)
  await langSwitcher.getByRole('button', { name: 'VI', exact: true }).click()
}

// Local autosave draft (F-autosave) can surface a "Có bản nháp tạm" recovery banner on
// the create/edit screen — dismiss it so leftover state never contaminates this run.
async function dismissDraftBannerIfAny(page: Page) {
  const discard = page.getByRole('button', { name: 'Bỏ qua', exact: true })
  if ((await discard.count()) > 0 && (await discard.isVisible())) await discard.click()
}

interface FillOptions {
  title: string
  titleEn: string
  bodyText: string
}

async function fillRequiredArticleFields(page: Page, opts: FillOptions) {
  const basicCard = sectionCard(page, 'Thông tin chính')
  await basicCard.getByLabel('Tiêu đề', { exact: false }).fill(opts.title) // also auto-derives slug

  const bodyCard = sectionCard(page, 'Nội dung chính')
  await addParagraphBlock(page, bodyCard, opts.bodyText)

  await fillEnglishTitle(page, basicCard, opts.titleEn)
}

// showConfirm() with no options (ContentDetailScreen.handleArchive) falls back to the
// dialog's DEFAULT confirm label t('common.confirm') = "Xác nhận" — NOT the
// "Đưa vào thùng rác" trigger-button text (that only happens to be the dialog TITLE).
// Idempotent: if the article is already in Thùng rác (e.g. the publish test already
// archived it), skip re-archiving instead of risking an unknown backend response for
// re-deleting an already-trashed item.
async function ensureArchived(page: Page, id: string) {
  await navigateSpa(page, `/admin/content/article/${id}`)
  const alreadyTrashed = (await page.locator('.bb-badge', { hasText: 'Thùng rác' }).count()) > 0
  if (alreadyTrashed) return
  await page.getByRole('button', { name: 'Đưa vào thùng rác' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByText('Đã đưa nội dung vào thùng rác.')).toBeVisible()
}

test.describe('content-article', () => {
  test('content-article · create new article (DRAFT) succeeds', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(90_000)

    createdArticleTitle = articleTitle(testInfo.retry)
    const titleEn = articleTitleEn(testInfo.retry)

    await navigateSpa(adminPage, '/admin/content/article/new')
    await dismissDraftBannerIfAny(adminPage)

    await test.step('điền tiêu đề (VI có dấu + EN bắt buộc) và 1 khối nội dung, giữ trạng thái Nháp', async () => {
      await fillRequiredArticleFields(adminPage, { title: createdArticleTitle!, titleEn, bodyText: BODY_TEXT })
    })

    await test.step('bấm Tạo bài viết, kỳ vọng API 2xx + toast thành công', async () => {
      const [response] = await Promise.all([
        adminPage.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/admin/content/articles'),
        ),
        adminPage.getByRole('button', { name: 'Tạo bài viết' }).click(),
      ])
      expect(response.status(), 'API tạo bài viết phải trả 2xx').toBeLessThan(300)

      await expect(adminPage).toHaveURL(/\/admin\/content\/articles\/[^/]+$/, { timeout: 15_000 })
      createdArticleId = adminPage.url().match(/\/admin\/content\/articles\/([^/?#]+)/)?.[1] ?? null
      expect(createdArticleId, 'Không lấy được id bài viết vừa tạo từ URL').toBeTruthy()

      await expect(adminPage.getByText('Tạo bài viết thành công.')).toBeVisible()
    })

    await test.step('reload trang, xác nhận tiêu đề + nội dung đã lưu thật (không phải optimistic UI)', async () => {
      await gotoAdmin(adminPage, `/admin/content/article/${createdArticleId}`)
      const basicCard = sectionCard(adminPage, 'Thông tin chính')
      const bodyCard = sectionCard(adminPage, 'Nội dung chính')

      await expect(basicCard.getByLabel('Tiêu đề', { exact: false })).toHaveValue(createdArticleTitle!)
      await expect(bodyCard.locator('.ProseMirror')).toContainText(BODY_TEXT)

      createdArticleSlug = await basicCard.getByLabel('Slug', { exact: false }).inputValue()
      expect(createdArticleSlug, 'Không đọc được slug đã sinh').toBeTruthy()
    })

    await test.step('bài viết xuất hiện trong danh sách /admin/content', async () => {
      await navigateSpa(adminPage, '/admin/content')
      await adminPage.getByPlaceholder('Tên hoặc slug').fill(createdArticleTitle!)
      await expect(adminPage.getByRole('link', { name: createdArticleTitle!, exact: false })).toBeVisible({ timeout: 10_000 })
    })

    expectRuntimeClean(collect)
  })

  test('content-article · edit existing article persists after reload', async ({ adminPage, collect }) => {
    test.skip(!createdArticleId, 'Bỏ qua: bước tạo bài viết ở test trước chưa thành công nên không có bài để sửa')
    test.setTimeout(90_000)

    const editedTitle = `${createdArticleTitle} (đã sửa)`

    await test.step('mở lại bài viết vừa tạo, đổi tiêu đề + nội dung, lưu', async () => {
      await navigateSpa(adminPage, `/admin/content/article/${createdArticleId}`)
      await dismissDraftBannerIfAny(adminPage)

      const basicCard = sectionCard(adminPage, 'Thông tin chính')
      const bodyCard = sectionCard(adminPage, 'Nội dung chính')

      await basicCard.getByLabel('Tiêu đề', { exact: false }).fill(editedTitle)
      await replaceParagraphBlockText(bodyCard, BODY_TEXT_EDITED)

      const [response] = await Promise.all([
        adminPage.waitForResponse(
          (r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/content/articles/${createdArticleId}`),
        ),
        adminPage.getByRole('button', { name: 'Lưu thay đổi' }).click(),
      ])
      expect(response.status(), 'API cập nhật bài viết phải trả 2xx').toBeLessThan(300)
      await expect(adminPage.getByText('Cập nhật bài viết thành công.')).toBeVisible()
    })

    await test.step('reload trang, xác nhận tiêu đề + nội dung mới đã lưu (không bị revert)', async () => {
      await gotoAdmin(adminPage, `/admin/content/article/${createdArticleId}`)
      const basicCard = sectionCard(adminPage, 'Thông tin chính')
      const bodyCard = sectionCard(adminPage, 'Nội dung chính')

      await expect(basicCard.getByLabel('Tiêu đề', { exact: false })).toHaveValue(editedTitle)
      await expect(bodyCard.locator('.ProseMirror')).toContainText(BODY_TEXT_EDITED)
      await expect(bodyCard.locator('.ProseMirror')).not.toContainText(BODY_TEXT)
    })

    createdArticleTitle = editedTitle
    expectRuntimeClean(collect)
  })

  test('content-article · publish goes live on bigbike-web, then archived back', async ({ adminPage, collect }) => {
    test.skip(!createdArticleId, 'Bỏ qua: không có bài viết test để đăng thử')
    test.setTimeout(90_000)

    let publicCheck: { status: number; hasTitle: boolean } | null = null

    try {
      await test.step('chuyển trạng thái sang "Đã xuất bản", lưu', async () => {
        await navigateSpa(adminPage, `/admin/content/article/${createdArticleId}`)
        await adminPage.getByRole('tab', { name: 'SEO & Hiển thị' }).click()

        // Field↔control htmlFor linkage is a no-op for Radix Select (Select.Root
        // renders no DOM node of its own) — target the combobox positionally within
        // its SectionCard instead (mirrors product-crud.spec.ts's pickFirstOption note).
        const publishCard = sectionCard(adminPage, 'Hiển thị')
        await publishCard.getByRole('combobox').click()
        await adminPage.getByRole('option', { name: 'Đã xuất bản', exact: true }).click()

        const [response] = await Promise.all([
          adminPage.waitForResponse(
            (r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/content/articles/${createdArticleId}`),
          ),
          adminPage.getByRole('button', { name: 'Lưu thay đổi' }).click(),
        ])
        expect(response.status(), 'API đăng bài phải trả 2xx').toBeLessThan(300)
        await expect(adminPage.getByText('Cập nhật bài viết thành công.')).toBeVisible()
      })

      await test.step('kiểm tra bài đã lên công khai tại bigbike-web /tin-tuc/<slug>', async () => {
        const res = await adminPage.request.get(`http://localhost:3000/tin-tuc/${createdArticleSlug}`)
        const body = await res.text().catch(() => '')
        publicCheck = { status: res.status(), hasTitle: body.includes(createdArticleTitle || ' ') }
      })
    } finally {
      // Always runs, even if the steps above throw, so nothing stays publicly live.
      await test.step('luôn đưa bài về Thùng rác (không để rác hiển thị công khai)', async () => {
        await ensureArchived(adminPage, createdArticleId!)
      })
    }

    expect(publicCheck?.status, 'Trang công khai /tin-tuc/<slug> phải trả 200').toBe(200)
    expect(publicCheck?.hasTitle, 'Trang công khai phải hiển thị đúng tiêu đề bài viết').toBe(true)

    expectRuntimeClean(collect, { allowApi: true }) // GET to the bigbike-web origin is outside API_BASE, irrelevant here anyway
  })

  test('content-article · cleanup: đảm bảo bài test không còn công khai', async ({ adminPage }) => {
    test.skip(!createdArticleId, 'Không có bài viết test nào cần dọn dẹp')
    test.setTimeout(60_000)

    await ensureArchived(adminPage, createdArticleId!)

    createdArticleId = null
  })
})
