/**
 * MusicBrainz API (solo lectura) para contrastar títulos de discografía con Qobuz.
 * Requiere User-Agent con contacto (https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting).
 */

import crypto from "node:crypto";

const MB_BASE = "https://musicbrainz.org/ws/2";

const rgCache = new Map<string, { expiresAt: number; titles: string[] }>();
const CACHE_TTL_MS = 20 * 60 * 1000;
const NEGATIVE_MS = 3 * 60 * 1000;

function mbUserAgent(): string {
  const contact = process.env.MUSICBRAINZ_CONTACT_URL?.trim() || "https://github.com/dactodock";
  return `DacToDockWeb/1.0 (${contact})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Títulos de release groups del primer artista que coincida en búsqueda.
 */
export async function fetchMusicBrainzReleaseGroupTitles(artistQuery: string, limit = 80): Promise<string[]> {
  const name = artistQuery.trim();
  if (!name) return [];

  const cacheKey = crypto.createHash("sha256").update(name.toLowerCase()).digest("hex").slice(0, 16);
  const hit = rgCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.titles;

  const headers = {
    Accept: "application/json",
    "User-Agent": mbUserAgent()
  };

  try {
    const q = encodeURIComponent(name);
    const searchUrl = `${MB_BASE}/artist?query=${q}&fmt=json&limit=5`;
    const res1 = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(14_000) });
    if (!res1.ok) {
      rgCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_MS, titles: [] });
      return [];
    }
    const j1 = (await res1.json()) as Record<string, unknown>;
    const items = Array.isArray(j1.artists) ? (j1.artists as unknown[]) : [];
    let best: Record<string, unknown> | undefined;
    let bestScore = -1;
    for (const x of items) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const sc =
        typeof o.score === "number" && Number.isFinite(o.score)
          ? (o.score as number)
          : typeof o.score === "string"
            ? Number.parseInt(o.score, 10) || 0
            : 0;
      if (sc > bestScore) {
        bestScore = sc;
        best = o;
      }
    }
    const first = best ?? (items[0] && typeof items[0] === "object" ? (items[0] as Record<string, unknown>) : undefined);
    const mbid =
      typeof first?.id === "string"
        ? first.id.trim()
        : typeof first?.id === "number" && Number.isFinite(first.id)
          ? String(Math.trunc(first.id as number))
          : "";
    if (!mbid) {
      rgCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_MS, titles: [] });
      return [];
    }

    await sleep(1100);

    const safeLimit = Math.min(100, Math.max(10, Math.round(limit)));
    const rgUrl = `${MB_BASE}/release-group?artist=${encodeURIComponent(mbid)}&fmt=json&limit=${safeLimit}&offset=0`;
    const res2 = await fetch(rgUrl, { headers, signal: AbortSignal.timeout(18_000) });
    if (!res2.ok) {
      rgCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_MS, titles: [] });
      return [];
    }
    const j2 = (await res2.json()) as Record<string, unknown>;
    const rgs = Array.isArray(j2["release-groups"])
      ? (j2["release-groups"] as unknown[])
      : [];
    const titles: string[] = [];
    const seen = new Set<string>();
    for (const rg of rgs) {
      if (!rg || typeof rg !== "object") continue;
      const t = String((rg as Record<string, unknown>).title ?? "").trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      titles.push(t);
    }
    rgCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, titles });
    return titles;
  } catch {
    rgCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_MS, titles: [] });
    return [];
  }
}

export function clearMusicBrainzReleaseGroupCache(): void {
  rgCache.clear();
}
