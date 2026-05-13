import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";

const corsExtraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * AuraLib es una app móvil: las llamadas reales vienen del cliente Android (sin
 * `Origin`) y el navegador sólo se usa para herramientas locales / debug.
 *
 * Reglas:
 *  - Sin `Origin` (típico de apps móviles, curl, Postman) → permitido.
 *  - localhost/127.0.0.1 (cualquier puerto) → permitido (desarrollo en Mac).
 *  - Lo que esté en CORS_ORIGINS (separado por coma) → permitido.
 *  - Resto → bloqueado.
 */
function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (origin == null || origin === "") return true;
  if (corsExtraOrigins.includes(origin)) return true;
  if (/^http:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) return true;
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    cors: {
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        cb(null, isAllowedCorsOrigin(origin));
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"]
    }
  });

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`[AuraLib API] escuchando en http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
