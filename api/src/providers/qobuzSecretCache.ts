import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Cache simple en disco para el `appSecret` real de production de Qobuz.
 *
 * Este secret se reconstruye en runtime dentro del player web mediante
 * `window.rng.prototype.initialization()` y NO está en texto plano en
 * `bundle.js`. Lo extraemos puntualmente con Puppeteer (ver
 * `qobuzSecretExtractorService`) y lo persistimos aquí para reutilizarlo
 * en cada llamada a `track/getFileUrl` sin tener que abrir un navegador
 * por cada play.
 *
 * El TTL por defecto es 12h: Qobuz no rota el seed en cada release pero sí
 * cada cierto tiempo; con 12h cubrimos sesiones largas y, si caduca a media
 * sesión, la próxima petición fallará con HTTP 400 y el frontend pedirá
 * refresh con credenciales.
 */
export type QobuzSecretCacheEntry = {
  secret: string;
  capturedAt: string;
  ttlHours: number;
  /** Origen para diagnóstico ("puppeteer", "manual", "test"). */
  source: string;
};

const STORE_DIR = path.resolve(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "qobuz-secrets.json");

const DEFAULT_TTL_HOURS = 12;

let memoryCache: QobuzSecretCacheEntry | null = null;

function isExpired(entry: QobuzSecretCacheEntry): boolean {
  const capturedMs = new Date(entry.capturedAt).getTime();
  if (!Number.isFinite(capturedMs)) return true;
  const ageMs = Date.now() - capturedMs;
  return ageMs > entry.ttlHours * 3600 * 1000;
}

/**
 * Devuelve el secret cacheado si existe y no ha expirado, sino `null`.
 * Lee primero memoria (rapidísimo), después disco.
 */
export async function readCachedQobuzSecret(): Promise<QobuzSecretCacheEntry | null> {
  if (memoryCache && !isExpired(memoryCache)) return memoryCache;

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as QobuzSecretCacheEntry;
    if (!parsed || typeof parsed.secret !== "string" || !parsed.secret) return null;
    if (isExpired(parsed)) return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/** Persiste un secret nuevo (memoria + disco) y devuelve el entry guardado. */
export async function writeQobuzSecret(
  secret: string,
  source: string = "puppeteer",
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<QobuzSecretCacheEntry> {
  const clean = secret.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) {
    throw new Error(`Secret Qobuz inválido (esperado 32 hex chars, recibido "${secret.slice(0, 16)}...").`);
  }
  const entry: QobuzSecretCacheEntry = {
    secret: clean,
    capturedAt: new Date().toISOString(),
    ttlHours,
    source
  };
  memoryCache = entry;
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(entry, null, 2), "utf8");
  return entry;
}

/** Borra cache memoria + disco; útil para tests o tras detectar 401/400 reiterados. */
export async function clearQobuzSecret(): Promise<void> {
  memoryCache = null;
  try {
    await writeFile(STORE_FILE, JSON.stringify({}, null, 2), "utf8");
  } catch {
    /* ignored */
  }
}
