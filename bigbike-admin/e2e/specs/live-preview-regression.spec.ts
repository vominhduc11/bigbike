import { expect, expectRuntimeClean, test, type Page } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

type PreviewArticle = {
  id: string
  title: string
  body?: string | null
  bodyBlocks?: unknown[] | null
  coverImage?: { url?: string | null } | null
  publishStatus?: string | null
}

type PreviewProduct = {
  id: string
  name: string
  publishStatus?: string | null
}

function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

function textFromHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getPreviewablePublishedArticles(page: Page, accessToken: string) {
  const listResponse = await page.request.get(
    '/api/v1/admin/content?page=1&size=100&publishStatus=PUBLISHED',
    { headers: bearer(accessToken) },
  )
  expect(listResponse.ok(), await listResponse.text()).toBeTruthy()
  const listPayload = await listResponse.json()
  const listed = Array.isArray(listPayload?.data) ? listPayload.data : []
  const articles: PreviewArticle[] = []

  for (const item of listed) {
    if (!item?.id || articles.length === 3) break
    const detailResponse = await page.request.get(`/api/v1/admin/content/article/${item.id}`, {
      headers: bearer(accessToken),
    })
    expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy()
    const article = detailResponse ? ((await detailResponse.json())?.data as PreviewArticle) : null
    if (
      article?.publishStatus === 'PUBLISHED' &&
      article.title &&
      article.coverImage?.url &&
      (textFromHtml(article.body).length > 0 || (article.bodyBlocks?.length ?? 0) > 0)
    ) {
      articles.push(article)
    }
  }

  expect(
    articles,
    'Cần ít nhất ba bài đã xuất bản có ảnh bìa và nội dung để nghiệm thu xem trước.',
  ).toHaveLength(3)
  return articles
}

async function getPublishedProduct(page: Page, accessToken: string) {
  const listResponse = await page.request.get(
    '/api/v1/admin/products?page=1&size=100&publishStatus=PUBLISHED',
    { headers: bearer(accessToken) },
  )
  expect(listResponse.ok(), await listResponse.text()).toBeTruthy()
  const products = (await listResponse.json())?.data as PreviewProduct[]
  const product = products?.find((item) => item?.id && item?.name)
  expect(product, 'Cần một sản phẩm đã xuất bản để xác nhận xem trước sản phẩm.').toBeTruthy()
  return product!
}

async function expectCleanPublishedArticle(page: Page, article: PreviewArticle) {
  await navigateSpa(page, `/admin/content/article/${article.id}`)
  await expect(page.getByRole('combobox')).toHaveText('Đã xuất bản')
  await expect(
    page.getByRole('toolbar', { name: 'Thanh thao tác' }).getByRole('status'),
  ).toHaveText('Đã lưu')
}

async function openArticlePreview(page: Page) {
  const previewResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/api/v1/admin/content/articles/preview'),
  )
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  const response = await previewResponse
  expect(response.ok(), await response.text()).toBeTruthy()
  expect(response.request().postDataJSON().publishStatus).toBe('PUBLISHED')
  const payload = await response.json()
  return payload?.data as PreviewArticle
}

async function expectArticleFrame(page: Page, article: PreviewArticle) {
  const panel = page.getByRole('complementary', { name: 'Xem trước bài viết' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText(/Chưa xem trước được/)).toHaveCount(0)

  const frame = page.frameLocator('aside[aria-label="Xem trước bài viết"] iframe')
  await expect(frame.getByText(article.title, { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(frame.locator('#main-content img').first()).toBeVisible()

  const bodyText = textFromHtml(article.body)
  if (bodyText.length > 12) {
    await expect(frame.locator('#main-content')).toContainText(bodyText.slice(0, 40))
  }
  return panel
}

async function setArticlePreviewLanguage(page: Page, language: 'VI' | 'EN') {
  const previewResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/api/v1/admin/content/articles/preview'),
  )
  await page
    .getByRole('complementary', { name: 'Xem trước bài viết' })
    .getByRole('button', { name: language, exact: true })
    .click()
  const response = await previewResponse
  expect(response.ok(), await response.text()).toBeTruthy()
  expect(response.request().postDataJSON().publishStatus).toBe('PUBLISHED')
  return (await response.json())?.data as PreviewArticle
}

test.describe('live preview regression', () => {
  test('ba bài đã xuất bản giữ nguyên trạng thái khi mở và xem trước ở cả VI/EN, Máy tính/Điện thoại', async ({
    adminPage: page,
    authHolder,
    collect,
  }) => {
    test.setTimeout(240_000)
    const articles = await getPreviewablePublishedArticles(page, authHolder.accessToken)

    for (const [index, article] of articles.entries()) {
      await test.step(`bài đã xuất bản ${index + 1} mở sạch và xem trước`, async () => {
        await expectCleanPublishedArticle(page, article)
        let previewArticle = await openArticlePreview(page)
        let panel = await expectArticleFrame(page, previewArticle)

        if (index === 1) {
          previewArticle = await setArticlePreviewLanguage(page, 'EN')
          panel = await expectArticleFrame(page, previewArticle)
          await panel.getByRole('button', { name: 'Điện thoại' }).click()
          await expectArticleFrame(page, previewArticle)
        }

        if (index === 2) {
          previewArticle = await setArticlePreviewLanguage(page, 'EN')
          panel = await expectArticleFrame(page, previewArticle)
          await panel.getByRole('button', { name: 'Máy tính' }).click()
          await expectArticleFrame(page, previewArticle)
        }

        await panel.getByRole('button', { name: 'Đóng' }).click()
        await page.locator('[data-screen-close="true"]').click()
        await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/)
      })
    }

    expectRuntimeClean(collect)
  })

  test('xem trước sản phẩm đã xuất bản vẫn hoạt động như cũ', async ({
    adminPage: page,
    authHolder,
    collect,
  }) => {
    const product = await getPublishedProduct(page, authHolder.accessToken)
    await navigateSpa(page, `/admin/products/${product.id}`)

    const previewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/v1/admin/products/preview'),
    )
    await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
    const response = await previewResponse
    expect(response.ok(), await response.text()).toBeTruthy()
    const previewProduct = (await response.json())?.data as PreviewProduct

    const panel = page.getByRole('complementary', { name: 'Xem trước trang sản phẩm' })
    await expect(panel).toBeVisible()
    await expect(panel.getByText(/Chưa xem trước được/)).toHaveCount(0)
    const frame = page.frameLocator('aside[aria-label="Xem trước trang sản phẩm"] iframe')
    await expect(frame.getByText(previewProduct.name, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })

    expectRuntimeClean(collect)
  })
})
