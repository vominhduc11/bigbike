import { expect, test, type Page, type Route } from "@playwright/test";

const CONTACTS = {
  hotline: "0900 000 000",
  zaloUrl: "https://zalo.example/bigbike",
  messengerUrl: "https://m.me/bigbike",
  zaloDisplay: "BigBike Zalo",
  messengerDisplay: "BigBike Messenger",
};

const CONVERSATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_CONTEXT_SLUG = process.env.PW_PRODUCT_SLUG || "abasjndkjfasdfs";

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ data }) });
}

async function fulfillChatStream(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    headers: { "Cache-Control": "no-cache", "Content-Type": "text/event-stream; charset=utf-8" },
    body: [
      'event: progress\ndata: {"code":"UNDERSTANDING"}',
      'event: progress\ndata: {"code":"CHECKING_PRODUCTS"}',
      `event: result\ndata: ${JSON.stringify(data)}`,
      "",
    ].join("\n\n"),
  });
}

function messageResponse(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: CONVERSATION_ID,
    assistantMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    mode: "AI",
    answer: "Trợ lý BigBike đã kiểm tra dữ liệu sản phẩm hiện có.",
    answerFormat: "PLAIN_TEXT",
    resultKind: "ANSWER",
    turnCount: 1,
    maxTurns: 40,
    remainingTurns: 39,
    products: [],
    crossSellProducts: [],
    salesStage: "BROWSING",
    actions: [],
    contacts: CONTACTS,
    countedTurns: 1,
    turnLimit: 40,
    turnsRemaining: 39,
    ...overrides,
  };
}

async function stubAvailability(page: Page) {
  await page.route("**/api/v1/chat/availability?lang=vi", (route) => fulfillJson(route, {
    mode: "AI",
    maxTurns: 40,
    contacts: CONTACTS,
    images: { enabled: true, maxBytes: 8 * 1024 * 1024, maxPerTurn: 1, maxPerConversation: 3, dailyLimit: 20 },
  }));
}

function launcher(page: Page) {
  return page.getByRole("button", { name: /Mở Trợ lý BigBike|Open BigBike Assistant/i });
}

function composer(page: Page) {
  return page.locator("[data-bigbike-composer]");
}

function conversation(page: Page) {
  return page.locator("[data-bigbike-conversation]");
}

async function openBigBike(page: Page) {
  await expect(launcher(page)).toBeVisible();
  await launcher(page).click();
  await expect(page.locator("[data-bigbike-assistant]")).toBeVisible();
}

async function sendMessage(page: Page, message: string) {
  await page.getByLabel(/Câu hỏi dành cho Trợ lý BigBike|Question for BigBike Assistant/i).fill(message);
  await composer(page).getByRole("button", { name: /Gửi tin nhắn|Send message/i }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/chat/sessions", (route) => fulfillJson(route, {
    visitorToken: "visitor-token-e2e",
    rememberedThrough: "2026-09-28T00:00:00Z",
    memoryEnabled: true,
    activeConversationId: null,
    rememberedContextSummary: null,
  }));
});

test("consults products through the assistant", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ message: "Tìm theo nhu cầu", lang: "vi", pageContext: null });
    await fulfillChatStream(route, messageResponse({
      answer: "Em có một mẫu phù hợp.",
      products: [{ slug: "mu-e2e", name: "Mũ E2E", retailPrice: 1_590_000, currency: "VND", stockState: "IN_STOCK" }],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm theo nhu cầu");
  await expect(conversation(page).getByText("Em có một mẫu phù hợp.")).toBeVisible();
  await expect(conversation(page).getByText("Mũ E2E")).toBeVisible();
});

test("offers direct shop contacts when the assistant cannot answer", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", (route) => fulfillChatStream(route, messageResponse({
    mode: "CONTACT",
    answer: "Anh/chị vui lòng liên hệ shop qua các kênh bên dưới.",
    resultKind: "CONTACT",
    actions: [],
  })));

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Kiểm tra size M");
  await conversation(page).getByRole("button", { name: "Mở thẻ liên hệ" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toBeVisible();
  await expect(page.getByText(/không phải nhân viên/i)).toBeVisible();
});

test("keeps product-page context for consultation", async ({ page }) => {
  await stubAvailability(page);
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    requestBody = route.request().postDataJSON();
    await fulfillChatStream(route, messageResponse({ answer: "Em đã kiểm tra mẫu này." }));
  });

  await page.goto(`/product/${PRODUCT_CONTEXT_SLUG}`, { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Mẫu này có phù hợp đi phố không?");
  await expect(conversation(page).getByText("Em đã kiểm tra mẫu này.")).toBeVisible();
  expect(requestBody).toMatchObject({ pageContext: { type: "PRODUCT", productSlug: PRODUCT_CONTEXT_SLUG } });
});
