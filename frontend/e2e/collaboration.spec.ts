import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const qa = JSON.parse(readFileSync(process.env.SIGNAKI_QA_FILE!, "utf8"));
async function login(page: Page, admin = false) {
  await page.goto("/app/");
  await page
    .getByLabel("Username", { exact: true })
    .fill(admin ? "design-admin" : qa.username);
  await page.getByLabel("Password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your properties" }),
  ).toBeVisible();
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") list.push(e.text());
  });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
test.describe.configure({ mode: "serial" });
test("favorite, label, drawings and threaded feedback persist on the selected version", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/app/photos/${qa.photo}`);
  const fav = page.getByRole("button", { name: "Favorite photo", exact: true });
  const before = await fav.getAttribute("aria-pressed");
  await fav.click();
  await expect(fav).toHaveAttribute(
    "aria-pressed",
    before === "true" ? "false" : "true",
  );
  await page.getByLabel("Color label", { exact: true }).selectOption("blue");
  await expect(page.getByLabel("Color label", { exact: true })).toHaveValue(
    "blue",
  );
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page
    .getByLabel("Drawing tool", { exact: true })
    .selectOption("rectangle");
  const layer = page.locator(".annotation-layer.is-drawing");
  await expect(layer).toBeVisible();
  const box = (await layer.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(100);
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.7, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByText("1 annotation(s) ready to save.")).toBeVisible();
  const text = "Annotation verification " + Date.now();
  await page.getByLabel(/Comment on version/).fill(text);
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.locator(".comment").filter({ hasText: text }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done drawing" }).click();
  await page.reload();
  await expect(page.locator(".annotation-layer rect")).toHaveCount(1);
  const thread = page.locator(".comment").filter({ hasText: text });
  await thread.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel(/Comment on version/).fill("Reply verification");
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    page.locator(".comment.is-reply").filter({ hasText: "Reply verification" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "File information", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("JPEG");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: "test-results/review-tools-desktop.png",
    fullPage: true,
  });
});
test("admin customizes settings and saves a reusable preset", async ({
  page,
}) => {
  await login(page, true);
  await page.goto(`/app/properties/${qa.property}`);
  await page
    .getByRole("button", { name: "Gallery settings", exact: true })
    .click();
  await page.getByLabel("Settings preset").selectOption("workflow");
  await page
    .getByRole("switch", { name: "Download review copies", exact: true })
    .check();
  await page
    .getByRole("switch", { name: "Customer upload", exact: true })
    .check();
  await page.getByText("Customize color labels", { exact: true }).click();
  await page.getByLabel("blue label name").fill("Client selects");
  await page.getByLabel("Preset name").fill("Review workflow " + Date.now());
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Custom preset saved");
  await page.screenshot({
    path: "test-results/gallery-settings.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save gallery settings", exact: true })
    .click();
  await expect(page.getByLabel("blue label name")).toHaveValue(
    "Client selects",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
});
test("customer downloads a review copy, uploads and records a gallery decision", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/app/photos/${qa.photo}`);
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download review copy", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("-review.jpg");
  await page.goto(`/app/properties/${qa.property}`);
  await page
    .getByLabel("Gallery status", { exact: true })
    .selectOption("review");
  await page
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Decision reason")
    .fill("Review the gallery before delivery");
  await page
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Gallery activity", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Review the gallery before delivery",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add room", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Choose photographs")
    .setInputFiles({
      name: `customer-${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      buffer: readFileSync(qa.upload),
    });
  await page.getByRole("button", { name: /Upload.*photo/ }).click();
  await expect(page.getByText("Added", { exact: true })).toBeVisible();
});
test("view-only preset hides collaboration and version access, then restores workflow", async ({
  page,
  browser,
}) => {
  await login(page, true);
  await page.goto(`/app/properties/${qa.property}`);
  await page
    .getByRole("button", { name: "Gallery settings", exact: true })
    .click();
  await page.getByLabel("Settings preset").selectOption("view-only");
  await page
    .getByRole("button", { name: "Save gallery settings", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "View-only access", exact: true }),
  ).toBeChecked();
  const context = await browser.newContext();
  const customer = await context.newPage();
  await login(customer);
  await customer.goto(`/app/photos/${qa.photo}`);
  await expect(
    customer.getByRole("button", { name: "Favorite photo", exact: true }),
  ).toHaveCount(0);
  await expect(
    customer.getByRole("button", { name: "Draw", exact: true }),
  ).toHaveCount(0);
  await expect(
    customer.getByLabel("View version", { exact: true }),
  ).toHaveCount(0);
  await expect(
    customer.getByRole("button", { name: "Send comment", exact: true }),
  ).toHaveCount(0);
  await context.close();
  await page.getByLabel("Settings preset").selectOption("workflow");
  await page
    .getByRole("button", { name: "Save gallery settings", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "View-only access", exact: true }),
  ).not.toBeChecked();
});
