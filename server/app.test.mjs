import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createApp } from "./app.mjs";
import { resetAdminPassword } from "./passwords.mjs";

async function fixture(t, options = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "horus-test-"));
  const instance = await createApp({
    dataDir,
    demo: true,
    secureCookies: false,
    ...options,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const request = (route, { cookie, body, ...options } = {}) =>
    fetch(`${base}/api${route}`, {
      ...options,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const login = async () => {
    const response = await request("/auth/login", {
      method: "POST",
      body: { email: "admin@horus.local", password: "HorusDemo2026!" },
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  return { ...instance, request, login, dataDir, base };
}

test("drone inspection is isolated by tower, persisted on disk and removable without touching operational data", async (t) => {
  const { request, login, dataDir } = await fixture(t);
  const cookie = await login();
  const read = async (id) => (await (await request(`/towers/${id}`, { cookie })).json()).tower;
  const before = await read("rig-101");
  const other = await read("rig-204");
  const route = "/towers/rig-101/drone-inspection";
  const response = await request(route, {
    method: "PATCH", cookie,
    body: { url: "https://youtube.com/live/M7lc1UVf-VE?si=tracking" },
  });
  assert.equal(response.status, 200);
  const { tower } = await response.json();
  assert.equal(tower.droneInspection.videoId, "M7lc1UVf-VE");
  assert.equal(tower.droneInspection.url, "https://www.youtube.com/watch?v=M7lc1UVf-VE");
  assert.ok(Number.isFinite(Date.parse(tower.droneInspection.updatedAt)));
  const { droneInspection, ...unchanged } = tower;
  assert.deepEqual(unchanged, before);
  assert.deepEqual(await read("rig-204"), other);
  assert.deepEqual((await read("rig-101")).droneInspection, droneInspection);

  // Reopen the same database in another app instance, with its own connection.
  const reopened = await createApp({ dataDir, demo: true, secureCookies: false });
  try {
    const saved = JSON.parse(reopened.db.prepare("SELECT data FROM towers WHERE id = ?").get("rig-101").data);
    assert.deepEqual(saved.droneInspection, droneInspection);
  } finally {
    reopened.close();
  }
  const replaced = await request(route, {
    method: "PATCH", cookie, body: { url: "https://youtu.be/abcdefghijk" },
  });
  assert.equal((await replaced.json()).tower.droneInspection.videoId, "abcdefghijk");
  const removed = await request(route, { method: "PATCH", cookie, body: { url: "" } });
  assert.equal(removed.status, 200);
  assert.deepEqual((await removed.json()).tower, { ...before, droneInspection: null });
});

test("drone configuration requires an administrator and validates requests without overwriting data", async (t) => {
  const { request, login, db } = await fixture(t);
  const route = "/towers/rig-101/drone-inspection";
  const body = { url: "https://youtu.be/M7lc1UVf-VE" };
  assert.equal((await request(route, { method: "PATCH", body })).status, 401);
  const cookie = await login();
  const before = db.prepare("SELECT data FROM towers WHERE id='rig-101'").get().data;
  for (const invalid of [{}, { url: null }, { url: 123 }, { url: "https://example.com/video" }, { ...body, videoId: "override" }])
    assert.equal((await request(route, { method: "PATCH", cookie, body: invalid })).status, 400);
  assert.equal((await request(route, {
    method: "PATCH", cookie, body, headers: { origin: "https://untrusted.example" },
  })).status, 403);
  assert.equal((await request("/towers/missing/drone-inspection", { method: "PATCH", cookie, body })).status, 404);
  db.prepare("UPDATE users SET role='viewer'").run();
  assert.equal((await request(route, { method: "PATCH", cookie, body })).status, 403);
  assert.equal((await request(route, { method: "PATCH", cookie, body: { url: "" } })).status, 403);
  assert.equal((await request("/towers/rig-101", { cookie })).status, 200);
  assert.equal(db.prepare("SELECT data FROM towers WHERE id='rig-101'").get().data, before);
});

test("production CSP permits only the privacy-enhanced YouTube frame and keeps existing protections", async (t) => {
  const { request } = await fixture(t, { production: true });
  const response = await request("/health");
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /(?:^|; )frame-src https:\/\/www\.youtube-nocookie\.com;/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self';/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("health is public, but tower and anomaly data require authentication", async (t) => {
  const { request } = await fixture(t);
  assert.deepEqual(await (await request("/health")).json(), {
    status: "ok",
    demo: true,
  });
  for (const route of ["/towers", "/towers/rig-101", "/anomalies", "/auth/me"])
    assert.equal((await request(route)).status, 401);
});

test("login verifies password and uses opaque HttpOnly SameSite session cookies", async (t) => {
  const { request, db } = await fixture(t);
  const wrong = await request("/auth/login", {
    method: "POST",
    body: { email: "admin@horus.local", password: "wrong" },
  });
  assert.equal(wrong.status, 401);
  const result = await request("/auth/login", {
    method: "POST",
    body: { email: "ADMIN@HORUS.LOCAL", password: "HorusDemo2026!" },
  });
  assert.equal(result.status, 200);
  const header = result.headers.get("set-cookie");
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  const body = await result.json();
  assert.equal(body.user.role, "admin");
  assert.equal("password_hash" in body.user, false);
  const stored = db
    .prepare("SELECT password_hash FROM users")
    .get().password_hash;
  assert.notEqual(stored, "HorusDemo2026!");
  assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  const token = header.split(";")[0].split("=")[1];
  assert.notEqual(
    db.prepare("SELECT token_hash FROM sessions").get().token_hash,
    token,
  );
  assert.equal(
    (await request("/auth/me", { cookie: header.split(";")[0] })).status,
    200,
  );
});

test("logout and expiry invalidate server sessions", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  assert.equal(
    (await request("/auth/logout", { method: "POST", cookie })).status,
    200,
  );
  assert.equal((await request("/towers", { cookie })).status, 401);
  const expired = await login();
  db.prepare("UPDATE sessions SET expires_at = 0").run();
  assert.equal((await request("/auth/me", { cookie: expired })).status, 401);
});

test("rate limiting blocks repeated incorrect login attempts", async (t) => {
  const { request } = await fixture(t, { loginLimit: 2 });
  const options = {
    method: "POST",
    body: { email: "admin@horus.local", password: "incorrecta" },
  };
  assert.equal((await request("/auth/login", options)).status, 401);
  assert.equal((await request("/auth/login", options)).status, 401);
  const limited = await request("/auth/login", options);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("cross-origin mutations are rejected before login and data updates", async (t) => {
  const { request, login } = await fixture(t);
  const hostileHeaders = { origin: "https://untrusted.example" };
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        headers: hostileHeaders,
        body: { email: "admin@horus.local", password: "HorusDemo2026!" },
      })
    ).status,
    403,
  );
  const cookie = await login();
  assert.equal(
    (
      await request("/anomalies/anm-1001", {
        method: "PATCH",
        cookie,
        headers: hostileHeaders,
        body: { status: "resuelta" },
      })
    ).status,
    403,
  );
});

test("catalog contains six demo oilfield towers with coherent details and anomaly filters", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const { towers } = await (await request("/towers", { cookie })).json();
  assert.equal(towers.length, 6);
  assert.deepEqual(
    new Set(towers.map((tower) => tower.type)),
    new Set(["RIG", "WORKOVER", "PULLING"]),
  );
  for (const tower of towers) {
    assert.equal(tower.demo, true);
    assert.equal(tower.cameras.length, 3);
    assert.equal(tower.parameters.length, 4);
    assert.equal(
      (await (await request(`/towers/${tower.id}`, { cookie })).json()).tower
        .name,
      tower.name,
    );
  }
  const { anomalies } = await (
    await request("/anomalies?towerId=rig-204", { cookie })
  ).json();
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].towerId, "rig-204");
  assert.equal((await request("/towers/missing", { cookie })).status, 404);
  assert.equal(
    (await request("/anomalies?towerId=missing", { cookie })).status,
    404,
  );
});

test("creating a real tower persists it without invented telemetry or connected cameras", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  const body = {
    name: "RIG-777",
    type: "RIG",
    location: "Añelo",
    operator: "Operadora",
    well: "AN-777",
    lat: -38.2,
    lng: -68.7,
  };
  const response = await request("/towers", { method: "POST", cookie, body });
  assert.equal(response.status, 201);
  const { tower } = await response.json();
  assert.equal(tower.demo, false);
  assert.equal(tower.status, "desconectado");
  assert.deepEqual(tower.parameters, []);
  assert.ok(
    tower.cameras.every(
      (camera) => camera.status === "offline" && camera.url === "",
    ),
  );
  assert.equal(
    JSON.parse(
      db.prepare("SELECT data FROM towers WHERE id=?").get(tower.id).data,
    ).well,
    "AN-777",
  );
  assert.equal(
    (await request("/towers", { method: "POST", cookie, body })).status,
    409,
  );
});

test("tower creation validates coordinates, required fields, types and unknown fields", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const valid = {
    name: "RIG-777",
    type: "RIG",
    location: "Añelo",
    operator: "Operadora",
    well: "AN-777",
    lat: -38.2,
    lng: -68.7,
  };
  for (const body of [
    { ...valid, lat: 91 },
    { ...valid, lng: -181 },
    { ...valid, name: "" },
    { ...valid, type: "DRONE" },
    { ...valid, demo: true },
    { ...valid, lat: "38" },
  ]) {
    assert.equal(
      (await request("/towers", { method: "POST", cookie, body })).status,
      400,
    );
  }
});

test("anomaly status updates persist and reject invalid status or unknown records", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  const response = await request("/anomalies/anm-1001", {
    method: "PATCH",
    cookie,
    body: { status: "resuelta" },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).anomaly.status, "resuelta");
  assert.equal(
    JSON.parse(
      db.prepare("SELECT data FROM anomalies WHERE id=?").get("anm-1001").data,
    ).status,
    "resuelta",
  );
  assert.equal(
    (
      await request("/anomalies/anm-1001", {
        method: "PATCH",
        cookie,
        body: { status: "invalid" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/anomalies/missing", {
        method: "PATCH",
        cookie,
        body: { status: "resuelta" },
      })
    ).status,
    404,
  );
});

test("camera configuration supports HTTPS HLS and rejects unsafe or credential-bearing sources", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const route = "/towers/rig-101/cameras/rig-101-cam-1";
  const response = await request(route, {
    method: "PATCH",
    cookie,
    body: {
      kind: "hls",
      url: "https://cameras.example/live.m3u8",
      status: "online",
      name: "Cámara principal",
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).camera.kind, "hls");
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/live.m3u8",
    "https://user:password@example.com/live.m3u8",
    "file:///etc/passwd",
  ]) {
    assert.equal(
      (
        await request(route, {
          method: "PATCH",
          cookie,
          body: { kind: "hls", url },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request(route, {
        method: "PATCH",
        cookie,
        body: { kind: "demo", url: "/assets/rig-1.jpg" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/towers/rig-101/cameras/missing", {
        method: "PATCH",
        cookie,
        body: { name: "test" },
      })
    ).status,
    404,
  );
});

test("viewer role may read but cannot create towers or update anomalies", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  db.prepare("UPDATE users SET role='viewer'").run();
  assert.equal((await request("/towers", { cookie })).status, 200);
  assert.equal(
    (await request("/towers", { method: "POST", cookie, body: {} })).status,
    403,
  );
  assert.equal(
    (
      await request("/anomalies/anm-1001", {
        method: "PATCH",
        cookie,
        body: { status: "resuelta" },
      })
    ).status,
    403,
  );
});

test("malformed JSON and invalid content type fail cleanly; API responses are not cacheable", async (t) => {
  const { request, base } = await fixture(t);
  const malformed = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad",
  });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON/);
  const form = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=a&password=b",
  });
  assert.equal(form.status, 415);
  assert.equal(
    (await request("/health")).headers.get("cache-control"),
    "no-store",
  );
});

test("data and sessions survive application restart", async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "horus-persist-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const first = await createApp({ dataDir, demo: true });
  first.db
    .prepare(
      "UPDATE anomalies SET data=json_set(data, '$.status', 'resuelta') WHERE id='anm-1001'",
    )
    .run();
  first.db
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    )
    .run(
      "stored-hash",
      first.db.prepare("SELECT id FROM users").get().id,
      Date.now() + 100000,
    );
  first.close();
  const second = await createApp({ dataDir, demo: true });
  assert.equal(
    JSON.parse(
      second.db.prepare("SELECT data FROM anomalies WHERE id='anm-1001'").get()
        .data,
    ).status,
    "resuelta",
  );
  assert.equal(
    second.db.prepare("SELECT count(*) AS total FROM towers").get().total,
    6,
  );
  assert.equal(
    second.db.prepare("SELECT count(*) AS total FROM sessions").get().total,
    1,
  );
  second.close();
});

test("production rejects implicit demo credentials and isolates demonstration databases", async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "horus-production-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  await assert.rejects(
    () =>
      createApp({
        dataDir,
        production: true,
        demo: false,
        adminEmail: "",
        adminPassword: "",
      }),
    /ADMIN_EMAIL/,
  );
  await assert.rejects(
    () =>
      createApp({
        dataDir,
        production: true,
        demo: false,
        adminEmail: "admin@example.com",
        adminPassword: "HorusDemo2026!",
      }),
    /demostración/,
  );
  const demo = await createApp({ dataDir, production: true, demo: true });
  demo.close();
  await assert.rejects(
    () =>
      createApp({
        dataDir,
        production: true,
        demo: false,
        adminEmail: "admin@example.com",
        adminPassword: "a-unique-admin-password",
      }),
    /otro modo/,
  );
});

test("telemetry ingestion persists actual samples atomically without changing cameras or demo identity", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  const parameters = [
    {
      key: "hook_load",
      label: "Carga de gancho",
      value: 78,
      unit: "t",
      min: 0,
      max: 120,
      history: [70, 74, 78],
    },
  ];
  const before = (await (await request("/towers/rig-101", { cookie })).json())
    .tower;
  const response = await request("/towers/rig-101/telemetry", {
    method: "PATCH",
    cookie,
    body: { parameters, status: "atencion" },
  });
  assert.equal(response.status, 200);
  const { tower } = await response.json();
  assert.deepEqual(tower.parameters, parameters);
  assert.deepEqual(tower.cameras, before.cameras);
  assert.equal(tower.demo, before.demo);
  assert.equal(tower.status, "atencion");
  assert.ok(Date.parse(tower.updatedAt) >= Date.parse(before.updatedAt));
  const saved = db
    .prepare("SELECT data FROM towers WHERE id=?")
    .get(tower.id).data;
  for (const body of [
    { parameters: [] },
    { parameters: Array(13).fill(parameters[0]) },
    { parameters: [parameters[0], parameters[0]] },
    { parameters: [{ ...parameters[0], value: null }] },
    { parameters: [{ ...parameters[0], min: 120 }] },
    { parameters: [{ ...parameters[0], history: Array(61).fill(1) }] },
    { parameters, status: "inventado" },
    { parameters, demo: false },
  ])
    assert.equal(
      (
        await request("/towers/rig-101/telemetry", {
          method: "PATCH",
          cookie,
          body,
        })
      ).status,
      400,
    );
  assert.equal(
    db.prepare("SELECT data FROM towers WHERE id=?").get(tower.id).data,
    saved,
  );
  assert.equal(
    (
      await request("/towers/missing/telemetry", {
        method: "PATCH",
        cookie,
        body: { parameters },
      })
    ).status,
    404,
  );
  db.prepare("UPDATE users SET role='viewer'").run();
  assert.equal(
    (
      await request("/towers/rig-101/telemetry", {
        method: "PATCH",
        cookie,
        body: { parameters },
      })
    ).status,
    403,
  );
});

test("new anomaly records validate source, dates and ownership and persist evidence metadata", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  const body = {
    title: "Presión de bomba elevada",
    description: "Revisar el circuito de bombeo.",
    severity: "critica",
    camera: "rig-101-cam-1",
    image: "https://cameras.example/evidence.jpg",
    timestamp: "2026-01-15T14:30:00.000Z",
  };
  assert.equal(
    (await request("/towers/rig-101/anomalies", { method: "POST", body }))
      .status,
    401,
  );
  const response = await request("/towers/rig-101/anomalies", {
    method: "POST",
    cookie,
    body,
  });
  assert.equal(response.status, 201);
  const { anomaly } = await response.json();
  assert.equal(anomaly.towerId, "rig-101");
  assert.equal(anomaly.status, "pendiente");
  assert.equal(anomaly.image, body.image);
  assert.equal(anomaly.timestamp, body.timestamp);
  assert.ok(db.prepare("SELECT id FROM anomalies WHERE id=?").get(anomaly.id));
  for (const invalid of [
    { ...body, camera: "wo-302-cam-1" },
    { ...body, severity: "emergency" },
    { ...body, title: "" },
    { ...body, timestamp: "2026-02-31T14:30:00Z" },
    { ...body, timestamp: "2050-01-01T00:00:00Z" },
    { ...body, timestamp: "no-date" },
    { ...body, image: "https://user:password@cameras.example/photo.jpg" },
    { ...body, image: "javascript:alert(1)" },
    { ...body, image: "/assets/../../secret.jpg" },
    { ...body, status: "resuelta" },
  ])
    assert.equal(
      (
        await request("/towers/rig-101/anomalies", {
          method: "POST",
          cookie,
          body: invalid,
        })
      ).status,
      400,
    );
  db.prepare("UPDATE users SET role='viewer'").run();
  assert.equal(
    (
      await request("/towers/rig-101/anomalies", {
        method: "POST",
        cookie,
        body,
      })
    ).status,
    403,
  );
});

test("password recovery revokes sessions, rejects the prior password and preserves the account", async (t) => {
  const { request, login, db } = await fixture(t);
  const cookie = await login();
  await resetAdminPassword(
    db,
    "ADMIN@HORUS.LOCAL",
    "replacement-test-password",
  );
  assert.equal((await request("/auth/me", { cookie })).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "admin@horus.local", password: "HorusDemo2026!" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: {
          email: "admin@horus.local",
          password: "replacement-test-password",
        },
      })
    ).status,
    200,
  );
  await assert.rejects(
    () => resetAdminPassword(db, "admin@horus.local", "short"),
    /12 y 512/,
  );
  await assert.rejects(
    () => resetAdminPassword(db, "missing@example.com", "long-enough-password"),
    /administradora/,
  );
});

test("offline cameras allow an empty source but reject non-string URLs", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const route = "/towers/rig-101/cameras/rig-101-cam-1";
  for (const url of [null, 0, false, {}])
    assert.equal(
      (
        await request(route, {
          method: "PATCH",
          cookie,
          body: { status: "offline", url },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await request(route, {
        method: "PATCH",
        cookie,
        body: { status: "offline", kind: "image", url: "" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(route, {
        method: "PATCH",
        cookie,
        body: { status: "online" },
      })
    ).status,
    400,
  );
});
