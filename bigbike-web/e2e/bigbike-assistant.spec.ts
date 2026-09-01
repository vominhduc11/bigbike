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
const LOCALES = [
  { name: "Vietnamese", code: "vi", path: "/" },
  { name: "English", code: "en", path: "/en" },
] as const;
const CHAT_VIEWPORTS = [
  { name: "phone portrait", width: 390, height: 844 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tall desktop", width: 1440, height: 1300 },
  { name: "short desktop", width: 1440, height: 700 },
] as const;

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

async function stubAvailability(page: Page, locale = "vi") {
  await page.route(`**/api/v1/chat/availability?lang=${locale}`, (route) =>
    fulfillJson(route, {
      mode: "AI",
      maxTurns: 40,
      contacts: CONTACTS,
      images: {
        enabled: true,
        maxBytes: 8 * 1024 * 1024,
        maxPerTurn: 1,
        maxPerConversation: 3,
        dailyLimit: 20,
      },
    }),
  );
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

function panel(page: Page) {
  return page.locator("[data-bigbike-assistant]");
}

function header(page: Page) {
  return page.locator("[data-bigbike-chat-header]");
}

function memoryBar(page: Page) {
  return page.locator("[data-bigbike-memory-bar]");
}

async function openBigBike(page: Page) {
  await expect(launcher(page)).toBeVisible();
  await launcher(page).click();
  await expect(page.locator("[data-bigbike-assistant]")).toBeVisible();
}

async function sendMessage(page: Page, message: string) {
  await page
    .getByLabel(/Câu hỏi dành cho Trợ lý BigBike|Question for BigBike Assistant/i)
    .fill(message);
  await composer(page)
    .getByRole("button", { name: /Gửi tin nhắn|Send message/i })
    .click();
}

async function expectChatFitsViewport(page: Page, isDesktop: boolean) {
  const geometry = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-bigbike-assistant]");
    const composer = document.querySelector<HTMLElement>("[data-bigbike-composer]");
    const conversation = document.querySelector<HTMLElement>("[data-bigbike-conversation]");
    const header = document.querySelector<HTMLElement>("[data-bigbike-chat-header]");
    if (!root || !composer || !conversation || !header)
      throw new Error("BigBike chat structure is missing");
    const panelRect = root.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    return {
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      composerTop: composerRect.top,
      composerBottom: composerRect.bottom,
      headerHeight: headerRect.height,
      composerIsDirectPanelChild: composer.parentElement === root,
      conversationOverflowY: window.getComputedStyle(conversation).overflowY,
    };
  });

  expect(geometry.panelTop).toBeGreaterThanOrEqual(-1);
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.composerTop).toBeGreaterThanOrEqual(geometry.panelTop - 1);
  expect(geometry.composerBottom).toBeLessThanOrEqual(geometry.panelBottom + 1);
  expect(geometry.composerIsDirectPanelChild).toBeTruthy();
  expect(["auto", "scroll"]).toContain(geometry.conversationOverflowY);
  if (isDesktop) expect(geometry.headerHeight).toBeLessThanOrEqual(128);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/chat/sessions", (route) =>
    fulfillJson(route, {
      visitorToken: "visitor-token-e2e",
      rememberedThrough: "2026-09-28T00:00:00Z",
      memoryEnabled: true,
      activeConversationId: null,
      rememberedContextSummary: null,
    }),
  );
});

test("consults products through the assistant", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ message: "Tìm theo nhu cầu", lang: "vi", pageContext: null });
    await fulfillChatStream(
      route,
      messageResponse({
        answer: "Em có một mẫu phù hợp.",
        products: [
          {
            slug: "mu-e2e",
            name: "Mũ E2E",
            retailPrice: 1_590_000,
            currency: "VND",
            stockState: "IN_STOCK",
          },
        ],
      }),
    );
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm theo nhu cầu");
  await expect(conversation(page).getByText("Em có một mẫu phù hợp.").first()).toBeVisible();
  await expect(conversation(page).getByText("Mũ E2E")).toBeVisible();

  await header(page)
    .getByRole("button", { name: /Đóng trợ lý BigBike|Close BigBike Assistant/i })
    .click();
  await expect(panel(page)).toBeHidden();
  await openBigBike(page);
  await expect(conversation(page).getByText("Em có một mẫu phù hợp.").first()).toBeVisible();
});

test("offers direct shop contacts when the assistant cannot answer", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", (route) =>
    fulfillChatStream(
      route,
      messageResponse({
        mode: "CONTACT",
        answer: "Anh/chị vui lòng liên hệ shop qua các kênh bên dưới.",
        resultKind: "CONTACT",
        actions: [],
      }),
    ),
  );

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
  await expect(conversation(page).getByText("Em đã kiểm tra mẫu này.").first()).toBeVisible();
  expect(requestBody).toMatchObject({
    pageContext: { type: "PRODUCT", productSlug: PRODUCT_CONTEXT_SLUG },
  });
});

test("keeps deletion inside the memory bar with the existing confirmation", async ({ page }) => {
  await stubAvailability(page);
  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);

  await expect(header(page).getByRole("button")).toHaveCount(1);
  await expect(header(page).getByRole("button", { name: /Thu nhỏ|Minimize/i })).toHaveCount(0);
  await expect(
    header(page).getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i }),
  ).toHaveCount(0);

  await memoryBar(page)
    .getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i })
    .click();
  await expect(
    page.getByText(/Xoá toàn bộ lịch sử|Delete all of your conversation history/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Giữ lại lịch sử|Keep history/i })).toBeVisible();
});

test("uploads a safe PNG fixture and sends the image consultation", async ({ page }) => {
  await stubAvailability(page);
  let uploaded = false;
  await page.route("**/api/v1/chat/images**", async (route) => {
    uploaded = route.request().method() === "POST";
    await fulfillJson(route, {
      conversationId: CONVERSATION_ID,
      image: {
        id: "image-e2e",
        contentPath: "/api/v1/chat/images/image-e2e/content",
        mimeType: "image/png",
        width: 1,
        height: 1,
        sizeBytes: 68,
        status: "STORED",
      },
    });
  });
  await page.route("**/api/v1/chat/messages/stream", (route) =>
    fulfillChatStream(
      route,
      messageResponse({
        answer: "Em đã nhận ảnh thử.",
      }),
    ),
  );

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await page.getByLabel(/Gửi ảnh cho trợ lý|Send an image to the assistant/i).setInputFiles({
    name: "E2E_assistant.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL7WQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.locator("[data-chat-pending-image]")).toBeVisible();
  await composer(page)
    .getByRole("button", { name: /Gửi tin nhắn|Send message/i })
    .click();

  await expect(conversation(page).getByText("Em đã nhận ảnh thử.").first()).toBeVisible();
  expect(uploaded).toBeTruthy();
});

test.describe("keeps the assistant composer visible across required viewport sizes", () => {
  for (const locale of LOCALES) {
    for (const viewport of CHAT_VIEWPORTS) {
      test(`${locale.name} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await stubAvailability(page, locale.code);
        await page.goto(locale.path, { waitUntil: "load" });
        await openBigBike(page);

        await expect(
          page.getByLabel(/Câu hỏi dành cho Trợ lý BigBike|Question for BigBike Assistant/i),
        ).toBeVisible();
        await expect(
          composer(page).getByRole("button", { name: /Gửi tin nhắn|Send message/i }),
        ).toBeVisible();
        await expect(
          composer(page).getByRole("button", {
            name: /Gửi ảnh cho trợ lý|Send an image to the assistant/i,
          }),
        ).toBeVisible();
        await expect(
          composer(page).getByRole("button", { name: /Mở thẻ liên hệ|Open contact panel/i }),
        ).toBeVisible();
        await expect(header(page).getByRole("button")).toHaveCount(1);
        await expect(header(page).getByRole("button", { name: /Thu nhỏ|Minimize/i })).toHaveCount(
          0,
        );
        await expect(
          memoryBar(page).getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i }),
        ).toBeVisible();
        await expectChatFitsViewport(page, viewport.width >= 768);
      });
    }
  }
});
