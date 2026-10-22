import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedDemo } from "./seed.mjs";
import { hashPassword, verifyPassword } from "./passwords.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SESSION_NAME = "horus_session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const DEMO_EMAIL = "admin@horus.local";
const DEMO_PASSWORD = "HorusDemo2026!";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status, message) => Object.assign(new Error(message), { status });

function textField(value, label, max = 100) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\u0000-\u001f]/.test(value)
  ) {
    throw fail(
      400,
      `${label} es obligatorio y debe tener hasta ${max} caracteres.`,
    );
  }
  return value.trim();
}

function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw fail(400, "El cuerpo debe ser un objeto JSON.");
  return value;
}

function allowedKeys(body, keys) {
  if (Object.keys(body).some((key) => !keys.includes(key)))
    throw fail(400, "La solicitud contiene campos no permitidos.");
}

function cameraUrl(value, kind) {
  if (typeof value !== "string" || value.length > 2048)
    throw fail(400, "La dirección de cámara no es válida.");
  if (kind === "demo") {
    if (!/^\/assets\/[\w.-]+\.(?:jpg|jpeg|png|webp|svg)$/.test(value))
      throw fail(400, "Una cámara de demostración debe usar una imagen local.");
    return value;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail(400, "Usa una dirección HTTPS válida para la cámara.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw fail(400, "Usa HTTPS sin credenciales en la dirección de cámara.");
  return url.href;
}

function validateParameters(parameters) {
  if (
    !Array.isArray(parameters) ||
    parameters.length < 1 ||
    parameters.length > 12
  )
    throw fail(400, "Envía entre 1 y 12 parámetros.");
  const keys = new Set();
  return parameters.map((value) => {
    const parameter = record(value);
    allowedKeys(parameter, [
      "key",
      "label",
      "value",
      "unit",
      "min",
      "max",
      "history",
    ]);
    if (
      typeof parameter.key !== "string" ||
      !/^[a-z][a-z0-9_-]{0,39}$/.test(parameter.key) ||
      keys.has(parameter.key)
    )
      throw fail(
        400,
        "Las claves de parámetro deben ser únicas y contener letras minúsculas, números, guiones o guiones bajos.",
      );
    keys.add(parameter.key);
    const label = textField(parameter.label, "La etiqueta del parámetro", 80);
    if (
      typeof parameter.unit !== "string" ||
      parameter.unit.length > 20 ||
      /[\u0000-\u001f]/.test(parameter.unit)
    )
      throw fail(400, "La unidad debe tener hasta 20 caracteres.");
    for (const field of ["value", "min", "max"])
      if (
        typeof parameter[field] !== "number" ||
        !Number.isFinite(parameter[field])
      )
        throw fail(400, "Los valores y límites deben ser números finitos.");
    if (
      parameter.min >= parameter.max ||
      !Number.isFinite(parameter.max - parameter.min)
    )
      throw fail(
        400,
        "El mínimo debe ser menor que el máximo y el rango debe ser finito.",
      );
    if (
      !Array.isArray(parameter.history) ||
      parameter.history.length < 1 ||
      parameter.history.length > 60 ||
      parameter.history.some(
        (sample) => typeof sample !== "number" || !Number.isFinite(sample),
      )
    )
      throw fail(
        400,
        "El historial debe contener entre 1 y 60 números finitos.",
      );
    return {
      key: parameter.key,
      label,
      value: parameter.value,
      unit: parameter.unit.trim(),
      min: parameter.min,
      max: parameter.max,
      history: parameter.history,
    };
  });
}

export async function createApp(options = {}) {
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const demo =
    options.demo ??
    (process.env.DEMO_MODE ? process.env.DEMO_MODE === "true" : !production);
  const adminEmail = (
    options.adminEmail ??
    process.env.ADMIN_EMAIL ??
    (demo ? DEMO_EMAIL : "")
  )
    .trim()
    .toLowerCase();
  const adminPassword =
    options.adminPassword ??
    process.env.ADMIN_PASSWORD ??
    (demo ? DEMO_PASSWORD : "");
  const adminName =
    options.adminName ?? process.env.ADMIN_NAME ?? "Administrador HORUS";
  const secureCookies =
    options.secureCookies ??
    (process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : production);
  const publicOrigin = options.publicOrigin ?? process.env.PUBLIC_ORIGIN;
  if (
    !emailPattern.test(adminEmail) ||
    adminEmail.length > 254 ||
    adminPassword.length < 12 ||
    adminPassword.length > 512
  ) {
    throw new Error(
      "Configura ADMIN_EMAIL (hasta 254 caracteres) y ADMIN_PASSWORD (entre 12 y 512 caracteres), o activa DEMO_MODE=true para una demostración explícita.",
    );
  }
  if (
    production &&
    !demo &&
    (adminEmail === DEMO_EMAIL || adminPassword === DEMO_PASSWORD)
  ) {
    throw new Error(
      "Las credenciales de demostración no se permiten en producción sin DEMO_MODE=true.",
    );
  }
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin)
    throw new Error(
      "PUBLIC_ORIGIN debe contener solo el origen, sin ruta ni barra final.",
    );

  const dataDir =
    options.dataDir ?? process.env.DATA_DIR ?? path.join(projectRoot, ".local");
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, "horus.sqlite"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('admin','viewer')), password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS towers (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS anomalies (id TEXT PRIMARY KEY, tower_id TEXT NOT NULL REFERENCES towers(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS anomalies_tower ON anomalies(tower_id);
  `);
  const savedMode = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("demo");
  if (savedMode && savedMode.value !== String(demo)) {
    db.close();
    throw new Error(
      "Esta base de datos pertenece a otro modo. Usa un DATA_DIR distinto para separar demostración y producción.",
    );
  }
  if (!savedMode) {
    const passwordHash = await hashPassword(adminPassword);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
        "demo",
        String(demo),
      );
      db.prepare(
        "INSERT INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)",
      ).run(randomUUID(), adminName, adminEmail, "admin", passwordHash);
      if (demo) seedDemo(db);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  const dummyHash = await hashPassword(randomBytes(24).toString("hex"));
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (production)
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; media-src 'self' https: blob:; worker-src 'self' blob:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, _res, next) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const expectedOrigin =
        publicOrigin || `${req.protocol}://${req.get("host")}`;
      if (req.get("origin") && req.get("origin") !== expectedOrigin)
        return next(fail(403, "Origen de solicitud no permitido."));
      if (
        Boolean(req.headers["transfer-encoding"]) ||
        Number(req.headers["content-length"]) > 0
      ) {
        if (!req.is("application/json"))
          return next(fail(415, "Usa Content-Type: application/json."));
      }
    }
    next();
  });
  app.use(express.json({ limit: "32kb", strict: true }));

  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies,
    path: "/",
    maxAge: SESSION_MS,
  };
  const clearSessionCookie = (res) =>
    res.clearCookie(SESSION_NAME, {
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookies,
      path: "/",
    });
  const tokenFrom = (req) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${SESSION_NAME}=`))
      ?.slice(SESSION_NAME.length + 1);
    return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
  };
  const requireAuth = (req, _res, next) => {
    const token = tokenFrom(req);
    const user =
      token &&
      db
        .prepare(
          "SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
        )
        .get(sha256(token), Date.now());
    if (!user)
      return next(
        fail(401, "Tu sesión no está activa. Inicia sesión para continuar."),
      );
    req.user = publicUser(user);
    next();
  };
  const requireAdmin = (req, _res, next) =>
    req.user.role === "admin"
      ? next()
      : next(fail(403, "Se necesita una cuenta administradora."));
  const loginAttempts = new Map();
  const loginLimit = options.loginLimit ?? 10;
  const loginWindow = options.loginWindow ?? 15 * 60 * 1000;
  const cleanExpired = () => {
    const now = Date.now();
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    for (const [key, entry] of loginAttempts)
      if (entry.until <= now) loginAttempts.delete(key);
  };
  const cleanupTimer = setInterval(cleanExpired, 60_000);
  cleanupTimer.unref();
  cleanExpired();

  app.get("/api/health", (_req, res) => res.json({ status: "ok", demo }));
  app.post("/api/auth/login", async (req, res) => {
    const body = record(req.body);
    allowedKeys(body, ["email", "password"]);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (
      !emailPattern.test(email) ||
      email.length > 254 ||
      password.length < 1 ||
      password.length > 512
    )
      throw fail(400, "Introduce un correo y una contraseña válidos.");
    const key = req.ip || "unknown";
    const now = Date.now();
    let attempts = loginAttempts.get(key);
    if (!attempts || attempts.until <= now) {
      attempts = { count: 0, until: now + loginWindow };
      loginAttempts.set(key, attempts);
    }
    if (attempts.count >= loginLimit) {
      res.set("Retry-After", String(Math.ceil((attempts.until - now) / 1000)));
      throw fail(
        429,
        "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
      );
    }
    attempts.count += 1;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const valid = await verifyPassword(
      password,
      user?.password_hash || dummyHash,
    );
    if (!user || !valid)
      throw fail(401, "El correo o la contraseña son incorrectos.");
    // A password reset may finish while scrypt is running. Never issue a session for an obsolete password.
    if (
      db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id)
        ?.password_hash !== user.password_hash
    )
      throw fail(401, "La contraseña cambió. Vuelve a iniciar sesión.");
    loginAttempts.delete(key);
    const priorToken = tokenFrom(req);
    if (priorToken)
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
        sha256(priorToken),
      );
    const token = randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    ).run(sha256(token), user.id, Date.now() + SESSION_MS);
    res
      .cookie(SESSION_NAME, token, cookieOptions)
      .json({ user: publicUser(user) });
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = tokenFrom(req);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
        sha256(token),
      );
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app.use("/api", requireAuth);
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
  app.get("/api/towers", (_req, res) =>
    res.json({
      towers: db
        .prepare("SELECT data FROM towers ORDER BY rowid")
        .all()
        .map((row) => JSON.parse(row.data)),
    }),
  );
  const towerById = (id) => {
    const row = db.prepare("SELECT data FROM towers WHERE id = ?").get(id);
    if (!row) throw fail(404, "No se encontró el equipo.");
    return JSON.parse(row.data);
  };
  app.get("/api/towers/:id", (req, res) =>
    res.json({ tower: towerById(req.params.id) }),
  );
  app.patch("/api/towers/:id/telemetry", requireAdmin, (req, res) => {
    towerById(req.params.id);
    const body = record(req.body);
    allowedKeys(body, ["parameters", "status"]);
    const parameters = validateParameters(body.parameters);
    if (
      body.status !== undefined &&
      !["operativo", "atencion", "desconectado"].includes(body.status)
    )
      throw fail(400, "El estado del equipo no es válido.");
    const updatedAt = new Date().toISOString();
    // One SQL statement keeps the samples, timestamp and optional status atomic.
    // Preserve the demo marker and every unrelated field, including camera settings.
    if (body.status !== undefined) {
      db.prepare(
        "UPDATE towers SET data = json_set(data, '$.parameters', json(?), '$.updatedAt', ?, '$.status', ?) WHERE id = ?",
      ).run(JSON.stringify(parameters), updatedAt, body.status, req.params.id);
    } else {
      db.prepare(
        "UPDATE towers SET data = json_set(data, '$.parameters', json(?), '$.updatedAt', ?) WHERE id = ?",
      ).run(JSON.stringify(parameters), updatedAt, req.params.id);
    }
    res.json({ tower: towerById(req.params.id) });
  });
  app.post("/api/towers", requireAdmin, (req, res) => {
    const body = record(req.body);
    allowedKeys(body, [
      "name",
      "type",
      "location",
      "operator",
      "well",
      "lat",
      "lng",
    ]);
    const name = textField(body.name, "El nombre", 40);
    const location = textField(body.location, "La ubicación");
    const operator = textField(body.operator, "La operadora");
    const well = textField(body.well, "El pozo", 60);
    if (!["RIG", "PULLING", "WORKOVER"].includes(body.type))
      throw fail(400, "El tipo debe ser RIG, PULLING o WORKOVER.");
    if (
      typeof body.lat !== "number" ||
      !Number.isFinite(body.lat) ||
      body.lat < -90 ||
      body.lat > 90 ||
      typeof body.lng !== "number" ||
      !Number.isFinite(body.lng) ||
      body.lng < -180 ||
      body.lng > 180
    )
      throw fail(400, "Las coordenadas no son válidas.");
    const duplicate = db
      .prepare(
        "SELECT id FROM towers WHERE lower(json_extract(data, '$.name')) = lower(?)",
      )
      .get(name);
    if (duplicate) throw fail(409, "Ya existe un equipo con ese nombre.");
    const id = `tower-${randomUUID()}`;
    const tower = {
      id,
      name,
      type: body.type,
      location,
      operator,
      well,
      lat: body.lat,
      lng: body.lng,
      status: "desconectado",
      image: "/assets/rig-1.jpg",
      updatedAt: new Date().toISOString(),
      demo: false,
      cameras: ["Piso de perforación", "Vista general", "Zona de bombas"].map(
        (name, i) => ({
          id: `${id}-cam-${i + 1}`,
          name,
          kind: "image",
          url: "",
          status: "offline",
        }),
      ),
      parameters: [],
    };
    db.prepare("INSERT INTO towers (id, data) VALUES (?, ?)").run(
      id,
      JSON.stringify(tower),
    );
    res.status(201).json({ tower });
  });
  app.post("/api/towers/:id/anomalies", requireAdmin, (req, res) => {
    const tower = towerById(req.params.id);
    const body = record(req.body);
    allowedKeys(body, [
      "title",
      "description",
      "severity",
      "camera",
      "image",
      "timestamp",
    ]);
    const title = textField(body.title, "El título", 120);
    const description = textField(body.description, "La descripción", 2000);
    if (!["critica", "media", "baja"].includes(body.severity))
      throw fail(400, "La prioridad debe ser critica, media o baja.");
    const camera = tower.cameras.find(
      (camera) => camera.id === body.camera || camera.name === body.camera,
    );
    if (!camera) throw fail(400, "La cámara debe pertenecer a este equipo.");
    const localImage =
      typeof body.image === "string" && body.image.startsWith("/assets/");
    const image = cameraUrl(body.image, localImage ? "demo" : "image");
    let timestamp = new Date().toISOString();
    if (body.timestamp !== undefined) {
      if (
        typeof body.timestamp !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
          body.timestamp,
        ) ||
        !Number.isFinite(Date.parse(body.timestamp))
      )
        throw fail(400, "La fecha debe ser ISO 8601 UTC válida.");
      timestamp = new Date(body.timestamp).toISOString();
      if (timestamp.slice(0, 19) !== body.timestamp.slice(0, 19))
        throw fail(400, "La fecha contiene un día u horario inexistente.");
      if (Date.parse(timestamp) > Date.now() + 60_000)
        throw fail(400, "La fecha del hallazgo no puede estar en el futuro.");
    }
    const anomaly = {
      id: `anm-${randomUUID()}`,
      towerId: tower.id,
      title,
      description,
      severity: body.severity,
      camera: camera.name,
      image,
      timestamp,
      status: "pendiente",
    };
    db.prepare(
      "INSERT INTO anomalies (id, tower_id, data) VALUES (?, ?, ?)",
    ).run(anomaly.id, tower.id, JSON.stringify(anomaly));
    res.status(201).json({ anomaly });
  });
  app.get("/api/anomalies", (req, res) => {
    const towerId = req.query.towerId;
    if (towerId !== undefined && typeof towerId !== "string")
      throw fail(400, "El identificador de equipo no es válido.");
    if (towerId) towerById(towerId);
    const rows = towerId
      ? db
          .prepare(
            "SELECT data FROM anomalies WHERE tower_id=? ORDER BY json_extract(data, '$.timestamp') DESC",
          )
          .all(towerId)
      : db
          .prepare(
            "SELECT data FROM anomalies ORDER BY json_extract(data, '$.timestamp') DESC",
          )
          .all();
    res.json({ anomalies: rows.map((row) => JSON.parse(row.data)) });
  });
  app.patch("/api/anomalies/:id", requireAdmin, (req, res) => {
    const body = record(req.body);
    allowedKeys(body, ["status"]);
    if (!["pendiente", "revisada", "resuelta"].includes(body.status))
      throw fail(400, "El estado de anomalía no es válido.");
    const row = db
      .prepare("SELECT data FROM anomalies WHERE id=?")
      .get(req.params.id);
    if (!row) throw fail(404, "No se encontró la anomalía.");
    const anomaly = { ...JSON.parse(row.data), status: body.status };
    db.prepare("UPDATE anomalies SET data=? WHERE id=?").run(
      JSON.stringify(anomaly),
      anomaly.id,
    );
    res.json({ anomaly });
  });
  app.patch("/api/towers/:id/cameras/:cameraId", requireAdmin, (req, res) => {
    const tower = towerById(req.params.id);
    const index = tower.cameras.findIndex(
      (camera) => camera.id === req.params.cameraId,
    );
    if (index < 0) throw fail(404, "No se encontró la cámara.");
    const body = record(req.body);
    allowedKeys(body, ["name", "kind", "url", "status"]);
    if (!Object.keys(body).length) throw fail(400, "No se recibieron cambios.");
    const current = tower.cameras[index];
    const camera = { ...current };
    if (body.name !== undefined)
      camera.name = textField(body.name, "El nombre de cámara", 80);
    if (body.kind !== undefined) {
      if (!["demo", "image", "hls"].includes(body.kind))
        throw fail(400, "El tipo de cámara no es válido.");
      camera.kind = body.kind;
    }
    if (body.status !== undefined) {
      if (!["online", "offline"].includes(body.status))
        throw fail(400, "El estado de cámara no es válido.");
      camera.status = body.status;
    }
    if (body.url !== undefined) {
      if (typeof body.url !== "string")
        throw fail(400, "La dirección de cámara debe ser texto.");
      camera.url = body.url.trim();
    }
    if (camera.url || camera.status === "online")
      camera.url = cameraUrl(camera.url, camera.kind);
    tower.cameras[index] = camera;
    tower.updatedAt = new Date().toISOString();
    db.prepare("UPDATE towers SET data=? WHERE id=?").run(
      JSON.stringify(tower),
      tower.id,
    );
    res.json({ camera });
  });
  app.use("/api", (_req, _res, next) =>
    next(fail(404, "No se encontró este recurso.")),
  );
  const dist = options.distDir ?? path.join(projectRoot, "dist");
  if (existsSync(path.join(dist, "index.html"))) {
    app.use(
      express.static(dist, { index: false, maxAge: production ? "1h" : 0 }),
    );
    app.get("/{*path}", (req, res) => {
      if (path.extname(req.path))
        return res.status(404).send("Archivo no encontrado.");
      res
        .set("Cache-Control", "no-cache")
        .sendFile(path.join(dist, "index.html"));
    });
  }
  app.use((error, _req, res, _next) => {
    const status =
      error.type === "entity.too.large"
        ? 413
        : error instanceof SyntaxError && "body" in error
          ? 400
          : error.status || 500;
    if (status >= 500) console.error("Error interno de HORUS:", error.message);
    res
      .status(status)
      .json({
        error:
          status >= 500
            ? "No se pudo completar la operación. Inténtalo nuevamente."
            : status === 413
              ? "La solicitud es demasiado grande."
              : error instanceof SyntaxError
                ? "El JSON de la solicitud no es válido."
                : error.message,
      });
  });
  return {
    app,
    db,
    close: () => {
      clearInterval(cleanupTimer);
      db.close();
    },
    demo,
  };
}
