import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT debe ser un puerto válido.");
const { app, close, demo } = await createApp();
const server = app.listen(port, "0.0.0.0", () => {
  console.log(
    `HORUS API disponible en el puerto ${port}. Modo: ${demo ? "demostración" : "producción"}.`,
  );
});
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(() => {
    close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
server.on("error", (error) => {
  close();
  console.error(error.message);
  process.exit(1);
});
