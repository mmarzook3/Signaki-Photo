import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const file = process.env.SIGNAKI_QA_FILE;
if (!file)
  throw new Error(
    "Set SIGNAKI_QA_FILE to an isolated test credential file, never production credentials.",
  );
const qa = JSON.parse(readFileSync(file, "utf8")) as {
  username: string;
  password: string;
  property: string;
  photo: string;
  upload?: string;
};
const runtimeErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", event => { if (event.type() === "error") errors.push(event.text()); });
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
async function signIn(page: import("@playwright/test").Page, admin = false) {
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
test("customer review journey preserves room, version and draft state", async ({
  page,
}) => {
  await signIn(page);
  const draft = "Draft retained " + Date.now();
  await page.goto(`/app/properties/${qa.property}?view=grouped`);
  await expect(page.locator(".photo-card")).toHaveCount(0);
  await page
    .locator(".room-heading")
    .filter({ hasText: "Kitchen & dining" })
    .click();
  await page.locator(".photo-card").first().click();
  await expect(page.locator(".viewer-position")).toHaveText(/1 \/ /);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".image-stage")).toHaveCount(2);
  await page.getByRole("button", { name: "Close comparison" }).click();
  await page.getByLabel(/Comment on version/).fill(draft);
  await page.getByRole("button", { name: "Next photograph" }).click();
  await page.getByRole("button", { name: "Previous photograph" }).click();
  await expect(page.getByLabel(/Comment on version/)).toHaveValue(draft);
  await page.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(page.locator(".comment").getByText(draft)).toBeVisible();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Reject photo", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Reason (required)", { exact: true })
    .fill("Workflow test: duplicate angle.");
  await page.getByRole("button", { name: "Reject photo", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".decision-block")).toContainText("Rejected");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByLabel("Reason (required)", { exact: true })
    .fill("Workflow test: adjust warmth.");
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(page.locator(".decision-block")).toContainText("Changes needed");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".decision-block")).toContainText("Approved");
  await page.getByRole("link", { name: "Back to gallery" }).click();
  await expect(page.locator(".photo-card").first()).toBeVisible();
  await page.getByLabel("Search photographs").fill("no-such-photo");
  await expect(page.getByText("No matching photographs")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".photo-card").first()).toBeVisible();
});
test("mobile gallery and viewer remain usable without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/app/properties/${qa.property}`);
  await page.locator(".photo-card").first().click();
  await expect(page.locator(".image-stage img")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Hide feedback", exact: true })
    .click();
  await expect(page.locator(".viewer-inspector")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Show feedback", exact: true })
    .click();
  await expect(page.locator(".viewer-inspector")).toBeVisible();
  await page.screenshot({
    path: "test-results/viewer-mobile.png",
    fullPage: true,
  });
});
test("admin can manage delivery, upload, replace and resolve feedback", async ({
  page,
}) => {
  await signIn(page, true);
  await page.goto(`/app/properties/${qa.property}`);
  await page
    .getByRole("button", { name: "Property settings", exact: true })
    .click();
  await page
    .getByLabel("Google Drive delivery link")
    .fill("https://drive.google.com/drive/folders/workflow-test");
  await page.getByLabel("Share delivery link with customer").check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "High-quality photos" }),
  ).toBeVisible();
  await page.locator(".photo-card").first().click();
  await page
    .getByRole("button", { name: "Photo settings", exact: true })
    .click();
  await expect(page.getByLabel("Hide from customer")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if (qa.upload) {
    await page
      .getByRole("button", { name: "Upload new version", exact: true })
      .click();
    await page.getByLabel("Replacement photo").setInputFiles(qa.upload);
    await page
      .getByLabel("What changed?")
      .fill("Automated staging replacement");
    await page
      .getByRole("button", { name: "Add version", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".decision-block")).toContainText(
      "Awaiting review",
    );
  }
  await page.goto("/app/feedback");
  await expect(
    page.getByRole("heading", { name: "Customer feedback" }),
  ).toBeVisible();
  const resolve = page
    .getByRole("button", { name: "Resolve", exact: true })
    .first();
  if (await resolve.count()) {
    await resolve.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.goto("/app/customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(page.getByLabel("Temporary password")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
});

test("admin provisions customer, property and room; customer changes temporary password", async ({
  page,
  browser,
}) => {
  test.skip(!qa.upload, "Upload fixture is required");
  const name = "QA " + Date.now();
  const username = "qa-" + Date.now();
  await signIn(page, true);
  await page.goto("/app/customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Display name").fill(name);
  await page
    .getByLabel("Temporary password", { exact: true })
    .fill(qa.password);
  await page.getByLabel("Confirm password", { exact: true }).fill(qa.password);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/app/");
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByLabel("Property name", { exact: true }).fill(name);
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption({ label: `${name} (${username})` });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .locator(".property-card")
    .filter({ hasText: name })
    .locator("a")
    .first()
    .click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByLabel("New room name").fill("Test room");
  await page.getByRole("button", { name: "Add room", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Room or location", exact: true }),
  ).not.toHaveValue("");
  await page.getByLabel("Choose photographs").setInputFiles(qa.upload!);
  await page
    .getByRole("button", { name: "Upload photographs", exact: true })
    .click();
  await expect(
    page.getByText("qa-upload: Uploaded", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".upload-success svg")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".photo-card")).toHaveCount(1);
  const context = await browser.newContext();
  const customer = await context.newPage();
  await customer.goto(
    (process.env.SIGNAKI_TEST_URL || "http://127.0.0.1:18124") + "/app/",
  );
  await customer.getByLabel("Username", { exact: true }).fill(username);
  await customer.getByLabel("Password", { exact: true }).fill(qa.password);
  await customer.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    customer.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await customer.getByLabel("Current password").fill(qa.password);
  await customer
    .getByLabel("New password", { exact: true })
    .fill(qa.password + "x");
  await customer
    .getByLabel("Confirm password", { exact: true })
    .fill(qa.password + "x");
  await customer
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    customer.getByRole("heading", { name: "Your properties" }),
  ).toBeVisible();
  await expect(customer.locator(".property-card")).toHaveCount(1);
  await expect(customer.locator(".property-card")).toContainText(name);
  await context.close();
});
