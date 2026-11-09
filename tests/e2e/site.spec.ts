import { expect, test } from "@playwright/test";

test("česká diakritika používá jednotný font v nadpisech i kurzivě", async ({
  page,
}) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
  await page.evaluate(() => {
    const sample = document.createElement("span");
    sample.id = "czech-font-probe";
    sample.textContent = "Aa Áá Čč Ďď Éé Ěě Íí Ňň Óó Řř Šš Ťť Úú Ůů Ýý Žž";
    sample.style.fontFamily = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--serif");
    document.body.append(sample);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "#czech-font-probe",
  });
  for (const style of ["normal", "italic"]) {
    await page.locator("#czech-font-probe").evaluate((element, fontStyle) => {
      element.style.fontStyle = fontStyle;
      element.getBoundingClientRect();
    }, style);
    await page.evaluate(() => document.fonts.ready);
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(
        font.familyName,
        `Czech glyphs in ${style} must use EB Garamond`,
      ).toBe("EB Garamond");
      expect(font.isCustomFont).toBe(true);
      expect(font.glyphCount).toBeGreaterThan(0);
    }
  }
  await cdp.detach();
  await page
    .locator("#czech-font-probe")
    .evaluate((element) => element.remove());
});

test("galerie se otevře a lze ji ovládat klávesnicí", async ({ page }) => {
  await page.goto("/#galerie");
  await expect(page.locator("#galleryGrid .gallery-item")).toHaveCount(5);
  const previewSources = await page
    .locator("#galleryGrid img")
    .evaluateAll((images) =>
      images.map(
        (image) => image.getAttribute("src")?.match(/photo-\d+-[a-z\d]+/i)?.[0],
      ),
    );
  expect(new Set(previewSources).size).toBe(5);

  await page.getByRole("button", { name: "Zobrazit vše" }).click();
  const galleryDialog = page.getByRole("dialog", { name: "Fotogalerie" });
  await expect(galleryDialog).toBeVisible();
  await expect(galleryDialog.locator(".gallery-item")).toHaveCount(13);
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
  await page.getByText("Osobní plánovač návštěvy", { exact: false }).click();
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

for (const width of [320, 375, 430, 768, 1024, 1440, 1920, 2560]) {
  test(`responzivní rozvržení bez přetečení při ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".hero-visual img")).toBeVisible();
    await page.locator("#galerie").scrollIntoViewIfNeeded();
    await expect(
      page.locator("#galleryGrid .gallery-item").first(),
    ).toBeVisible();
    await page.locator("#rezervace").scrollIntoViewIfNeeded();
    await page.locator("#localPlanner summary").click();
    await expect(page.locator("#calGrid button").first()).toBeVisible();
    await page.locator("#kontakt").scrollIntoViewIfNeeded();
    await expect(page.locator("#contactForm")).toBeVisible();
    expect(
      await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      })),
    ).toEqual({ viewport: width, content: width });
    const overflowing = await page
      .locator("main, nav, footer")
      .evaluateAll((roots) =>
        roots
          .flatMap((root) => [...root.querySelectorAll<HTMLElement>("*")])
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return (
              box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)
            );
          })
          .map((element) => element.className || element.tagName),
      );
    expect(overflowing).toEqual([]);
    expect(
      await page
        .locator("h1, h2, h3")
        .evaluateAll((headings) =>
          headings
            .filter(
              (heading) =>
                heading.clientWidth > 0 &&
                heading.scrollWidth > heading.clientWidth + 1,
            )
            .map((heading) => heading.textContent),
        ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("mobilní menu podporuje Escape a vrací fokus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("kontaktní formulář připraví e-mail a nepředstírá odeslání", async ({
  page,
}) => {
  await page.goto("/#kontakt");
  await page.locator("#contact-name").fill("Test návštěvník");
  await page.locator("#contact-phone").fill("+420 777 123 456");
  await page.locator("#contact-service").selectOption("Dámský střih");
  await page.locator("#contact-message").fill("Prosím o informace.");
  const mailto = page.waitForRequest((request) =>
    request.url().startsWith("mailto:"),
  );
  await page.getByRole("button", { name: "Otevřít e-mailovou zprávu" }).click();
  const request = await mailto;
  expect(decodeURIComponent(request.url())).toContain("Test návštěvník");
  expect(decodeURIComponent(request.url())).toContain("Prosím o informace.");
  await expect(page.locator("#contactStatus")).toContainText(
    "Zprávu je potřeba v ní odeslat",
  );
  await expect(page.locator(".location-panel a")).toHaveAttribute(
    "href",
    /maps\.google\.com/,
  );
});

test("galerie drží fokus i při otevření fotografie z úplného přehledu", async ({
  page,
}) => {
  await page.goto("/#galerie");
  await page.getByRole("button", { name: "Zobrazit vše" }).click();
  const gallery = page.getByRole("dialog", {
    name: "Fotogalerie",
    exact: true,
  });
  const photo = gallery.locator(".gallery-item").first();
  await photo.click();
  const lightbox = page.getByRole("dialog", { name: "Prohlížeč fotografií" });
  await expect(lightbox).toBeVisible();
  await expect(gallery).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  await expect(gallery).toBeVisible();
  await expect(photo).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(gallery).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Zobrazit vše" }),
  ).toBeFocused();
});

test("obsah a hlavní kontakty fungují bez JavaScriptu", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#main-navigation")).toBeVisible();
  await expect(page.locator(".hero-actions a[href^='tel:']")).toBeVisible();
  await expect(page.locator(".notice")).toContainText("Dočasně uzavřeno");
  await context.close();
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
