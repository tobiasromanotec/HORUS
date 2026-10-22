import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const auditDir = ".local/audit";
mkdirSync(auditDir, { recursive: true });

async function login(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Completar acceso de demostración" })
    .click();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Una mirada a toda tu operación." }),
  ).toBeVisible();
}

test("authentication protects data, rejects bad credentials and invalidates logout", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/towers")).status()).toBe(401);
  const jsErrors: string[] = [];
  page.on("pageerror", (error) => jsErrors.push(error.message));
  await page.goto("/equipos");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Correo electrónico").fill("admin@horus.local");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("contraseña-incorrecta");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Completar acceso de demostración" })
    .click();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Una mirada a toda tu operación." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Una mirada a toda tu operación." }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "horus_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/towers")).status()).toBe(401);
  expect(jsErrors).toEqual([]);
});

test("dashboard renders images, operational totals and navigation without runtime errors", async ({
  page,
}) => {
  const jsErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on("pageerror", (error) => jsErrors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith("http://127.0.0.1:3101/assets/") &&
      !response.ok()
    )
      failedAssets.push(response.url());
  });
  await login(page);
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await expect(page.locator(".stat-card").first()).toContainText("06");
  await expect(page.locator(".map-rig-icon")).toHaveCount(6);
  await expect(page.locator(".hero-photo img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".hero-photo img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: `${auditDir}/dashboard-desktop.png`,
    fullPage: true,
  });
  expect(jsErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test("catalog filters by tower type, query and state, then opens equipment", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Equipos 06", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de equipos" }),
  ).toBeVisible();
  await expect(page.locator(".equipment-card")).toHaveCount(6);
  await page.getByRole("button", { name: "WORKOVER", exact: true }).click();
  await expect(page.locator(".equipment-card")).toHaveCount(2);
  await expect(page.locator(".equipment-card").first()).toContainText("WO-");
  await page.getByRole("button", { name: "Todos los equipos" }).click();
  await page
    .getByRole("textbox", { name: "Buscar equipo…", exact: true })
    .fill("RIG-101");
  await expect(page.locator(".equipment-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByLabel("Filtrar por estado").selectOption("desconectado");
  await expect(page.locator(".equipment-card")).toHaveCount(1);
  await page.getByLabel("Filtrar por estado").selectOption("todos");
  await page.screenshot({
    path: `${auditDir}/catalog-desktop.png`,
    fullPage: true,
  });
  await page
    .locator(".equipment-card")
    .filter({
      has: page.getByRole("heading", { name: "RIG-101", exact: true }),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "RIG-101", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".parameter-card")).toHaveCount(4);
  await expect(page.locator(".camera-viewer")).toHaveCount(3);
  await page.getByRole("button", { name: "Cámaras", exact: true }).click();
  await expect(page.locator(".parameter-card")).toHaveCount(0);
  await expect(page.locator(".camera-demo-notice")).toHaveCount(3);
  await page.getByRole("button", { name: "Parámetros", exact: true }).click();
  await expect(page.locator(".parameter-card")).toHaveCount(4);
  await expect(page.locator(".camera-viewer")).toHaveCount(0);
});

test("map preserves coordinates and opens the selected tower detail", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Mapa de equipos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mapa de operaciones" }),
  ).toBeVisible();
  await expect(page.locator(".map-rig-icon")).toHaveCount(6);
  await page
    .getByRole("textbox", { name: "Buscar equipo o ubicación" })
    .fill("WO-302");
  await expect(page.locator(".map-rig-icon")).toHaveCount(1);
  await page.locator(".map-equipment").click();
  await expect(page.getByRole("link", { name: "Ver WO-302" })).toBeVisible();
  await page.locator(".map-rig-icon").click();
  await expect(
    page.getByRole("link", { name: "Ver equipo", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver equipo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "WO-302", exact: true }),
  ).toBeVisible();
});

test("anomaly evidence opens and updated review status persists after reload", async ({
  page,
}) => {
  await login(page);
  await page.goto("/anomalias");
  await page
    .locator(".anomaly-table tbody tr")
    .first()
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".anomaly-modal-image img")).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .locator(".anomaly-modal-image img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByLabel("Estado de la anomalía", { exact: true })
    .selectOption("resuelta");
  await page
    .getByRole("button", { name: "Guardar estado", exact: true })
    .click();
  await expect(dialog.locator(".anomaly-review")).toContainText(
    "Estado actual: Resuelta",
  );
  await page.reload();
  await expect(
    page.getByRole("dialog").locator(".anomaly-review"),
  ).toContainText("Estado actual: Resuelta");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Resueltas", exact: true }).click();
  await expect(page.locator(".anomaly-table tbody tr")).toHaveCount(2);
});

test("new towers persist, expose disconnected sources and validate camera configuration", async ({
  page,
}) => {
  await login(page);
  await page.goto("/equipos");
  await page
    .getByRole("button", { name: "Agregar equipo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del equipo").fill("RIG-E2E-705");
  await dialog.getByLabel("Tipo de torre").selectOption("RIG");
  await dialog
    .getByLabel("Yacimiento / ubicación")
    .fill("Loma Campana, Neuquén");
  await dialog
    .getByLabel("Operador", { exact: true })
    .fill("Operador de prueba");
  await dialog.getByLabel("Pozo", { exact: true }).fill("LC-E2E-705");
  await dialog.getByLabel("Latitud").fill("-38.352");
  await dialog.getByLabel("Longitud").fill("-68.787");
  await dialog
    .getByRole("button", { name: "Agregar equipo", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("textbox", { name: "Buscar equipo…", exact: true })
    .fill("RIG-E2E-705");
  await expect(page.locator(".equipment-card")).toHaveCount(1);
  await page.locator(".equipment-card").click();
  await expect(
    page.getByRole("heading", { name: "Telemetría sin conectar" }),
  ).toBeVisible();
  await expect(page.locator(".camera-viewer")).toHaveCount(3);
  await expect(page.locator(".camera-unavailable")).toHaveCount(3);
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Tipo de fuente")
    .selectOption("image");
  await page
    .getByRole("dialog")
    .getByLabel("Dirección de la fuente")
    .fill("http://example.com/camera.jpg");
  await page
    .getByRole("button", { name: "Guardar cámara", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "HTTPS",
  );
  await page
    .getByRole("dialog")
    .getByLabel("Tipo de fuente")
    .selectOption("demo");
  await page
    .getByRole("dialog")
    .getByLabel("Dirección de la fuente")
    .fill("/assets/rig-1.jpg");
  await page
    .getByRole("dialog")
    .getByLabel("Disponibilidad")
    .selectOption("online");
  await page
    .getByRole("button", { name: "Guardar cámara", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".camera-demo-notice")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".camera-demo-notice")).toHaveCount(1);
});

test("mobile login, menu, catalog and dialogs fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const noOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await noOverflow();
  await page.screenshot({
    path: `${auditDir}/dashboard-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("link", { name: /Equipos 0/ }).click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de equipos" }),
  ).toBeVisible();
  await noOverflow();
  await page
    .getByRole("button", { name: "Agregar equipo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: `${auditDir}/catalog-mobile.png`,
    fullPage: true,
  });
});

test("HLS camera plays real test segments and releases video when leaving its tab", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://camera.example.test/**", async (route) => {
    const file = path.basename(new URL(route.request().url()).pathname);
    if (
      ![
        "test-stream.m3u8",
        "segment-00.ts",
        "segment-01.ts",
        "segment-02.ts",
        "segment-03.ts",
      ].includes(file)
    )
      return route.fulfill({ status: 404 });
    await route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: file.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t",
      body: readFileSync(`tests/fixtures/hls/${file}`),
    });
  });
  await login(page);
  const response = await page.request.patch(
    "/api/towers/rig-101/cameras/rig-101-cam-1",
    {
      data: {
        kind: "hls",
        url: "https://camera.example.test/test-stream.m3u8",
        status: "online",
      },
    },
  );
  expect(response.status()).toBe(200);
  await page.goto("/equipos/rig-101");
  await page.getByRole("button", { name: "Cámaras", exact: true }).click();
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(
      () => video.evaluate((element: HTMLVideoElement) => element.readyState),
      { timeout: 15000 },
    )
    .toBeGreaterThanOrEqual(2);
  await video.evaluate((element: HTMLVideoElement) => element.play());
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0.3);
  await page.getByRole("button", { name: "Parámetros", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("actual telemetry and captured anomaly metadata appear on the correct tower", async ({
  page,
}) => {
  await login(page);
  const created = await page.request.post("/api/towers", {
    data: {
      name: "WO-INGESTION",
      type: "WORKOVER",
      location: "Añelo",
      operator: "Prueba integración",
      well: "IN-01",
      lat: -38.35,
      lng: -68.79,
    },
  });
  expect(created.status()).toBe(201);
  const { tower } = await created.json();
  const parameters = [
    {
      key: "hook_load",
      label: "Carga de gancho",
      value: 78,
      unit: "t",
      min: 0,
      max: 120,
      history: [60, 70, 78],
    },
  ];
  expect(
    (
      await page.request.patch(`/api/towers/${tower.id}/telemetry`, {
        data: { parameters, status: "operativo" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post(`/api/towers/${tower.id}/anomalies`, {
        data: {
          title: "Hallazgo de integración",
          description: "Captura asociada a la torre correcta.",
          severity: "media",
          camera: tower.cameras[0].id,
          image: "/assets/rig-2.jpg",
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto(`/equipos/${tower.id}`);
  await expect(
    page.getByRole("heading", { name: "WO-INGESTION", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".parameter-card")).toContainText("78");
  await expect(page.locator(".anomaly-title")).toContainText(
    "Hallazgo de integración",
  );
  await expect(page.locator(".tower-title-line .status")).toContainText(
    "Operativo",
  );
  await page.screenshot({
    path: `${auditDir}/tower-detail.png`,
    fullPage: true,
  });
});

test("local geography remains available when the external map is unreachable", async ({
  page,
}) => {
  await page.route("https://*.basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await login(page);
  await page.goto("/mapa");
  await expect(page.locator(".map-offline")).toContainText("Mapa local");
  await expect(
    page.locator(".leaflet-localGeography-pane path").first(),
  ).toBeAttached();
  await expect(
    page.locator(".map-local-label").filter({ hasText: "Añelo" }),
  ).toBeAttached();
  await expect(page.locator(".map-rig-icon").first()).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar equipo o ubicación" })
    .fill("no-existe-ese-equipo");
  await expect(
    page.getByText("No hay torres para mostrar", { exact: true }),
  ).toBeVisible();
});
