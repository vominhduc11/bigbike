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
  { name: "small android", width: 360, height: 740 },
  { name: "phone landscape", width: 844, height: 390 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "small laptop", width: 1280, height: 800 },
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

function deleteConfirm(page: Page) {
  return page.locator("[data-bigbike-delete-confirm]");
}

async function openBigBike(page: Page) {
  await expect(launcher(page)).toBeVisible();
  // The widget stamps this once it has hydrated; clicking before that swallows the event.
  await expect(page.locator('[data-bigbike-launcher-ready="true"]')).toBeAttached();
  await launcher(page).click();
  await expect(page.locator("[data-bigbike-assistant]")).toBeVisible();
}

async function sendMessage(page: Page, message: string) {
  await page
    .getByLabel(/Câu hỏi dành cho trợ lý BigBike|Question for the BigBike Assistant/i)
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
      composerHeight: composerRect.height,
      panelScrollWidth: root.scrollWidth,
      panelClientWidth: root.clientWidth,
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
  if (isDesktop) expect(geometry.headerHeight).toBeLessThanOrEqual(112);
  // Owner decision 2026-09-06: header + composer must never eat more than 40% of the panel at
  // the five sizes the shop measured. A phone held sideways leaves only ~390px of height, where
  // no usable header plus input row can stay under 40% — that case gets a looser ceiling.
  const panelHeight = geometry.panelBottom - geometry.panelTop;
  const chromeRatio = (geometry.headerHeight + geometry.composerHeight) / panelHeight;
  expect(chromeRatio).toBeLessThanOrEqual(panelHeight >= 520 ? 0.4 : 0.55);
  // Nothing in the chat may force a horizontal scrollbar.
  expect(geometry.panelScrollWidth).toBeLessThanOrEqual(geometry.panelClientWidth + 1);
}

// CHAT_RULE_049 (owner decision 2026-09-05): a session lasts as long as the browser session, so
// there is no remembered-through date and no memory switch in the payload any more.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/chat/sessions", (route) =>
    fulfillJson(route, {
      visitorToken: "visitor-token-e2e",
      activeConversationId: null,
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
  await header(page).getByRole("button", { name: "Mở thẻ liên hệ" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toBeVisible();
  // In CONTACT mode the single sub-line switches to the shop-channels wording, and the long
  // "not a human staff member" sentence is gone for good (owner decision 2026-09-06).
  await expect(header(page).getByText(/Kênh liên hệ shop/i)).toBeVisible();
  await expect(page.getByText(/không phải nhân viên/i)).toHaveCount(0);
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

test("puts contact, delete and close in the header and hides the confirm box until asked", async ({
  page,
}) => {
  // 360px is the narrowest size the shop measured — the confirm buttons must stay on one line there.
  await page.setViewportSize({ width: 360, height: 740 });
  await stubAvailability(page);
  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);

  // Owner decision 2026-09-06: exactly three equal icon buttons, no separate trash strip.
  await expect(header(page).getByRole("button")).toHaveCount(3);
  await expect(header(page).getByRole("button", { name: /Thu nhỏ|Minimize/i })).toHaveCount(0);
  await expect(
    header(page).getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i }),
  ).toBeVisible();
  await expect(
    header(page).getByRole("button", { name: /Mở thẻ liên hệ|Open contact card/i }),
  ).toBeVisible();
  await expect(page.locator("[data-bigbike-memory-bar]")).toHaveCount(0);

  const iconSizes = await header(page)
    .getByRole("button")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }),
    );
  expect(new Set(iconSizes).size).toBe(1);

  // The long AI sentence is gone; one short label carries the AI + availability message.
  await expect(page.getByText(/không phải nhân viên|not a human staff member/i)).toHaveCount(0);
  await expect(page.getByText(/Trợ lý sẵn sàng|Assistant ready/i)).toHaveCount(0);
  // The memory disclosure line and its on/off switch are gone (CHAT_RULE_049).
  await expect(
    page.getByText(/nhớ nhu cầu và sản phẩm đã xem|remembers needs and viewed/i),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tắt ghi nhớ|Turn memory off/i })).toHaveCount(0);
  // The image-privacy line is gone from the chat frame (owner decision 2026-09-06).
  await expect(page.locator("[data-chat-image-disclosure]")).toHaveCount(0);
  await expect(page.getByText(/lưu riêng tối đa 90 ngày|stored privately by BigBike/i)).toHaveCount(
    0,
  );

  await expect(deleteConfirm(page)).toHaveCount(0);
  await header(page)
    .getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i })
    .click();
  await expect(deleteConfirm(page)).toBeVisible();
  await expect(
    page.getByText(/Xoá toàn bộ lịch sử|Delete all of your conversation history/i),
  ).toBeVisible();

  // Both confirm buttons are the same size and each fits on one line.
  const confirmButtons = deleteConfirm(page).getByRole("button");
  await expect(confirmButtons).toHaveCount(2);
  const boxes = await confirmButtons.evaluateAll((nodes) =>
    nodes.map((node) => {
      const el = node as HTMLElement;
      const label = el.lastChild as Text;
      const range = document.createRange();
      range.selectNodeContents(label);
      return {
        width: el.offsetWidth,
        height: el.offsetHeight,
        // One client rect per rendered line of text.
        lines: range.getClientRects().length,
      };
    }),
  );
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThanOrEqual(1);
  for (const box of boxes) expect(box.lines).toBe(1);
});

test("greets the customer with four equal suggestions until the first message", async ({
  page,
}) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", (route) =>
    fulfillChatStream(route, messageResponse({ answer: "Em đã ghi nhận nhu cầu của anh/chị." })),
  );
  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);

  const greeting = page.locator("[data-bigbike-greeting]");
  await expect(greeting).toBeVisible();
  const suggestions = page.locator("[data-bigbike-greeting-suggestions]").getByRole("button");
  await expect(suggestions).toHaveCount(4);

  const sizes = await suggestions.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    }),
  );
  expect(new Set(sizes).size).toBe(1);

  let sentMessage: string | undefined;
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    sentMessage = route.request().postDataJSON()?.message;
    await fulfillChatStream(
      route,
      messageResponse({ answer: "Em đã ghi nhận nhu cầu của anh/chị." }),
    );
  });
  await suggestions.first().click();

  await expect(
    conversation(page).getByText("Em đã ghi nhận nhu cầu của anh/chị.").first(),
  ).toBeVisible();
  expect(sentMessage).toBe("Mũ fullface dưới 5 triệu");
  await expect(greeting).toHaveCount(0);
});

test("creates the visitor session only when the customer opens the chat", async ({ page }) => {
  await stubAvailability(page);
  let sessionCalls = 0;
  await page.route("**/api/v1/chat/sessions", (route) => {
    sessionCalls += 1;
    return fulfillJson(route, {
      visitorToken: "visitor-token-e2e",
      activeConversationId: null,
    });
  });

  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(1000);
  // Browsing the storefront must not mint an identifier for someone who never opens the chat.
  expect(sessionCalls).toBe(0);
  expect(
    await page.evaluate(() => window.localStorage.getItem("bb_chat_visitor_id_v1")),
  ).toBeNull();

  await openBigBike(page);
  await expect.poll(() => sessionCalls).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.sessionStorage.getItem("bb_chat_visitor_id_v1")),
  ).not.toBeNull();
  expect(
    await page.evaluate(() => window.localStorage.getItem("bb_chat_visitor_id_v1")),
  ).toBeNull();
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
  // The hidden file input and the visible image button carry the same aria-label, so the
  // locator has to say which one it means.
  await composer(page)
    .locator('input[type="file"]')
    .setInputFiles({
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

const LAYOUT_VIEWPORTS = [
  { name: "desktop 1440x900", width: 1440, height: 900, minConversation: 500 },
  { name: "small laptop 1280x800", width: 1280, height: 800, minConversation: 400 },
  { name: "short desktop 1440x700", width: 1440, height: 700, minConversation: 340 },
  { name: "phone 390x844", width: 390, height: 844, minConversation: 500 },
  { name: "small android 360x740", width: 360, height: 740, minConversation: 400 },
] as const;

const CATALOG_ANSWER = {
  answer:
    "Em gợi ý anh/chị mấy mẫu mũ fullface dưới 5 triệu đang còn hàng ở shop. Các mẫu này đều đạt chuẩn an toàn và có sẵn nhiều size.",
  products: [
    {
      slug: "mu-e2e-1",
      name: "Mũ bảo hiểm fullface E2E tem Carrera đen nhám bản giới hạn",
      retailPrice: 2_590_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
    {
      slug: "mu-e2e-2",
      name: "Mũ E2E 3/4",
      retailPrice: 1_290_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
    {
      slug: "mu-e2e-3",
      name: "Găng tay E2E mùa hè thoáng khí",
      retailPrice: 890_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
    {
      slug: "mu-e2e-4",
      name: "Giáp trụ E2E",
      retailPrice: 1_990_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
    {
      slug: "mu-e2e-5",
      name: "Áo giáp E2E",
      retailPrice: 1_490_000,
      currency: "VND",
      stockState: "IN_STOCK",
    },
  ],
  actions: [{ type: "COMPARE_PRODUCTS" }, { type: "CHECK_SIZE" }, { type: "CHANGE_BUDGET" }],
};

async function conversationGeometry(page: Page) {
  return page.evaluate(() => {
    const conversation = document.querySelector<HTMLElement>("[data-bigbike-conversation]");
    const panel = document.querySelector<HTMLElement>("[data-bigbike-assistant]");
    if (!conversation || !panel) throw new Error("BigBike chat structure is missing");
    // offsetWidth/offsetHeight ignore the 1.02 hover transform the buttons carry, so an element
    // the mouse happens to rest on does not read as a different size.
    const cards = [...document.querySelectorAll<HTMLElement>("[data-bigbike-product-card]")].map(
      (node) => node.offsetHeight,
    );
    // Buttons in the message column share one width system; a product card is its own
    // container, so its buttons are measured separately.
    const messageButtons = [...conversation.querySelectorAll<HTMLElement>("button")].filter(
      (node) => !node.closest("[data-bigbike-product-card]"),
    );
    const buttonWidths = [...new Set(messageButtons.map((node) => node.offsetWidth))].sort(
      (a, b) => a - b,
    );
    const cardButtonWidths = [
      ...new Set(
        [...conversation.querySelectorAll<HTMLElement>("[data-bigbike-product-card] button")].map(
          (node) => node.offsetWidth,
        ),
      ),
    ];
    return {
      conversationHeight: Math.round(conversation.getBoundingClientRect().height),
      scrollGap: Math.round(
        conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight,
      ),
      cardHeights: cards,
      buttonWidths,
      cardButtonWidths,
      panelWidth: Math.round(panel.getBoundingClientRect().width),
      horizontalOverflow: conversation.scrollWidth > conversation.clientWidth + 1,
    };
  });
}

test.describe("keeps the answer, the cards and the buttons aligned after a reply", () => {
  for (const viewport of LAYOUT_VIEWPORTS) {
    test(viewport.name, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await stubAvailability(page);
      await page.route("**/api/v1/chat/messages/stream", (route) =>
        fulfillChatStream(route, messageResponse(CATALOG_ANSWER)),
      );
      await page.goto("/", { waitUntil: "load" });
      await openBigBike(page);

      const empty = await conversationGeometry(page);
      expect(empty.conversationHeight).toBeGreaterThanOrEqual(viewport.minConversation);

      await sendMessage(page, "Mũ fullface dưới 5 triệu");
      await expect(
        conversation(page)
          .getByText(/Em gợi ý anh\/chị/)
          .first(),
      ).toBeVisible();
      // The typing effect runs for about 1.3s and the cards keep growing after it.
      await page.waitForTimeout(3000);

      const answered = await conversationGeometry(page);
      // Owner decision 2026-09-06: the newest answer must never sit above the fold again.
      expect(answered.scrollGap).toBeLessThanOrEqual(4);
      expect(answered.horizontalOverflow).toBeFalsy();
      // Product cards in one list are the same height (two lines reserved for the title).
      expect(
        Math.max(...answered.cardHeights) - Math.min(...answered.cardHeights),
      ).toBeLessThanOrEqual(2);
      // One width system only: full width, or two equal halves of it.
      expect(answered.buttonWidths.length).toBeLessThanOrEqual(2);
      if (answered.buttonWidths.length === 2) {
        const [half, full] = answered.buttonWidths;
        expect(Math.abs(full - (half * 2 + 8))).toBeLessThanOrEqual(2);
      }
      // Every product card offers its CTA at the same width.
      expect(answered.cardButtonWidths.length).toBe(1);

      await conversation(page)
        .getByRole("button", { name: /Xem thêm \d+ sản phẩm|View \d+ more products/i })
        .click();
      await page.waitForTimeout(1200);

      const expanded = await conversationGeometry(page);
      expect(expanded.scrollGap).toBeLessThanOrEqual(4);
      expect(
        Math.max(...expanded.cardHeights) - Math.min(...expanded.cardHeights),
      ).toBeLessThanOrEqual(2);
      expect(expanded.buttonWidths.length).toBeLessThanOrEqual(2);
      expect(expanded.cardButtonWidths.length).toBe(1);
    });
  }
});

test("does not yank the customer back down while they read older messages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", (route) =>
    fulfillChatStream(route, messageResponse(CATALOG_ANSWER)),
  );
  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Mũ fullface dưới 5 triệu");
  await expect(
    conversation(page)
      .getByText(/Em gợi ý anh\/chị/)
      .first(),
  ).toBeVisible();
  await page.waitForTimeout(3000);

  // Scroll back up, then let the conversation grow the way a late image or an expanded card
  // would. Clicking a control cannot stand in for this: Playwright scrolls it into view first.
  await conversation(page).evaluate((node) => node.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
  await conversation(page).evaluate((node) => {
    const spacer = document.createElement("div");
    spacer.style.height = "400px";
    node.firstElementChild?.append(spacer);
  });
  await page.waitForTimeout(800);

  const scrollTop = await conversation(page).evaluate((node) => node.scrollTop);
  expect(scrollTop).toBeLessThanOrEqual(8);
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
          page.getByLabel(/Câu hỏi dành cho trợ lý BigBike|Question for the BigBike Assistant/i),
        ).toBeVisible();
        await expect(
          composer(page).getByRole("button", { name: /Gửi tin nhắn|Send message/i }),
        ).toBeVisible();
        await expect(
          composer(page).locator(
            'button[aria-label="Gửi ảnh cho trợ lý"], button[aria-label="Send an image to the assistant"]',
          ),
        ).toBeVisible();
        // Owner decision 2026-09-06: the contact button moved to the header so the input row
        // gets its width back — three equal icon buttons up top, none of them in the composer.
        await expect(
          composer(page).getByRole("button", { name: /Mở thẻ liên hệ|Open contact card/i }),
        ).toHaveCount(0);
        await expect(header(page).getByRole("button")).toHaveCount(3);
        await expect(header(page).getByRole("button", { name: /Thu nhỏ|Minimize/i })).toHaveCount(
          0,
        );
        await expect(
          header(page).getByRole("button", { name: /Xoá cuộc trò chuyện|Delete conversation/i }),
        ).toBeVisible();

        // The input row must be flush: field and buttons exactly the same height.
        const rowHeights = await composer(page)
          .locator("form")
          .evaluate((form) =>
            [...form.children]
              // The file input and the sr-only label are visually hidden slivers.
              .filter((node) => node.getBoundingClientRect().height > 8)
              .map((node) => Math.round(node.getBoundingClientRect().height)),
          );
        expect(rowHeights.length).toBeGreaterThan(1);
        expect(new Set(rowHeights).size).toBe(1);

        // The placeholder must be readable in full, even on a 360px phone.
        const placeholderFits = await page
          .locator("#bigbike-chat-message")
          .evaluate((input: HTMLInputElement) => input.scrollWidth <= input.clientWidth + 1);
        expect(placeholderFits).toBeTruthy();

        await expectChatFitsViewport(page, viewport.width >= 768);
      });
    }
  }
});
