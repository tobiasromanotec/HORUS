import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const key = await deriveKey(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export async function resetAdminPassword(db, email, password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 512
  ) {
    throw new Error("La contraseña debe tener entre 12 y 512 caracteres.");
  }
  const user = db
    .prepare("SELECT id FROM users WHERE email = ? AND role = 'admin'")
    .get(email.trim().toLowerCase());
  if (!user)
    throw new Error("No se encontró una cuenta administradora con ese correo.");
  const demo =
    db.prepare("SELECT value FROM settings WHERE key = 'demo'").get()?.value ===
    "true";
  if (!demo && password === "HorusDemo2026!")
    throw new Error(
      "No uses la contraseña de demostración en una base de datos real.",
    );
  const passwordHash = await hashPassword(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      user.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
