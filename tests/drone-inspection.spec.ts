import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const inspectionRoute = "/api/towers/rig-101/drone-inspection";
const demoVideo = "M7lc1UVf-VE";
const title = "Inspección con dron de RIG-101";
const auditDir = ".local/audit";
mkdirSync(auditDir, { recursive: true });

async function prepare(page: Page, url = "") {
  await page.goto("/");
  await page.getByRole("button", { name: "Completar acceso de demostración" }).click();
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Una mirada a toda tu operación." })).toBeVisible();
  expect((await page.request.patch(inspectionRoute, { data: { url } })).status()).toBe(200);
  await page.goto("/equipos/rig-101");
  await expect(page.getByRole("heading", { name: "RIG-101", exact: true })).toBeVisible();
}

async function mockYouTube(page: Page) {
  const requests: { url: string; referer?: string }[] = [];
  await page.route("https://www.youtube-nocookie.com/embed/**", async (route) => {
    requests.push({ url: route.request().url(), referer: route.request().headers().referer });
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html lang="es"><body style="margin:0;background:#141b18;color:#dee7e0;font-family:sans-serif;display:grid;place-content:center;height:100vh;text-align:center"><h2>Reproductor simulado</h2><p>Auditoría de integración · no es una transmisión real</p></body></html>',
    });
  });
  return requests;
}

test("drone inspection saves the correct tower, embeds YouTube with a Referer, and releases the frame", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const frames = await mockYouTube(page);
  await prepare(page);
  await expect(page.getByText("Sin transmisión configurada", { exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  const before = (await (await page.request.get("/api/towers/rig-101")).json()).tower;
  const other = (await (await page.request.get("/api/towers/rig-204")).json()).tower;

  await page.getByRole("button", { name: "Configurar transmisión" }).click();
  await expect(page.getByLabel("Enlace de YouTube", { exact: true })).toBeFocused();
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://example.com/video");
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.locator(".drone-form").getByRole("alert")).toContainText("YouTube");
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill(`https://youtube.com/live/${demoVideo}?si=tracking`);
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.getByText("Transmisión guardada para este equipo.", { exact: true })).toBeVisible();
  const current = (await (await page.request.get("/api/towers/rig-101")).json()).tower;
  expect(current.cameras).toEqual(before.cameras);
  expect(current.parameters).toEqual(before.parameters);
  expect(current.updatedAt).toBe(before.updatedAt);
  expect((await (await page.request.get("/api/towers/rig-204")).json()).tower).toEqual(other);

  const response = await page.reload();
  expect(response?.headers()["content-security-policy"]).toContain("frame-src https://www.youtube-nocookie.com;");
  await page.getByRole("button", { name: "Inspección con dron", exact: true }).click();
  await expect(page.getByText("Enlace disponible", { exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(frames).toHaveLength(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  const iframe = page.locator(`iframe[title="${title}"]`);
  await expect(iframe).toBeVisible();
  await expect(page.frameLocator(`iframe[title="${title}"]`).getByRole("heading", { name: "Reproductor simulado" })).toBeVisible();
  await expect(iframe).toHaveAttribute("allowfullscreen", "");
  expect(frames).toHaveLength(1);
  expect(frames[0].referer).toBe("http://127.0.0.1:3101/");
  expect(new URL(frames[0].url).pathname).toBe(`/embed/${demoVideo}`);
  await expect(page.getByRole("link", { name: "Abrir en YouTube" })).toHaveAttribute("href", `https://www.youtube.com/watch?v=${demoVideo}`);
  await page.getByRole("button", { name: "Recargar video" }).click();
  await expect.poll(() => frames.length).toBe(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${auditDir}/drone-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Cerrar transmisión" }).click();
  await expect(iframe).toHaveCount(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await page.getByRole("button", { name: "Parámetros", exact: true }).click();
  await expect(iframe).toHaveCount(0);
  await page.goto("/equipos/rig-204");
  await expect(page.getByText("Sin transmisión configurada", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("drone player and configuration fit narrow phones and changed or removed links persist", async ({ page }) => {
  const frames = await mockYouTube(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, `https://youtu.be/${demoVideo}`);
  await page.getByRole("button", { name: "Inspección con dron", exact: true }).click();
  await page.getByRole("button", { name: "Editar transmisión" }).click();
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://youtu.be/abcdefghijk");
  await page.screenshot({ path: `${auditDir}/drone-config-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.getByText("Transmisión guardada para este equipo.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await expect.poll(() => frames.length).toBe(1);
  expect(new URL(frames[0].url).pathname).toBe("/embed/abcdefghijk");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const card = await page.locator(".drone-inspection").boundingBox();
    const player = await page.locator(".drone-video iframe").boundingBox();
    const heading = await page.locator(".drone-heading").boundingBox();
    expect(player!.x + player!.width).toBeLessThan(card!.x + card!.width);
    expect(player!.width).toBeGreaterThanOrEqual(200);
    expect(heading!.width).toBeGreaterThan(160);
  }
  await expect(page.frameLocator(`iframe[title="${title}"]`).getByRole("heading", { name: "Reproductor simulado" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${auditDir}/drone-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Editar transmisión" }).click();
  await page.getByRole("button", { name: "Quitar enlace" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByText("Sin transmisión configurada", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Sin transmisión configurada", { exact: true })).toBeVisible();
});

test("failed drone saves preserve the link and leave a recoverable form", async ({ page }) => {
  await prepare(page, `https://youtu.be/${demoVideo}`);
  await page.getByRole("button", { name: "Editar transmisión" }).click();
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://youtu.be/abcdefghijk");
  await page.route(`**${inspectionRoute}`, (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "No se pudo guardar. Inténtalo nuevamente." }),
  }));
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.locator(".drone-form").getByRole("alert")).toContainText("No se pudo guardar");
  await expect(page.getByRole("button", { name: "Guardar transmisión" })).toBeEnabled();
  await expect(page.getByLabel("Enlace de YouTube", { exact: true })).toHaveValue("https://youtu.be/abcdefghijk");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect((await (await page.request.get("/api/towers/rig-101")).json()).tower.droneInspection.videoId).toBe(demoVideo);
});

test("viewers can open the inspection but have no configuration controls", async ({ page }) => {
  await mockYouTube(page);
  await prepare(page, `https://youtu.be/${demoVideo}`);
  const auth = await (await page.request.get("/api/auth/me")).json();
  await page.route("**/api/auth/me", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ user: { ...auth.user, role: "viewer" } }),
  }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver transmisión", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar transmisión|Configurar transmisión/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await expect(page.locator(`iframe[title="${title}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
});
