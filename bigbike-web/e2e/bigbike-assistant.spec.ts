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

type AvailabilityOverrides = {
  mode?: "AI" | "CONTACT";
  greeting?: string | null;
  quickPrompts?: string[];
  maxTurns?: number;
  contacts?: Record<string, unknown>;
  delayMs?: number;
};

type MessageOverrides = {
  conversationId?: string | null;
  assistantMessageId?: string | null;
  mode?: "AI" | "CONTACT";
  answer?: string | null;
  turnCount?: number;
  maxTurns?: number;
  remainingTurns?: number;
  products?: Array<Record<string, unknown>>;
  handoffRecommended?: boolean;
  leadPrompt?: boolean;
  leadPromptSequence?: 0 | 1 | 2;
  actions?: Array<Record<string, unknown>>;
  contacts?: Record<string, unknown>;
  resultKind?: string;
};

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

async function fulfillChatStream(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
    body: [
      'event: progress\ndata: {"code":"UNDERSTANDING"}',
      'event: progress\ndata: {"code":"CHECKING_PRODUCTS"}',
      `event: result\ndata: ${JSON.stringify(data)}`,
      "",
    ].join("\n\n"),
  });
}

async function stubAvailability(page: Page, overrides: AvailabilityOverrides = {}) {
  await page.route("**/api/v1/chat/availability?lang=vi", async (route) => {
    if (overrides.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, overrides.delayMs));
    }
    const mode = overrides.mode ?? "AI";
    await fulfillJson(route, {
      mode,
      reason: mode,
      greeting: overrides.greeting === undefined
        ? "Anh/chị đang tìm loại sản phẩm nào?"
        : overrides.greeting,
      quickPrompts: overrides.quickPrompts ?? [
        "Tìm theo nhu cầu",
        "Lọc theo ngân sách",
        "So sánh sản phẩm",
        "Kiểm tra còn hàng",
      ],
      maxTurns: overrides.maxTurns ?? 12,
      contacts: overrides.contacts ?? CONTACTS,
    });
  });
}

function messageResponse(overrides: MessageOverrides = {}) {
  return {
    conversationId: overrides.conversationId === undefined ? CONVERSATION_ID : overrides.conversationId,
    assistantMessageId: overrides.assistantMessageId === undefined
      ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      : overrides.assistantMessageId,
    mode: overrides.mode ?? "AI",
    reason: overrides.mode ?? "AI",
    answer: overrides.answer === undefined ? "Trợ lý BigBike đã kiểm tra dữ liệu sản phẩm hiện có." : overrides.answer,
    turnCount: overrides.turnCount ?? 1,
    maxTurns: overrides.maxTurns ?? 12,
    remainingTurns: overrides.remainingTurns ?? 11,
    products: overrides.products ?? [],
    handoffRecommended: overrides.handoffRecommended ?? false,
    leadPrompt: overrides.leadPrompt ?? false,
    leadPromptSequence: overrides.leadPromptSequence ?? (overrides.leadPrompt ? 1 : 0),
    actions: overrides.actions ?? [],
    contacts: overrides.contacts ?? CONTACTS,
    answerFormat: "PLAIN_TEXT",
    resultKind: overrides.resultKind ?? "ANSWER",
  };
}

function bigbikeDialog(page: Page) {
  return page.locator("[data-bigbike-assistant]");
}

function conversation(page: Page) {
  return page.locator("[data-bigbike-conversation]");
}

function composer(page: Page) {
  return page.locator("[data-bigbike-composer]");
}

function launcher(page: Page) {
  return page.getByRole("button", { name: /Mở Trợ lý BigBike|Open BigBike Assistant/i });
}

function messageInput(page: Page) {
  return page.getByLabel(/Câu hỏi dành cho Trợ lý BigBike|Question for BigBike Assistant/i);
}

async function openBigBike(page: Page) {
  const trigger = launcher(page);
  await expect(trigger).toBeVisible();
  await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bigbike-launcher-ready", "true");
  await trigger.focus();
  await trigger.press("Enter");
  await expect(bigbikeDialog(page)).toBeVisible();
}

async function sendMessage(page: Page, message: string) {
  await messageInput(page).fill(message);
  await page.getByRole("button", { name: /Gửi tin nhắn|Send message/i }).click();
}

test("BigBike Assistant loads availability once, shows onboarding, and sends a quick reply through chat API", async ({ page }) => {
  let availabilityRequests = 0;
  await page.route("**/api/v1/chat/availability?lang=vi", async (route) => {
    availabilityRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fulfillJson(route, {
      mode: "AI",
      reason: "AI",
      greeting: "Anh/chị đang tìm loại sản phẩm nào?",
      quickPrompts: ["Tìm theo nhu cầu", "Lọc theo ngân sách", "So sánh sản phẩm", "Kiểm tra còn hàng", "Prompt dư"],
      maxTurns: 12,
      contacts: CONTACTS,
    });
  });
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({
      conversationId: null,
      message: "Tìm theo nhu cầu",
      lang: "vi",
      pageContext: null,
      originInteractionId: null,
    });
    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    await fulfillChatStream(route, messageResponse({ answer: "Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?" }));
  });

  await page.goto("/", { waitUntil: "load" });
  const trigger = launcher(page);
  await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bigbike-launcher-ready", "true");
  await trigger.focus();
  await trigger.press("Enter");
  await expect(bigbikeDialog(page)).toBeVisible();
  await expect(bigbikeDialog(page).getByText("Trợ lý BigBike đang chuẩn bị phiên tư vấn…")).toBeVisible();
  const onboarding = bigbikeDialog(page).locator("[data-bigbike-onboarding]");
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText("Anh/chị đang tìm loại sản phẩm nào?")).toBeVisible();
  await expect(bigbikeDialog(page).locator('[data-bigbike-avatar] svg')).toHaveCount(2);
  const panelBox = await bigbikeDialog(page).boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeGreaterThanOrEqual(400);
  expect(panelBox!.width).toBeLessThanOrEqual(440);
  expect(panelBox!.height).toBeLessThanOrEqual(640);
  expect(panelBox!.height).toBeLessThanOrEqual((viewport?.height ?? 736) - 96);
  await expect(onboarding.getByRole("button")).toHaveCount(4);
  await expect(onboarding.getByRole("button", { name: "Prompt dư" })).toHaveCount(0);
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();

  await onboarding.getByRole("button", { name: "Tìm theo nhu cầu" }).press("Enter");
  await expect(conversation(page).getByText("Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?")).toBeVisible();

  await bigbikeDialog(page).getByRole("button", { name: "Thu nhỏ Trợ lý BigBike" }).click();
  await page.getByRole("button", { name: "Mở lại Trợ lý BigBike" }).click();
  await expect(conversation(page).getByText("Anh/chị chủ yếu dùng sản phẩm để đi phố, touring hay đi xa?")).toBeVisible();
  expect(availabilityRequests).toBe(1);
});

test("BigBike Assistant renders at most three verified, sellable product cards", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({
      answer: "Dạ, em đã tìm được các mẫu phù hợp. Anh/chị có thể xem các thẻ sản phẩm bên dưới nhé.",
      products: [
        {
          slug: "mu-pho",
          name: "Mũ đi phố",
          imageUrl: null,
          retailPrice: 1_590_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "mu-touring",
          name: "Mũ touring",
          imageUrl: null,
          retailPrice: 2_400_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "mu-fullface",
          name: "Mũ fullface",
          imageUrl: null,
          retailPrice: 3_000_000,
          salePrice: null,
          currency: "VND",
          stockState: "IN_STOCK",
        },
      ],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm ba mẫu mũ phù hợp");

  const cards = conversation(page).locator("[data-bigbike-product-card]");
  await expect(cards).toHaveCount(3);
  await expect(conversation(page).locator("[data-bigbike-product-list]")).toHaveClass(/overflow-x-auto/);
  await expect(cards.filter({ hasText: "Mũ đi phố" })).toContainText("Còn hàng");
  await expect(cards.filter({ hasText: "Mũ touring" })).toContainText("Còn hàng");
  await expect(cards.filter({ hasText: "Mũ fullface" })).toContainText("Còn hàng");
  await expect(cards.getByRole("link", { name: "Xem chi tiết" })).toHaveCount(3);
});

test("BigBike Assistant removes an unsafe product card while keeping a verified sellable card", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({
      answer: "Dạ, em đã kiểm tra kết quả. Anh/chị xem các thẻ sản phẩm bên dưới nhé.",
      products: [
        {
          slug: "mu-hop-le",
          name: "Mũ hợp lệ",
          retailPrice: 1_590_000,
          currency: "VND",
          stockState: "IN_STOCK",
        },
        {
          slug: "camera-khong-hop-le",
          name: "Camera không được bán",
          retailPrice: null,
          currency: "VND",
          stockState: "OUT_OF_STOCK",
        },
      ],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "tai nghe dưới 3 triệu");

  await expect(conversation(page).locator("[data-bigbike-product-card]")).toHaveCount(1);
  await expect(conversation(page).getByRole("heading", { name: "Mũ hợp lệ" })).toBeVisible();
  await expect(conversation(page).getByText("Camera không được bán")).toHaveCount(0);
  await expect(messageInput(page)).toBeEnabled();
});

test("BigBike Assistant presents a handoff recommendation without pretending a staff connection", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({
      answer: "Trợ lý BigBike chưa có đủ dữ liệu đã xác nhận cho yêu cầu này.",
      handoffRecommended: true,
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Mẫu này có phù hợp tuyệt đối không?");

  await expect(conversation(page).getByText(/chưa có đủ dữ liệu đã xác nhận/i)).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();
  await expect(page.getByText(/nhân viên đang online/i)).toHaveCount(0);
  await expect(messageInput(page)).toBeEnabled();

  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toContainText("Trợ lý BigBike vẫn giữ cuộc trò chuyện này trong phiên hiện tại.");
});

test("BigBike Assistant shows no-results only for an explicit product-finding quick reply", async ({ page }) => {
  await stubAvailability(page, {
    quickPrompts: [
      "Tìm giúp tôi mũ bảo hiểm dưới 2 triệu.",
      "Gợi ý mũ bảo hiểm từ 2 đến 5 triệu.",
      "Hướng dẫn tôi chọn size mũ phù hợp.",
      "Mẫu nào hiện còn hàng?",
    ],
  });
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({
      answer: "Chưa có mẫu nào đáp ứng đồng thời các điều kiện này.",
      actions: [
        { type: "CHANGE_BUDGET" },
        { type: "CHANGE_NEEDS" },
        { type: "CONTACT_STAFF" },
      ],
    }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await bigbikeDialog(page).locator("[data-bigbike-onboarding]")
    .getByRole("button", { name: "Tìm giúp tôi mũ bảo hiểm dưới 2 triệu." }).click();

  await expect(conversation(page).getByText("Chưa tìm thấy mẫu khớp đủ điều kiện.")).toBeVisible();
  await expect(conversation(page).getByRole("button", { name: "Đổi ngân sách" })).toBeVisible();
  await expect(conversation(page).getByRole("button", { name: "Đổi nhu cầu" })).toBeVisible();
  await expect(conversation(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();
});

test("A product-free FAQ answer is not mislabeled as no-results", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({ answer: "BigBike sẽ tư vấn theo thông tin đã được xác nhận." }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "BigBike tư vấn thế nào?");

  await expect(conversation(page).getByText("BigBike sẽ tư vấn theo thông tin đã được xác nhận.")).toBeVisible();
  await expect(conversation(page).getByText("Chưa tìm thấy mẫu khớp đủ điều kiện.")).toHaveCount(0);
});

test("A message network error fails safely to contact mode and offers retry", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", (route) => route.abort("failed"));

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm mũ bảo hiểm");

  await expect(composer(page).getByText("Kết nối đang gián đoạn; anh/chị có thể thử lại hoặc liên hệ nhân viên.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toBeVisible();
  await expect(page.getByText(/stack trace|exception|functionCall|SQL/i)).toHaveCount(0);
});

test("A delayed message stops after 75 seconds, restores the draft, and keeps both next steps", async ({ page }) => {
  test.setTimeout(105_000);
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 76_000));
    await fulfillChatStream(route, messageResponse({ answer: "Phản hồi đến quá muộn." })).catch(() => {});
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm mũ trong tầm giá này");

  await expect(composer(page).getByText(
    "Trợ lý BigBike chưa trả lời trong 75 giây. Anh/chị có thể thử lại; nút Gặp nhân viên vẫn luôn có sẵn.",
  )).toBeVisible({ timeout: 80_000 });
  await expect(messageInput(page)).toHaveValue("Tìm mũ trong tầm giá này");
  await expect(composer(page).getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(composer(page).getByRole("button", { name: "Gặp nhân viên" })).toBeVisible();
  await expect(conversation(page).getByText("Phản hồi đến quá muộn.")).toHaveCount(0);
});

test("CONTACT availability renders only valid channels and handles no contact data", async ({ page }) => {
  await stubAvailability(page, {
    mode: "CONTACT",
    quickPrompts: [],
    contacts: {
      hotline: "not-a-phone",
      zaloUrl: "javascript:alert(1)",
      messengerUrl: "not-a-url",
    },
  });
  let messageRequests = 0;
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    messageRequests += 1;
    await route.abort("failed");
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);

  await expect(page.getByText("Kết nối tư vấn", { exact: true })).toBeVisible();
  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.getByText("Thông tin liên hệ đang được cập nhật. Anh/chị vui lòng thử lại sau.")).toBeVisible();
  await expect(page.locator('[data-bigbike-contact-inline] a[href=""]')).toHaveCount(0);
  await expect(page.getByText(/null|undefined|\[object Object\]/i)).toHaveCount(0);
  expect(messageRequests).toBe(0);
});

test("Lead capture validates consent, keeps values after submit error, and succeeds on retry", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({
      answer: "BigBike có thể liên hệ lại nếu anh/chị đồng ý.",
      leadPrompt: true,
    }));
  });
  let leadAttempts = 0;
  await page.route("**/api/v1/chat/leads", async (route) => {
    leadAttempts += 1;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      conversationId: CONVERSATION_ID,
      phone: "0909123456",
      name: "Minh",
      note: "Cần tư vấn mũ touring",
      consent: true,
    });
    if (leadAttempts === 1) {
      await fulfillJson(route, { message: "temporary" }, 500);
      return;
    }
    await fulfillJson(route, { captured: true });
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Nhờ BigBike gọi lại");

  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await page.getByRole("button", { name: "Để BigBike liên hệ lại" }).click();
  const leadForm = conversation(page)
    .getByRole("region", { name: "Để BigBike liên hệ lại" })
    .locator("form");
  await expect(leadForm).toBeVisible();
  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();
  await expect(leadForm.getByText("Vui lòng nhập số điện thoại hoặc Zalo.")).toBeVisible();
  await expect(leadForm.getByText("Anh/chị cần đồng ý trước khi gửi thông tin.")).toBeVisible();

  await leadForm.getByLabel("Tên của anh/chị (không bắt buộc)").fill("Minh");
  await leadForm.getByLabel("Số điện thoại hoặc Zalo").fill("0909123456");
  await leadForm.getByLabel("Nhu cầu cần hỗ trợ (không bắt buộc)").fill("Cần tư vấn mũ touring");
  await leadForm.getByRole("checkbox").check();
  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();

  await expect(leadForm.getByText(/Chưa gửi được thông tin/)).toBeVisible();
  await expect(leadForm.getByLabel("Số điện thoại hoặc Zalo")).toHaveValue("0909123456");
  await expect(leadForm.getByLabel("Nhu cầu cần hỗ trợ (không bắt buộc)")).toHaveValue("Cần tư vấn mũ touring");

  await leadForm.getByRole("button", { name: "Đồng ý gửi thông tin" }).click();
  await expect(conversation(page).getByText(/BigBike đã ghi nhận và sẽ liên hệ/).last()).toBeVisible();
  expect(leadAttempts).toBe(2);
});

test("A viewed first lead invitation is replaced by one second invitation after a size follow-up", async ({ page }) => {
  await stubAvailability(page);
  const viewedSequences: number[] = [];
  let messageCount = 0;
  await page.route("**/api/v1/chat/interactions", async (route) => {
    const body = route.request().postDataJSON();
    if (body.type === "LEAD_PROMPT_VIEWED") viewedSequences.push(body.leadPromptSequence);
    await fulfillJson(route, {
      recorded: true,
      interactionId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${viewedSequences.length || 1}`,
    });
  });
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    messageCount += 1;
    await fulfillChatStream(route, messageResponse(messageCount === 1
      ? {
          assistantMessageId: "11111111-1111-4111-8111-111111111111",
          answer: "BigBike đã tìm được một mẫu phù hợp để tư vấn tiếp.",
          leadPrompt: true,
          leadPromptSequence: 1,
        }
      : {
          assistantMessageId: "22222222-2222-4222-8222-222222222222",
          answer: "Mẫu đã xác minh hiện có lựa chọn size phù hợp.",
          leadPrompt: true,
          leadPromptSequence: 2,
        }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm một mẫu mũ đi phố");
  await expect(page.locator("[data-bigbike-lead-prompt]")).toHaveCount(1);
  await expect.poll(() => viewedSequences).toEqual([1]);

  await sendMessage(page, "Mẫu này còn size M không?");
  await expect(conversation(page).getByText("Mẫu đã xác minh hiện có lựa chọn size phù hợp.")).toBeVisible();
  await expect(page.locator("[data-bigbike-lead-prompt]")).toHaveCount(1);
  await expect.poll(() => viewedSequences).toEqual([1, 2]);
});

test("A fixed suggestion click is recorded before its answer and remains attached to the cart line", async ({ page }) => {
  await stubAvailability(page);
  const actionInteractionId = "33333333-3333-4333-8333-333333333333";
  const eventOrder: string[] = [];
  const cartRequests: Array<Record<string, unknown>> = [];
  let messageCount = 0;

  await page.route("**/api/v1/chat/interactions", async (route) => {
    const body = route.request().postDataJSON();
    eventOrder.push(body.type === "ACTION_CLICKED" ? "action-click" : "lead-view");
    await fulfillJson(route, {
      recorded: true,
      interactionId: body.type === "ACTION_CLICKED"
        ? actionInteractionId
        : "44444444-4444-4444-8444-444444444444",
    });
  });
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    messageCount += 1;
    const body = route.request().postDataJSON();
    if (messageCount === 2) {
      eventOrder.push("attributed-answer");
      expect(body.originInteractionId).toBe(actionInteractionId);
    }
    await fulfillChatStream(route, messageResponse(messageCount === 1
      ? {
          assistantMessageId: "55555555-5555-4555-8555-555555555555",
          answer: "Anh/chị có thể kiểm tra size của mẫu này.",
          actions: [{ type: "CHECK_SIZE" }],
        }
      : {
          assistantMessageId: "66666666-6666-4666-8666-666666666666",
          answer: "Mẫu này có lựa chọn size phù hợp.",
          products: [{
            slug: "mu-action-e2e",
            name: "Mũ hành trình E2E",
            imageUrl: null,
            retailPrice: 1_590_000,
            salePrice: null,
            currency: "VND",
            stockState: "IN_STOCK",
          }],
        }));
  });
  await page.route("**/api/v1/products/mu-action-e2e?lang=vi", async (route) => {
    await fulfillJson(route, {
      id: "product-action-e2e",
      slug: "mu-action-e2e",
      name: "Mũ hành trình E2E",
      category: { id: "category-e2e", slug: "mu-bao-hiem", name: "Mũ bảo hiểm" },
      price: { retailPrice: 1_590_000, currency: "VND" },
      stockState: "IN_STOCK",
      publishStatus: "PUBLISHED",
      homepageBlock: "NONE",
      variants: [],
      createdAt: "2026-08-20T00:00:00Z",
      updatedAt: "2026-08-20T00:00:00Z",
    });
  });
  await page.route("**/api/v1/cart/items", async (route) => {
    cartRequests.push(route.request().postDataJSON());
    await fulfillJson(route, {
      id: "cart-e2e",
      status: "ACTIVE",
      currency: "VND",
      items: [],
      totals: {
        subtotalAmount: 1_590_000,
        discountAmount: 0,
        shippingAmount: 0,
        feeAmount: 0,
        grandTotal: 1_590_000,
      },
      leadPrompt: true,
      leadPromptSequence: 2,
    });
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm mũ touring");
  await page.getByRole("button", { name: "Kiểm tra size" }).click();
  await expect(conversation(page).getByText("Mẫu này có lựa chọn size phù hợp.")).toBeVisible();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();

  await expect.poll(() => cartRequests.length).toBe(1);
  expect(cartRequests[0]).toMatchObject({
    productId: "product-action-e2e",
    assistantConversationId: CONVERSATION_ID,
    assistantInteractionId: actionInteractionId,
  });
  expect(eventOrder.indexOf("action-click")).toBeLessThan(eventOrder.indexOf("attributed-answer"));
  await expect(page.locator("[data-bigbike-lead-prompt]")).toHaveCount(1);
});

test("A product route sends product context while ordinary routes keep it empty", async ({ page }) => {
  await stubAvailability(page, { maxTurns: 20 });
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    requestBody = route.request().postDataJSON();
    await fulfillChatStream(route, messageResponse({
      maxTurns: 20,
      remainingTurns: 19,
      answer: "Trang sản phẩm được phép tiếp tục trong giới hạn 20 lượt.",
    }));
  });

  await page.goto(`/product/${PRODUCT_CONTEXT_SLUG}`, { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Mẫu này có phù hợp đi phố không?");
  await expect(conversation(page).getByText("Trang sản phẩm được phép tiếp tục trong giới hạn 20 lượt.")).toBeVisible();
  expect(requestBody).toMatchObject({
    pageContext: { type: "PRODUCT", productSlug: PRODUCT_CONTEXT_SLUG },
  });
});

test("BigBike Assistant warns only near the turn limit and then disables further AI questions", async ({ page }) => {
  await stubAvailability(page);
  let messageCount = 0;
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    messageCount += 1;
    await fulfillChatStream(route, messageResponse(messageCount === 1
      ? {
          answer: "Trợ lý BigBike sẽ ưu tiên giúp anh/chị chốt lựa chọn.",
          turnCount: 9,
          remainingTurns: 3,
        }
      : {
          answer: "Cuộc tư vấn đã đến lượt cuối.",
          turnCount: 12,
          remainingTurns: 0,
        }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Câu hỏi thứ chín");
  await expect(composer(page).getByText(/Cuộc trò chuyện còn 3 lượt/)).toBeVisible();

  await sendMessage(page, "Câu hỏi cuối");
  await expect(composer(page).getByText(/Cuộc trò chuyện đã đạt giới hạn/)).toBeVisible();
  await expect(messageInput(page)).toBeDisabled();
  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toBeVisible();
});

test("Minimize, close, reopen, Escape, and focus restoration preserve the conversation", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, messageResponse({ answer: "Kết quả tư vấn được giữ lại trong phiên này." }));
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Giữ lại hội thoại này");
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await bigbikeDialog(page).getByRole("button", { name: "Thu nhỏ Trợ lý BigBike" }).click();
  const minimized = page.getByRole("button", { name: "Mở lại Trợ lý BigBike" });
  await expect(minimized).toBeVisible();
  await expect(page.getByText("Trợ lý BigBike · Tiếp tục tư vấn")).toBeVisible();
  await minimized.click();
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await bigbikeDialog(page).getByRole("button", { name: "Đóng Trợ lý BigBike" }).click();
  await expect(bigbikeDialog(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
  await launcher(page).press("Enter");
  await expect(conversation(page).getByText("Kết quả tư vấn được giữ lại trong phiên này.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(bigbikeDialog(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
  const scrollState = await page.evaluate(() => ({
    body: getComputedStyle(document.body).overflowY,
    html: getComputedStyle(document.documentElement).overflowY,
    locked: document.body.hasAttribute("data-scroll-locked"),
  }));
  expect(scrollState.body).not.toBe("hidden");
  expect(scrollState.html).not.toBe("hidden");
  expect(scrollState.locked).toBe(false);
});

test("An invalid backend payload is hidden and downgraded to safe contact mode", async ({ page }) => {
  await stubAvailability(page);
  await page.route("**/api/v1/chat/messages/stream", async (route) => {
    await fulfillChatStream(route, {
      mode: "AI",
      answer: "functionCall search_products SELECT * FROM products",
      remainingTurns: 11,
      products: [{ slug: "unsafe", name: "Unsafe" }],
      actions: [{ type: "https://evil.example" }],
      contacts: CONTACTS,
    });
  });

  await page.goto("/", { waitUntil: "load" });
  await openBigBike(page);
  await sendMessage(page, "Tìm mũ bảo hiểm");

  await expect(page.getByText(/functionCall|SELECT \* FROM|Unsafe|evil\.example/i)).toHaveCount(0);
  await expect(messageInput(page)).toBeDisabled();
  await composer(page).getByRole("button", { name: "Gặp nhân viên" }).click();
  await expect(page.locator("[data-bigbike-contact-inline]")).toBeVisible();
});

test.describe("BigBike Assistant mobile full-screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("covers navigation, keeps the composer visible, and supports keyboard close", async ({ page }) => {
    await stubAvailability(page);
    await page.goto("/sp/", { waitUntil: "load" });
    const trigger = launcher(page);
  await expect(page.locator("#bb-floating-chat-trigger")).toHaveAttribute("data-bigbike-launcher-ready", "true");
    await trigger.focus();
    await trigger.press("Enter");

  const dialog = bigbikeDialog(page);
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.y)).toBe(0);
    expect(Math.round(box!.width)).toBe(390);
    expect(Math.round(box!.height)).toBe(844);

    const composerBox = await composer(page).boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(845);
    const inputFontSize = await messageInput(page).evaluate((element) => getComputedStyle(element).fontSize);
    expect(Number.parseFloat(inputFontSize)).toBeGreaterThanOrEqual(16);

    const nav = page.locator("nav.bb-bottom-nav").first();
    if (await nav.count()) {
      const layering = await page.evaluate(() => {
        const panel = document.querySelector("[data-bigbike-assistant]");
        const bottomNav = document.querySelector("nav.bb-bottom-nav");
        return {
          panel: panel ? Number.parseInt(getComputedStyle(panel).zIndex || "0", 10) : 0,
          nav: bottomNav ? Number.parseInt(getComputedStyle(bottomNav).zIndex || "0", 10) : 0,
        };
      });
      expect(layering.panel).toBeGreaterThan(layering.nav);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher(page)).toBeFocused();
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  });
});
