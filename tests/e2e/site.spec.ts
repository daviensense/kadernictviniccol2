import { expect, test } from "@playwright/test";

test("galerie se otevře a lze ji ovládat klávesnicí", async ({ page }) => {
  await page.goto("/#galerie");
  await expect(page.locator("#galleryGrid .gallery-item")).toHaveCount(12);

  await page.getByRole("button", { name: "Zobrazit vše" }).click();
  const galleryDialog = page.getByRole("dialog", { name: "Fotogalerie" });
  await expect(galleryDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(galleryDialog).toBeHidden();

  await page.locator("#galleryGrid .gallery-item").first().click();
  await expect(
    page.getByRole("dialog", { name: "Prohlížeč fotografií" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Prohlížeč fotografií" }),
  ).toBeHidden();
});

test("rezervační scénář ukládá data lokálně a zobrazuje je jako nepotvrzená", async ({
  page,
}) => {
  await page.goto("/#rezervace");
  await expect(
    page.locator("#calGrid button.cal-day.has-free").first(),
  ).toBeVisible();

  const dates = page.locator("#calGrid button.cal-day.has-free");
  let dateSelected = false;
  const dateCount = await dates.count();
  for (let index = 0; index < dateCount; index += 1) {
    await dates.nth(index).click();
    const available = page.locator("#slotsWrap button.slot:not(:disabled)");
    if (await available.count()) {
      await available.first().click();
      dateSelected = true;
      break;
    }
  }
  expect(dateSelected).toBe(true);
  await page.getByRole("button", { name: "Pokračovat" }).click();

  const reservationForm = page.locator("#resForm");
  await reservationForm
    .getByLabel("Jméno a příjmení *")
    .fill('<img src=x onerror="window.__xss=1">');
  await reservationForm.getByLabel("Telefon *").fill("+420 722 294 800");
  await reservationForm.getByLabel("Služba *").selectOption("Dámský střih");
  await page.getByRole("button", { name: "Uložit místní záznam" }).click();

  await expect(
    page.getByRole("heading", { name: "Místní záznam uložen" }),
  ).toBeVisible();
  await expect(page.locator("#conf-detail img")).toHaveCount(0);
  await expect(page.locator("#conf-detail")).toContainText(
    '<img src=x onerror="window.__xss=1">',
  );
  await expect(page.locator(".confirm-sub")).toContainText(
    "Salon jej neobdržel ani nepotvrdil",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("niccol_res") ?? "[]"),
  );
  expect(saved).toHaveLength(1);
});

test("offline stav je oznámen a po návratu sítě se skryje", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Jste offline" }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: "Jste offline" }),
  ).toBeHidden();
});

test("mobilní navigace se otevírá a zavírá při přechodu na sekci", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const menu = page.getByRole("button", { name: "Menu" });
  const navigation = page.getByRole("list", { name: "Hlavní navigace" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Služby" }).click();
  await expect(page).toHaveURL(/#sluzby$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
