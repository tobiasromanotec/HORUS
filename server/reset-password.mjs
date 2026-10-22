import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { resetAdminPassword } from "./passwords.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      "Ejecuta este comando en una terminal interactiva. No pases contraseñas como argumentos ni por tuberías.",
    );
  if (process.argv.length > 2)
    throw new Error(
      "Este comando no acepta argumentos. Introduce el correo y la contraseña en los campos interactivos.",
    );
  const databasePath = path.join(
    process.env.DATA_DIR || path.join(root, ".local"),
    "horus.sqlite",
  );
  if (!existsSync(databasePath))
    throw new Error(
      "No se encontró la base de datos. Verifica DATA_DIR e inicializa la aplicación primero.",
    );
  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk);
      callback();
    },
  });
  const reader = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  let interrupted = false;
  const ask = (prompt, hide = false) =>
    new Promise((resolve, reject) => {
      const closed = () =>
        reject(
          new Error(
            interrupted
              ? "Operación cancelada."
              : "La terminal se cerró antes de completar la operación.",
          ),
        );
      reader.once("close", closed);
      reader.question(prompt, (answer) => {
        reader.removeListener("close", closed);
        if (hide) process.stdout.write("\n");
        hidden = false;
        resolve(answer);
      });
      hidden = hide;
    });
  reader.on("SIGINT", () => {
    interrupted = true;
    hidden = false;
    process.stdout.write("\n");
    reader.close();
  });
  let db;
  try {
    const email = await ask("Correo del administrador: ");
    const password = await ask(
      "Nueva contraseña (mínimo 12 caracteres; entrada oculta): ",
      true,
    );
    const confirmation = await ask(
      "Repite la contraseña (entrada oculta): ",
      true,
    );
    if (password !== confirmation)
      throw new Error(
        "Las contraseñas no coinciden. No se realizó ningún cambio.",
      );
    db = new DatabaseSync(databasePath);
    db.exec("PRAGMA busy_timeout = 5000");
    await resetAdminPassword(db, email, password);
    process.stdout.write(
      "Contraseña actualizada. Se cerraron todas las sesiones de esta cuenta.\n",
    );
  } finally {
    hidden = false;
    reader.close();
    db?.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
