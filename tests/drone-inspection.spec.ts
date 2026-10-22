import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const inspectionRoute = "/api/drone-inspection";
const demoVideo = "M7lc1UVf-VE";
const title = "Inspección con dron en vivo";
const auditDir = ".local/audit";
mkdirSync(auditDir, { recursive: true });

async function prepare(page: Page, url = "") {
  await page.goto("/");
  await page.getByRole("button", { name: "Completar acceso de demostración" }).click();
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Una mirada a toda tu operación." })).toBeVisible();
  expect((await page.request.patch(inspectionRoute, { data: { url } })).status()).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Una mirada a toda tu operación." })).toBeVisible();
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

test("home offers a shared inspection without configuration or per-tower controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const frames = await mockYouTube(page);
  await prepare(page);
  await expect(page.getByText("Próxima inspección", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Configurar transmisión|Editar transmisión/ })).toHaveCount(0);
  await expect(page.getByLabel("Enlace de YouTube", { exact: true })).toHaveCount(0);
  const before = await (await page.request.get("/api/towers")).json();
  await page.getByRole("link", { name: "Administración", exact: true }).click();
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://example.com/video");
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.locator(".drone-settings-form").getByRole("alert")).toContainText("YouTube");
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill(`https://youtube.com/live/${demoVideo}?si=tracking`);
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.getByText("Transmisión guardada para el inicio de HORUS.", { exact: true })).toBeVisible();
  expect(await (await page.request.get("/api/towers")).json()).toEqual(before);
  await page.getByRole("link", { name: "Vista general", exact: true }).click();
  const response = await page.reload();
  expect(response?.headers()["content-security-policy"]).toContain("frame-src https://www.youtube-nocookie.com;");
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(frames).toHaveLength(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  const iframe = page.locator(`iframe[title="${title}"]`);
  await expect(page.frameLocator(`iframe[title="${title}"]`).getByRole("heading", { name: "Reproductor simulado" })).toBeVisible();
  expect(frames[0].referer).toBe("http://127.0.0.1:3101/");
  await expect(iframe).toHaveAttribute("allowfullscreen", "");
  await expect(page.getByRole("link", { name: "Abrir en YouTube" })).toHaveAttribute("href", `https://www.youtube.com/watch?v=${demoVideo}`);
  await page.getByRole("button", { name: "Recargar video" }).click();
  await expect.poll(() => frames.length).toBe(2);
  await page.locator(".drone-inspection").screenshot({ path: `${auditDir}/drone-home-desktop.png` });
  await page.getByRole("button", { name: "Cerrar transmisión" }).click();
  await expect(iframe).toHaveCount(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await page.goto("/equipos/rig-101");
  await expect(page.getByRole("heading", { name: "RIG-101", exact: true })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".drone-inspection")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inspección con dron", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("shared inspection fits phones and removal persists on the home page", async ({ page }) => {
  await mockYouTube(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, `https://youtu.be/${demoVideo}`);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await expect(page.frameLocator(`iframe[title="${title}"]`).getByRole("heading", { name: "Reproductor simulado" })).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const card = await page.locator(".drone-inspection").boundingBox();
    const player = await page.locator(".drone-video iframe").boundingBox();
    expect(player!.x + player!.width).toBeLessThan(card!.x + card!.width);
    expect(player!.width).toBeGreaterThanOrEqual(200);
  }
  await page.locator(".drone-inspection").screenshot({ path: `${auditDir}/drone-home-mobile.png` });
  await page.goto("/administracion");
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://youtu.be/abcdefghijk");
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.getByRole("status")).toContainText("Transmisión guardada");
  await page.reload();
  await expect(page.getByLabel("Enlace de YouTube", { exact: true })).toHaveValue("https://www.youtube.com/watch?v=abcdefghijk");
  await page.getByRole("button", { name: "Quitar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("eliminado");
  await page.goto("/");
  await expect(page.getByText("Próxima inspección", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver transmisión", exact: true })).toHaveCount(0);
});

test("failed administration saves preserve the shared inspection and allow retry", async ({ page }) => {
  await prepare(page, `https://youtu.be/${demoVideo}`);
  await page.goto("/administracion");
  await page.getByLabel("Enlace de YouTube", { exact: true }).fill("https://youtu.be/abcdefghijk");
  await page.route(`**${inspectionRoute}`, route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "No se pudo guardar. Inténtalo nuevamente." }),
  }));
  await page.getByRole("button", { name: "Guardar transmisión" }).click();
  await expect(page.locator(".drone-settings-form").getByRole("alert")).toContainText("No se pudo guardar");
  await expect(page.getByRole("button", { name: "Guardar transmisión" })).toBeEnabled();
  expect((await (await page.request.get(inspectionRoute)).json()).inspection.videoId).toBe(demoVideo);
});

test("viewers watch the shared inspection but cannot open administration", async ({ page }) => {
  await mockYouTube(page);
  await prepare(page, `https://youtu.be/${demoVideo}`);
  const auth = await (await page.request.get("/api/auth/me")).json();
  await page.route("**/api/auth/me", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ user: { ...auth.user, role: "viewer" } }),
  }));
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver transmisión", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
  await page.goto("/administracion");
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("Enlace de YouTube", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver transmisión", exact: true }).click();
  await expect(page.locator(`iframe[title="${title}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
});
