/**
 * Last.fm API 2.0 (solo lectura) para contrastar discografías con Qobuz.
 * Clave global: LASTFM_API_KEY, o la que guarde el usuario en ajustes.
 */

import crypto from "node:crypto";

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

const titleCache = new Map<string, { expiresAt: number; titles: string[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const NEGATIVE_CACHE_MS = 2 * 60 * 1000;

export function resolveLastfmApiKey(): string | null {
  const k = process.env.LASTFM_API_KEY?.trim();
  return k && k.length >= 8 ? k : null;
}

function cacheKeyFor(apiKey: string, artistNorm: string): string {
  const fp = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 10);
  return `${fp}::${artistNorm}`;
}

export function clearLastfmTitleCache(): void {
  titleCache.clear();
}

/**
 * Títulos de álbumes más populares del artista en Last.fm.
 * @param apiKeyOverride si se pasa, se usa en lugar de la variable de entorno
 */
export async function fetchLastfmTopAlbumTitles(
  artistQuery: string,
  limit = 100,
  apiKeyOverride?: string | null
): Promise<string[]> {
  const apiKey = (apiKeyOverride ?? "").trim() || resolveLastfmApiKey();
  const name = artistQuery.trim();
  if (!apiKey || !name || apiKey.length < 8) return [];

  const cacheKey = cacheKeyFor(apiKey, name.toLowerCase());
  const hit = titleCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.titles;

  const safeLimit = Math.min(150, Math.max(10, Math.round(limit || 100)));
  const params = new URLSearchParams({
    method: "artist.gettopalbums",
    artist: name,
    api_key: apiKey,
    format: "json",
    limit: String(safeLimit),
    autocorrect: "1"
  });

  try {
    const res = await fetch(`${LASTFM_BASE}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000)
    });
    if (!res.ok) {
      titleCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_CACHE_MS, titles: [] });
      return [];
    }
    const json = (await res.json()) as Record<string, unknown>;
    if (json.error != null && json.error !== 0) {
      titleCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_CACHE_MS, titles: [] });
      return [];
    }
    const topalbums = json.topalbums as Record<string, unknown> | undefined;
    const albumRoot = topalbums?.album;
    const rawAlbums = Array.isArray(albumRoot) ? albumRoot : albumRoot && typeof albumRoot === "object" ? [albumRoot] : [];
    const titles: string[] = [];
    for (const a of rawAlbums) {
      if (!a || typeof a !== "object") continue;
      const n = String((a as Record<string, unknown>).name ?? "").trim();
      if (n) titles.push(n);
    }
    titleCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, titles });
    return titles;
  } catch {
    titleCache.set(cacheKey, { expiresAt: Date.now() + NEGATIVE_CACHE_MS, titles: [] });
    return [];
  }
}
