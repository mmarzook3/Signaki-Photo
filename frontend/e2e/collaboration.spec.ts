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
test("all drawing tools retain normalized coordinates when zoomed",async({page})=>{
 await login(page);await page.goto(`/app/properties/${qa.property}`);await page.locator('.photo-card').nth(1).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Draw',exact:true}).click();
 let count=0;for(const tool of ['Pin','Brush','Rectangle','Ellipse','Arrow']){
  await page.getByRole('button',{name:tool,exact:true}).click();const box=(await page.locator('.annotation-layer.is-drawing').boundingBox())!;
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6,{steps:5});await page.mouse.up();count++;
  await expect(page.locator('.anchor-footer')).toContainText(`${count} mark`);
 }
 await page.getByRole('button',{name:'Undo drawing',exact:true}).click();await page.getByRole('button',{name:'Resume draft comment'}).click();await expect(page.locator('.anchor-footer')).toContainText('4 marks');
 const text='All tools '+Date.now();await page.getByLabel('Comment on photo',{exact:true}).fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.anchor-thread')).toContainText(text);
 const id=page.url().split('/photos/')[1].split('?')[0];const data=await(await page.request.get(`/api/v1/photos/${id}/`)).json();const shapes=data.comments.find((c:{text:string})=>c.text===text).annotations;expect(shapes).toHaveLength(4);expect(shapes[2].points[0][0]).toBeCloseTo(.4,2);expect(shapes[2].points[1][1]).toBeCloseTo(.6,2);
 await page.getByRole('button',{name:'Close photo comment'}).click();await page.getByRole('button',{name:'Reset zoom',exact:true}).click();await expect(page.locator('.annotation-layer ellipse').first()).toBeVisible();
});
test("viewer menus and anchored conversations match the reference workflow",async({page})=>{
 await login(page);await page.goto(`/app/photos/${qa.photo}`);await expect(page.locator('.viewer-inspector')).toHaveCount(0);
 await expect(page.locator('.image-stage img')).toBeVisible();await expect.poll(()=>page.locator('.image-stage img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);await page.screenshot({path:'test-results/01-viewer.png',animations:'disabled'});
 const fav=page.getByRole('button',{name:'Favorite photo',exact:true});const before=await fav.getAttribute('aria-pressed');await fav.click();await expect(fav).toHaveAttribute('aria-pressed',before==='true'?'false':'true');
 await page.getByRole('button',{name:'Photo status',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Needs review',exact:true})).toBeVisible();await page.screenshot({path:'test-results/02-status-menu.png',animations:'disabled'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Color label',exact:true}).click();await page.screenshot({path:'test-results/03-label-menu.png',animations:'disabled'});await page.getByRole('menuitem',{name:'Blue',exact:true}).click();await expect(page.getByRole('button',{name:'Color label',exact:true})).toContainText('Blue');
 await page.getByRole('button',{name:'Draw',exact:true}).click();await page.getByRole('button',{name:'Brush',exact:true}).click();
 const box=(await page.locator('.annotation-layer.is-drawing').boundingBox())!;await page.mouse.move(box.x+box.width*.47,box.y+box.height*.31);await page.mouse.down();
 for(const [x,y] of [[.52,.29],[.57,.33],[.59,.42],[.56,.5],[.49,.51],[.46,.45],[.47,.31]])await page.mouse.move(box.x+box.width*x,box.y+box.height*y,{steps:4});await page.mouse.up();
 await expect(page.getByRole('dialog',{name:'Comment on drawing'})).toBeVisible();await expect(page.locator('.viewer-inspector')).toHaveCount(0);await page.screenshot({path:'test-results/04-anchored-comment.png',animations:'disabled'});
 const text='Please soften the highlights on these flowers. '+Date.now();await page.getByLabel('Comment on photo',{exact:true}).fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.anchor-thread')).toContainText(text);
 await page.getByLabel('Reply on photo',{exact:true}).fill('Thank you — this is the area I mean.');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.anchor-thread')).toContainText('Thank you');await page.screenshot({path:'test-results/05-photo-thread.png',animations:'disabled'});
 await page.getByRole('button',{name:'Close photo comment'}).click();await page.reload();await page.getByRole('button',{name:/Open photo comment/}).last().click();await expect(page.locator('.anchor-thread')).toContainText(text);
 await page.getByRole('button',{name:'Close photo comment'}).click();await page.getByRole('button',{name:'Viewer options'}).click();await page.getByRole('menuitem',{name:'File information',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('JPEG');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/Open photo comment/}).last().click();await expect(page.locator('.anchor-card')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/06-mobile-thread.png',animations:'disabled'});
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
  await page.getByRole("button",{name:"Viewer options"}).click();
  await page.getByRole("menuitem",{name:"Download review copy",exact:true}).click();
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
  await page.getByLabel("Choose photographs").setInputFiles({
    name: `customer-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
    buffer: readFileSync(qa.upload),
  });
  await page.getByRole("button", { name: /Upload.*photo/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Upload complete" }),
  ).toBeVisible();
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
