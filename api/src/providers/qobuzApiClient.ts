import { createHash } from "node:crypto";

import { QobuzLoginRejectedError } from "./qobuzLoginError.js";
import { readCachedQobuzSecret } from "./qobuzSecretCache.js";

const DEFAULT_APP_ID = "798273057";
export const QOBUZ_API_BASE_URL = "https://www.qobuz.com/api.json/0.2";

const QOBUZ_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type QobuzEnv = {
  appId: string;
};

export function resolveQobuzEnv(): QobuzEnv {
  return { appId: process.env.QOBUZ_APP_ID?.trim() || DEFAULT_APP_ID };
}

export function md5Hex(plain: string): string {
  return createHash("md5").update(plain, "utf8").digest("hex");
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value);
}

type BundleSecrets = { appId: string; appSecret: string };

let bundlePairsMemory: { data: BundleSecrets[]; at: number } | null = null;
const BUNDLE_SECRETS_TTL_MS = 6 * 60 * 60 * 1000;

function dedupeBundlePairs(pairs: BundleSecrets[]): BundleSecrets[] {
  const seen = new Set<string>();
  const out: BundleSecrets[] = [];
  for (const p of pairs) {
    const k = `${p.appId}:${p.appSecret.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ appId: p.appId, appSecret: p.appSecret.toLowerCase() });
  }
  return out;
}

/** Todos los pares `app_id`/`app_secret` visibles en el bundle (varios clientes coexisten). */
export async function getQobuzWebBundleSecretPairs(): Promise<BundleSecrets[]> {
  if (
    bundlePairsMemory &&
    Date.now() - bundlePairsMemory.at < BUNDLE_SECRETS_TTL_MS
  ) {
    return bundlePairsMemory.data;
  }

  try {
    const ua = QOBUZ_BROWSER_UA;
    const loginRes = await fetch("https://play.qobuz.com/login", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": ua
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000)
    });
    if (!loginRes.ok) {
      bundlePairsMemory = { data: [], at: Date.now() };
      return [];
    }
    const html = await loginRes.text();
    const m = html.match(/src="(\/resources\/[^"]+\/bundle\.js)"/);
    if (!m) {
      bundlePairsMemory = { data: [], at: Date.now() };
      return [];
    }
    const bunRes = await fetch(`https://play.qobuz.com${m[1]}`, {
      headers: { Accept: "*/*", "User-Agent": ua },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000)
    });
    if (!bunRes.ok) {
      bundlePairsMemory = { data: [], at: Date.now() };
      return [];
    }
    const js = await bunRes.text();
    const raw: BundleSecrets[] = [];
    for (const mm of js.matchAll(/appId:"(\d{9})",appSecret:"([a-f0-9]{32})"/gi)) {
      raw.push({ appId: mm[1]!, appSecret: mm[2]! });
    }
    const deduped = dedupeBundlePairs(raw);
    const prod = js.match(/production:\{api:\{appId:"(\d{9})",appSecret:"([a-f0-9]{32})"/i);
    let ordered = deduped;
    if (prod) {
      const primary: BundleSecrets = {
        appId: prod[1]!,
        appSecret: prod[2]!.toLowerCase()
      };
      const rest = deduped.filter(
        (p) => p.appId !== primary.appId || p.appSecret !== primary.appSecret
      );
      ordered = [primary, ...rest];
    }
    bundlePairsMemory = { data: ordered, at: Date.now() };
    return ordered;
  } catch {
    bundlePairsMemory = { data: [], at: Date.now() };
    return [];
  }
}

/** Primer par `production.api` del bundle (compatibilidad con código que espera un solo par). */
export async function getQobuzWebBundleSecrets(): Promise<BundleSecrets | null> {
  const pairs = await getQobuzWebBundleSecretPairs();
  return pairs[0] ?? null;
}

export function stableQobuzDeviceManufacturerId(email: string): string {
  return createHash("sha256").update(`dtd-w:${email.trim().toLowerCase()}`, "utf8").digest("hex").slice(0, 32);
}

function stripFirstEqPair(qPiece: string): string {
  const i = qPiece.indexOf("=");
  return i === -1 ? qPiece : qPiece.slice(0, i) + qPiece.slice(i + 1);
}

function sortedQueryPieces(params: Record<string, string>): string[] {
  return Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${encodeURIComponent(params[k]!)}`);
}

function sortedQueryString(params: Record<string, string>): string {
  return sortedQueryPieces(params).join("&");
}

/** Firma LMS-style: endpoint sin "/", piezas ordenadas sin `app_id`/token, md5(seg+ts+secret). */
export function appendQobuzSignedLoginParams(bundle: BundleSecrets, baseParams: Record<string, string>): Record<string, string> {
  return appendQobuzSignedParams(bundle, "user/login", baseParams);
}

/**
 * Firma LMS-style genérica para cualquier endpoint Qobuz que requiera `request_sig`.
 * Filtra `app_id`, `user_auth_token`, `request_ts` y `request_sig`, ordena
 * alfabéticamente los pares restantes (sin `=`) y calcula md5(endpoint + pairs + ts + secret).
 */
export function appendQobuzSignedParams(
  bundle: BundleSecrets,
  endpoint: string,
  baseParams: Record<string, string>
): Record<string, string> {
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const pairs = sortedQueryPieces(baseParams);
  const strippedSorted = pairs
    .filter(
      (p) =>
        !p.startsWith("app_id=") &&
        !p.startsWith("user_auth_token=") &&
        !p.startsWith("request_ts=") &&
        !p.startsWith("request_sig=")
    )
    .map(stripFirstEqPair)
    .sort();
  const pathNorm = endpoint.replace(/\//g, "");
  const sigBase = `${pathNorm}${strippedSorted.join("")}`;
  const request_sig = md5Hex(`${sigBase}${ts}${bundle.appSecret}`);
  return { ...baseParams, request_ts: ts, request_sig };
}

function parseAuthToken(json: Record<string, unknown>): string | null {
  const raw = json.user_auth_token;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (raw && typeof raw === "object") {
    const t = (raw as { token?: unknown }).token;
    if (typeof t === "string" && t.length > 0) return t;
  }
  const alt = json.user_auth_token_plain;
  if (typeof alt === "string" && alt.length > 0) return alt;
  return null;
}

export function parseExternalUserId(json: Record<string, unknown>, fallbackEmail: string): string {
  const user = json.user;
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>;
    const id = u.id ?? u.uid ?? u.user_id ?? u.customer_id ?? u.customerId;
    if (typeof id === "number") return String(id);
    if (typeof id === "string" && id.length > 0) return id;
  }
  const email = fallbackEmail.trim().toLowerCase();
  return createHash("sha256").update(`qobuz:${email}`, "utf8").digest("hex").slice(0, 24);
}

async function parseResponseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function loginErrorCode(json: Record<string, unknown>): number | null {
  const c = json.code;
  if (typeof c === "number" && Number.isFinite(c)) return c;
  if (typeof c === "string" && /^\d+$/.test(c)) return Number.parseInt(c, 10);
  return null;
}

function loginJsonLooksFailed(res: Response, json: Record<string, unknown>): boolean {
  if (!res.ok) return true;
  if (json.status === "error") return true;
  const ec = loginErrorCode(json);
  if (ec !== null && ec >= 400) return true;
  if (!parseAuthToken(json)) return true;
  return false;
}

function describeLoginFailure(res: Response, json: Record<string, unknown>): string {
  const fromApi =
    typeof json.message === "string"
      ? json.message.trim()
      : typeof json.reason === "string"
        ? json.reason.trim()
        : "";
  if (fromApi) return fromApi;
  if (!res.ok) return `Respuesta HTTP ${res.status}`;
  return "Login incompleto: Qobuz no devolvió un token de usuario.";
}

async function execLoginAttempt(
  queryString: string,
  headerAppId: string
): Promise<{ res: Response; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "X-App-Id": headerAppId,
    Accept: "application/json",
    "User-Agent": QOBUZ_BROWSER_UA
  };
  let res = await fetch(`${QOBUZ_API_BASE_URL}/user/login?${queryString}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(25_000)
  });
  let json = await parseResponseJsonSafe(res);
  if (!loginJsonLooksFailed(res, json)) {
    return { res, json };
  }
  res = await fetch(`${QOBUZ_API_BASE_URL}/user/login`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: queryString,
    signal: AbortSignal.timeout(25_000)
  });
  json = await parseResponseJsonSafe(res);
  return { res, json };
}

/** Pares para `request_sig`: primero env (si hay), luego cada par del bundle. */
function signingCandidatesFromPairs(
  bundlePairs: BundleSecrets[],
  fallbackAppId: string
): BundleSecrets[] {
  const out: BundleSecrets[] = [];
  const seen = new Set<string>();
  const push = (b: BundleSecrets) => {
    if (!b.appSecret || !/^[a-f0-9]{32}$/i.test(b.appSecret)) return;
    const k = `${b.appId}:${b.appSecret.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ appId: b.appId, appSecret: b.appSecret.toLowerCase() });
  };

  const envSecret = process.env.QOBUZ_APP_SECRET?.trim();
  const envApp = process.env.QOBUZ_APP_ID?.trim();
  if (envSecret && /^[a-f0-9]{32}$/i.test(envSecret)) {
    push({
      appId: envApp || bundlePairs[0]?.appId || fallbackAppId,
      appSecret: envSecret.toLowerCase()
    });
  }
  for (const p of bundlePairs) push(p);
  return out;
}

export async function loginWithCredentials(
  email: string,
  passwordPlain: string,
  env: QobuzEnv = resolveQobuzEnv()
): Promise<{ authToken: string; externalUserId: string; appIdUsed: string }> {
  const em = email.trim();
  const appIdConfigured = env.appId;
  const pwdMd5 = md5Hex(passwordPlain.trim());
  const deviceManufacturerId = stableQobuzDeviceManufacturerId(em);

  const fieldSets: Record<string, string>[] = [
    { email: em, password: pwdMd5, device_manufacturer_id: deviceManufacturerId },
    { username: em, password: pwdMd5, device_manufacturer_id: deviceManufacturerId }
  ];

  let lastMessage = "No se pudo iniciar sesión en Qobuz.";

  const tryUnsigned = async (
    appId: string
  ): Promise<{ authToken: string; externalUserId: string; appIdUsed: string } | null> => {
    for (const fields of fieldSets) {
      const qs = sortedQueryString({ ...fields, app_id: appId });
      const { res, json } = await execLoginAttempt(qs, appId);
      if (!loginJsonLooksFailed(res, json)) {
        const authToken = parseAuthToken(json)!;
        return {
          authToken,
          externalUserId: parseExternalUserId(json, em),
          appIdUsed: appId
        };
      }
      lastMessage = describeLoginFailure(res, json);
    }
    return null;
  };

  /** Sin firma: `app_id` configurado (env o por defecto). */
  const firstUnsigned = await tryUnsigned(appIdConfigured);
  if (firstUnsigned) return firstUnsigned;

  const bundlePairs = await getQobuzWebBundleSecretPairs();
  const triedUnsignedAppIds = new Set<string>([appIdConfigured]);

  /** Sin firma: otros `app_id` del bundle (el token queda ligado a ese cliente). */
  for (const { appId } of bundlePairs) {
    if (triedUnsignedAppIds.has(appId)) continue;
    triedUnsignedAppIds.add(appId);
    const ok = await tryUnsigned(appId);
    if (ok) return ok;
  }

  /** Con firma: env + cada par del bundle (Qobuz a veces exige `request_sig` con el secreto correcto). */
  const signingCandidates = signingCandidatesFromPairs(bundlePairs, appIdConfigured);
  for (const secrets of signingCandidates) {
    for (const fields of fieldSets) {
      const base: Record<string, string> = {
        ...fields,
        app_id: secrets.appId
      };
      const signed = appendQobuzSignedLoginParams(secrets, base);
      const qs = sortedQueryString(signed);
      const { res, json } = await execLoginAttempt(qs, secrets.appId);
      if (!loginJsonLooksFailed(res, json)) {
        const authToken = parseAuthToken(json)!;
        return {
          authToken,
          externalUserId: parseExternalUserId(json, em),
          appIdUsed: secrets.appId
        };
      }
      lastMessage = describeLoginFailure(res, json);
    }
  }

  throw new QobuzLoginRejectedError(lastMessage);
}

async function favoritesRequest(
  authToken: string,
  env: QobuzEnv
): Promise<Response> {
  const appId = (env ?? resolveQobuzEnv()).appId;
  const token = authToken.trim();
  const url = `${QOBUZ_API_BASE_URL}/favorite/getUserFavoriteIds?app_id=${encodeQueryComponent(appId)}&type=albums`;
  return fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": appId,
      "X-User-Auth-Token": token,
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA
    },
    signal: AbortSignal.timeout(20_000)
  });
}

function collectAlbumIdsFromArray(arr: unknown[]): string[] {
  const list: string[] = [];
  for (const o of arr) {
    let id = "";
    if (typeof o === "number" && Number.isFinite(o)) id = String(Math.trunc(o));
    else if (typeof o === "string") id = o.trim();
    else if (o && typeof o === "object") {
      const ob = o as Record<string, unknown>;
      id = String(ob.id ?? ob.album_id ?? "").trim();
      if (!id && ob.album && typeof ob.album === "object") {
        const al = ob.album as Record<string, unknown>;
        id = String(al.id ?? al.album_id ?? "").trim();
      }
    }
    if (id.length > 0) list.push(id);
  }
  return list;
}

function extractFavoriteIdArrays(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.albums)) return body.albums as unknown[];
  if (Array.isArray(body.items)) return body.items as unknown[];
  if (Array.isArray(body.album_ids)) return body.album_ids as unknown[];
  if (Array.isArray(body.ids)) return body.ids as unknown[];
  if (typeof body.albums === "object" && body.albums !== null) {
    const nested = (body.albums as Record<string, unknown>).items;
    if (Array.isArray(nested)) return nested as unknown[];
  }
  return [];
}

/** IDs desde `favorite/getUserFavoriteIds` (varios formatos de respuesta). */
export async function fetchFavoriteAlbumIds(authToken: string, env: QobuzEnv = resolveQobuzEnv()): Promise<string[]> {
  const token = authToken.trim();
  const res = await favoritesRequest(token, env);
  let fromIds: string[] = [];
  if (res.ok) {
    try {
      const body = (await res.json()) as Record<string, unknown>;
      fromIds = dedupePreserveOrder(collectAlbumIdsFromArray(extractFavoriteIdArrays(body)));
    } catch {
      /* cuerpo no JSON */
    }
  }
  if (fromIds.length > 0) return fromIds;

  return fetchFavoriteAlbumIdsFromUserFavorites(token, env);
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function userFavoritesRequest(
  authToken: string,
  env: QobuzEnv,
  limit: number,
  offset: number
): Promise<Response> {
  const appId = (env ?? resolveQobuzEnv()).appId;
  const url = `${QOBUZ_API_BASE_URL}/favorite/getUserFavorites?app_id=${encodeQueryComponent(appId)}&limit=${limit}&offset=${offset}`;
  return fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": appId,
      "X-User-Auth-Token": authToken.trim(),
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA
    },
    signal: AbortSignal.timeout(30_000)
  });
}

/** Fallback: `favorite/getUserFavorites` devuelve `albums.items` con objetos anidados. */
async function fetchFavoriteAlbumIdsFromUserFavorites(
  authToken: string,
  env: QobuzEnv
): Promise<string[]> {
  const res = await userFavoritesRequest(authToken, env, 500, 0);
  if (!res.ok) return [];

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return [];
  }

  const albumsRoot = body.albums;
  const items =
    typeof albumsRoot === "object" && albumsRoot !== null ?
      ((albumsRoot as Record<string, unknown>).items as unknown[]) ?? [] :
      [];

  return dedupePreserveOrder(collectAlbumIdsFromArray(Array.isArray(items) ? items : []));
}

export type QobuzTrackParsed = {
  trackId: string;
  title: string;
  durationSec: number;
};

export type QobuzAlbumParsed = {
  albumId: string;
  artist: string;
  title: string;
  year: string;
  quality: string;
  genre: string;
  label: string;
  coverUrl: string;
  trackCount: number;
  tracks?: QobuzTrackParsed[];
};

function fmtKhz(sr: number): string {
  if (sr <= 0) return "";
  const s = sr >= 100 ? sr.toFixed(0) : sr.toFixed(sr % 1 === 0 ? 0 : 1);
  return s;
}

export async function fetchAlbum(authToken: string, albumId: string, env: QobuzEnv = resolveQobuzEnv()): Promise<QobuzAlbumParsed | null> {
  if (!albumId.trim()) return null;
  const appId = (env ?? resolveQobuzEnv()).appId;
  const url = `${QOBUZ_API_BASE_URL}/album/get?album_id=${encodeURIComponent(albumId)}&app_id=${encodeURIComponent(appId)}`;

  let res = await fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": appId,
      "X-User-Auth-Token": authToken.trim(),
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!res.ok) return null;

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }

  const album = typeof json.album === "object" && json.album !== null ? (json.album as Record<string, unknown>) : json;

  const artistFromObj = album.artist && typeof album.artist === "object" ? ((album.artist as { name?: string }).name ?? "") : "";
  const artistsArr = Array.isArray(album.artists) ? (album.artists as Record<string, unknown>[]) : [];
  const artistName = artistFromObj || (artistsArr[0]?.name ?? "");
  const artist = String(artistName).trim();

  const title = String(album.title ?? "").trim();
  const releaseDate = String(album.release_date_original ?? "").trim() ||
    String(album.released_at_str ?? "").trim();
  const year = releaseDate.split("-")[0] ?? "";
  const yearNorm = /^[12][0-9]{3}$/.test(year) ? year : "";

  const sr = Number(album.maximum_sampling_rate ?? 0);
  const bd = Number(album.maximum_bit_depth ?? 0);
  const quality =
    bd >= 24 && sr > 0 ? `Hi-Res ${fmtKhz(sr)}kHz` :
    bd >= 1 && bd <= 23 && sr >= 44 ? `CD ${fmtKhz(sr)}kHz` :
    sr > 0 ? `Estándar ${fmtKhz(sr)}kHz` : "";

  const genreObj = album.genre && typeof album.genre === "object" ? (album.genre as { name?: string }).name ?? "" : "";
  const genresArr = Array.isArray(album.genres) ? (album.genres as { name?: string }[]) : [];
  const genreCombined = genreObj || (genresArr[0]?.name ?? "");
  const genre = String(genreCombined).trim();

  const labelObj = album.label && typeof album.label === "object" ? (album.label as { name?: string }).name ?? "" : "";
  const labelCombined = labelObj || String(album.label ?? "");
  const label = String(labelCombined).trim();

  let coverUrl = "";
  if (album.image && typeof album.image === "object") {
    const img = album.image as Record<string, unknown>;
    coverUrl =
      String(img.large ?? "").trim() ||
      String(img.small ?? "").trim() ||
      String(img.url ?? "").trim();
  }
  if (!coverUrl) coverUrl = String(album.image ?? "").trim();

  const tracksRoot = typeof json.tracks === "object" && json.tracks !== null ?
    json.tracks as Record<string, unknown> :
    typeof album.tracks === "object" && album.tracks !== null ?
      album.tracks as Record<string, unknown> :
      null;
  const trackItems =
    tracksRoot?.items !== undefined ? (tracksRoot.items as unknown[]) ?? [] :
    [];

  const parsedTracks: QobuzTrackParsed[] = [];
  for (const ti of trackItems) {
    if (!ti || typeof ti !== "object") continue;
    const tr = ti as Record<string, unknown>;
    const tTitle = String(tr.title ?? "").trim();
    let dur =
      typeof tr.duration === "number" ? tr.duration :
      typeof tr.duration_seconds === "number" ? tr.duration_seconds :
      0;
    if (dur <= 0 && typeof tr.duration === "string") {
      const num = Number.parseFloat(tr.duration);
      if (!Number.isNaN(num)) dur = num;
    }
    let tId = "";
    if (typeof tr.id === "number" && Number.isFinite(tr.id)) tId = String(Math.trunc(tr.id));
    else if (typeof tr.id === "string") tId = tr.id.trim();
    else if (typeof tr.track_id === "number" && Number.isFinite(tr.track_id)) tId = String(Math.trunc(tr.track_id));
    else if (typeof tr.track_id === "string") tId = (tr.track_id as string).trim();
    parsedTracks.push({
      trackId: tId,
      title: tTitle || "Track",
      durationSec: Math.round(dur || 0)
    });
  }

  const trackCountFromArr = parsedTracks.length;
  const tc =
    typeof album.tracks_count === "number" ? album.tracks_count :
    typeof album.nb_tracks === "number" ? album.nb_tracks :
    trackCountFromArr;

  return {
    albumId,
    artist,
    title,
    year: yearNorm,
    quality,
    genre,
    label,
    coverUrl,
    trackCount: tc,
    tracks: parsedTracks.length > 0 ? parsedTracks : undefined
  };
}



export type QobuzDiscographyCategory = "studio" | "live" | "ep_single" | "compilation" | "other";

export type QobuzDiscographyAlbum = {
  albumId: string;
  title: string;
  artist: string;
  year: string;
  quality: string;
  coverUrl: string;
  category: QobuzDiscographyCategory;
};

/** Orden de bloques en discografía: estudio → compilación → en vivo → EP/singles → colaboraciones y otros. */
export const QOBUZ_DISCOGRAPHY_CATEGORY_SORT_ORDER: readonly QobuzDiscographyCategory[] = [
  "studio",
  "compilation",
  "live",
  "ep_single",
  "other"
];

export function compareQobuzDiscographyAlbumsForDisplay(
  a: Pick<QobuzDiscographyAlbum, "category" | "year" | "title"> & { matchConfidence?: number | null },
  b: Pick<QobuzDiscographyAlbum, "category" | "year" | "title"> & { matchConfidence?: number | null }
): number {
  const ia = QOBUZ_DISCOGRAPHY_CATEGORY_SORT_ORDER.indexOf(a.category);
  const ib = QOBUZ_DISCOGRAPHY_CATEGORY_SORT_ORDER.indexOf(b.category);
  const ra = ia === -1 ? 99 : ia;
  const rb = ib === -1 ? 99 : ib;
  if (ra !== rb) return ra - rb;
  const byYear = (b.year || "").localeCompare(a.year || "");
  if (byYear !== 0) return byYear;
  const ca = a.matchConfidence ?? -1;
  const cb = b.matchConfidence ?? -1;
  if (cb !== ca) return cb - ca;
  return a.title.localeCompare(b.title);
}

function classifyDiscographyCategory(
  title: string,
  releaseType: string,
  productType: string,
  tracksCount: number
): QobuzDiscographyCategory {
  const t = `${title} ${releaseType} ${productType}`.toLowerCase();
  // Colaboraciones / splits suelen ir al final del listado (categoría "other").
  if (
    /\b(feat\.|ft\.|featuring| vs\.? | x | duet|duets with|present(s|ed)? by)\b/.test(t) &&
    tracksCount > 0 &&
    tracksCount <= 16
  ) {
    return "other";
  }
  if (/\blive\b|unplugged|in concert|en vivo/.test(t)) return "live";
  if (/\bep\b|single/.test(t)) return "ep_single";
  if (/compilation|best of|greatest hits|anthology|collection/.test(t)) return "compilation";
  if (tracksCount > 0 && tracksCount <= 6) return "ep_single";
  if (/album|studio/.test(t)) return "studio";
  return "other";
}

function parseDiscographyAlbum(raw: Record<string, unknown>, fallbackArtist: string): QobuzDiscographyAlbum | null {
  let albumId = "";
  if (typeof raw.id === "number" && Number.isFinite(raw.id)) albumId = String(Math.trunc(raw.id));
  else if (typeof raw.id === "string") albumId = raw.id.trim();
  if (!albumId) return null;

  const title = String(raw.title ?? "").trim();
  const artistObj = raw.artist && typeof raw.artist === "object" ? (raw.artist as Record<string, unknown>) : null;
  const itemArtist = String(artistObj?.name ?? "").trim() || fallbackArtist;

  const dateRaw = String(raw.release_date_original ?? raw.released_at_str ?? "").trim();
  const year = /^\d{4}/.test(dateRaw) ? dateRaw.slice(0, 4) : "";

  const sr = Number(raw.maximum_sampling_rate ?? 0);
  const bd = Number(raw.maximum_bit_depth ?? 0);
  const quality =
    bd >= 24 && sr > 0 ? `Hi-Res ${fmtKhz(sr)}kHz` :
    bd >= 1 && bd <= 23 && sr >= 44 ? `CD ${fmtKhz(sr)}kHz` :
    sr > 0 ? `Estándar ${fmtKhz(sr)}kHz` : "";

  let coverUrl = "";
  if (raw.image && typeof raw.image === "object") {
    const img = raw.image as Record<string, unknown>;
    coverUrl =
      String(img.large ?? "").trim() ||
      String(img.small ?? "").trim() ||
      String(img.url ?? "").trim();
  }

  const tracksCount =
    typeof raw.tracks_count === "number" ? raw.tracks_count :
    typeof raw.nb_tracks === "number" ? raw.nb_tracks :
    0;

  const releaseType = String(raw.release_type ?? raw.releaseType ?? "").trim();
  const productType = String(raw.product_type ?? raw.productType ?? raw.album_type ?? "").trim();
  const category = classifyDiscographyCategory(title, releaseType, productType, Number(tracksCount) || 0);

  return {
    albumId,
    title,
    artist: itemArtist,
    year,
    quality,
    coverUrl,
    category
  };
}

async function searchArtistId(
  authToken: string,
  artistName: string,
  appId: string
): Promise<string | null> {
  const url =
    `${QOBUZ_API_BASE_URL}/artist/search?app_id=${encodeURIComponent(appId)}` +
    `&query=${encodeURIComponent(artistName)}&limit=10&offset=0`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": appId,
      "X-User-Auth-Token": authToken.trim(),
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA
    },
    signal: AbortSignal.timeout(20_000)
  });
  if (!res.ok) return null;
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  const root = json.artists;
  const items =
    typeof root === "object" && root !== null && Array.isArray((root as Record<string, unknown>).items)
      ? ((root as Record<string, unknown>).items as unknown[])
      : [];
  const want = artistName.trim().toLowerCase();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const a = raw as Record<string, unknown>;
    const name = String(a.name ?? "").trim().toLowerCase();
    if (!name) continue;
    if (!(name === want || name.includes(want) || want.includes(name))) continue;
    const id =
      typeof a.id === "number" && Number.isFinite(a.id)
        ? String(Math.trunc(a.id))
        : typeof a.id === "string"
          ? a.id.trim()
          : "";
    if (id) return id;
  }
  return null;
}

async function fetchArtistAlbumsById(
  authToken: string,
  artistId: string,
  appId: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const url =
    `${QOBUZ_API_BASE_URL}/artist/get?app_id=${encodeURIComponent(appId)}` +
    `&artist_id=${encodeURIComponent(artistId)}&extra=albums&limit=${limit}&offset=0`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": appId,
      "X-User-Auth-Token": authToken.trim(),
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA
    },
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) return [];
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return [];
  }
  const albumsRoot = json.albums;
  const items =
    typeof albumsRoot === "object" && albumsRoot !== null && Array.isArray((albumsRoot as Record<string, unknown>).items)
      ? ((albumsRoot as Record<string, unknown>).items as unknown[])
      : [];
  return items.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

async function fetchAlbumsBySearch(
  authToken: string,
  artistName: string,
  appId: string,
  limit: number
): Promise<Record<string, unknown>[]> {
  const queries = [
    `artist:"${artistName}"`,
    artistName,
    `"${artistName}"`
  ];
  const offsets = [0, Math.min(limit, 100)];
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    for (const off of offsets) {
      const url =
        `${QOBUZ_API_BASE_URL}/album/search?app_id=${encodeURIComponent(appId)}` +
        `&query=${encodeURIComponent(q)}&limit=${Math.min(limit, 100)}&offset=${off}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-App-Id": appId,
          "X-User-Auth-Token": authToken.trim(),
          Accept: "application/json",
          "User-Agent": QOBUZ_BROWSER_UA
        },
        signal: AbortSignal.timeout(25_000)
      });
      if (!res.ok) continue;
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        continue;
      }
      const root = json.albums;
      const items =
        typeof root === "object" && root !== null && Array.isArray((root as Record<string, unknown>).items)
          ? ((root as Record<string, unknown>).items as unknown[])
          : [];
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const rec = it as Record<string, unknown>;
        const id =
          typeof rec.id === "number" && Number.isFinite(rec.id)
            ? String(Math.trunc(rec.id))
            : typeof rec.id === "string"
              ? rec.id.trim()
              : "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(rec);
      }
    }
  }

  return out;
}

/**
 * Discografía amplia por artista en Qobuz (no limitada a favoritos).
 * Estrategia: artist/search -> artist/get(extra=albums) y fallback album/search.
 */
export async function fetchArtistDiscography(
  authToken: string,
  artistName: string,
  env?: QobuzEnv,
  limit: number = 120
): Promise<QobuzDiscographyAlbum[]> {
  const artist = artistName.trim();
  if (!artist) return [];

  const appId = (env ?? resolveQobuzEnv()).appId;
  const safeLimit = Math.max(20, Math.min(300, Math.round(limit || 120)));

  const byId = new Map<string, QobuzDiscographyAlbum>();

  // Búsqueda por álbum en paralelo con la resolución de artista (menos latencia total).
  const searchPromise = fetchAlbumsBySearch(authToken, artist, appId, safeLimit);
  const artistId = await searchArtistId(authToken, artist, appId);
  if (artistId) {
    const itemsByArtist = await fetchArtistAlbumsById(authToken, artistId, appId, safeLimit);
    for (const raw of itemsByArtist) {
      const parsed = parseDiscographyAlbum(raw, artist);
      if (!parsed) continue;
      if (!byId.has(parsed.albumId)) byId.set(parsed.albumId, parsed);
    }
  }

  const itemsBySearch = await searchPromise;
  for (const raw of itemsBySearch) {
    const parsed = parseDiscographyAlbum(raw, artist);
    if (!parsed) continue;
    if (!byId.has(parsed.albumId)) byId.set(parsed.albumId, parsed);
  }

  const out = Array.from(byId.values());
  out.sort((a, b) => (b.year || "").localeCompare(a.year || "") || a.title.localeCompare(b.title));
  return out;
}

export async function verifySession(authToken: string, env: QobuzEnv = resolveQobuzEnv()): Promise<boolean> {
  const token = authToken.trim();
  const res = await favoritesRequest(token, env);
  if (res.ok) return true;
  const res2 = await userFavoritesRequest(token, env, 1, 0);
  return res2.ok;
}

/**
 * Identificadores de formato (`format_id`) de Qobuz para `track/getFileUrl`:
 *  - 5  = MP3 320 kbps
 *  - 6  = FLAC CD 16 bit / 44.1 kHz (Lossless)
 *  - 7  = FLAC Hi-Res 24 bit / 96 kHz (Hi-Res)
 *  - 27 = FLAC Hi-Res 24 bit / 192 kHz (Hi-Res+)
 */
export const QOBUZ_FORMAT_MP3_320 = 5;
export const QOBUZ_FORMAT_FLAC_LOSSLESS = 6;
export const QOBUZ_FORMAT_FLAC_HI_RES_96 = 7;
export const QOBUZ_FORMAT_FLAC_HI_RES_192 = 27;

/** Orden para elegir la mejor calidad disponible (Hi-Res+ → Hi-Res → CD → MP3). */
export const QOBUZ_FORMAT_IDS_BEST_FIRST: readonly number[] = [
  QOBUZ_FORMAT_FLAC_HI_RES_192,
  QOBUZ_FORMAT_FLAC_HI_RES_96,
  QOBUZ_FORMAT_FLAC_LOSSLESS,
  QOBUZ_FORMAT_MP3_320
];

export type QobuzTrackStream = {
  url: string;
  formatId: number;
  mimeType: string;
  bitDepth: number | null;
  samplingRate: number | null;
  durationSec: number | null;
};

function parseTrackStreamPayload(json: Record<string, unknown>): QobuzTrackStream | null {
  const url = typeof json.url === "string" ? json.url.trim() : "";
  if (!url) return null;
  const formatId =
    typeof json.format_id === "number" ? json.format_id :
    typeof json.format_id === "string" ? Number.parseInt(json.format_id, 10) :
    0;
  const mimeType = typeof json.mime_type === "string" && json.mime_type.trim().length > 0
    ? json.mime_type.trim()
    : (formatId === QOBUZ_FORMAT_MP3_320 ? "audio/mpeg" : "audio/flac");
  const bitDepth =
    typeof json.bit_depth === "number" ? json.bit_depth :
    typeof json.bit_depth === "string" ? Number.parseFloat(json.bit_depth) :
    null;
  const samplingRate =
    typeof json.sampling_rate === "number" ? json.sampling_rate :
    typeof json.sampling_rate === "string" ? Number.parseFloat(json.sampling_rate) :
    null;
  const durationSec =
    typeof json.duration === "number" ? json.duration :
    typeof json.duration === "string" ? Number.parseFloat(json.duration) :
    null;
  return {
    url,
    formatId: Number.isFinite(formatId) ? formatId : 0,
    mimeType,
    bitDepth: bitDepth !== null && Number.isFinite(bitDepth) ? bitDepth : null,
    samplingRate: samplingRate !== null && Number.isFinite(samplingRate) ? samplingRate : null,
    durationSec: durationSec !== null && Number.isFinite(durationSec) ? durationSec : null
  };
}

export type QobuzTrackFileAttempt = {
  appIdTried: string;
  httpStatus: number;
  ok: boolean;
  bodySnippet: string;
};

export type QobuzTrackFileResult = {
  stream: QobuzTrackStream | null;
  attempts: QobuzTrackFileAttempt[];
};

async function execTrackFileUrlAttempt(
  bundle: BundleSecrets,
  authToken: string,
  trackId: string,
  formatId: number
): Promise<{ stream: QobuzTrackStream | null; attempt: QobuzTrackFileAttempt }> {
  /**
   * IMPORTANTE: para `track/getFileUrl`, `app_id` y `user_auth_token` viajan
   * SOLO en cabeceras (X-App-Id / X-User-Auth-Token). En la query van únicamente
   * los parámetros que entran en la firma. Si se incluyen también en la query,
   * Qobuz responde "Invalid Request Signature parameter (request_sig)".
   * Convención compatible con qobuz-dl, qopy y otros clientes públicos.
   */
  const baseParams: Record<string, string> = {
    format_id: String(formatId),
    intent: "stream",
    track_id: trackId
  };
  const signed = appendQobuzSignedParams(bundle, "track/getFileUrl", baseParams);
  const qs = sortedQueryString(signed);
  const url = `${QOBUZ_API_BASE_URL}/track/getFileUrl?${qs}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-App-Id": bundle.appId,
      "X-User-Auth-Token": authToken,
      Accept: "application/json",
      "User-Agent": QOBUZ_BROWSER_UA,
      Origin: "https://play.qobuz.com",
      Referer: "https://play.qobuz.com/"
    },
    signal: AbortSignal.timeout(20_000)
  });
  const text = await res.text();
  const bodySnippet = text.slice(0, 400);
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* respuesta no JSON: bodySnippet sigue ayudando */
  }
  const stream = res.ok ? parseTrackStreamPayload(json) : null;
  return {
    stream,
    attempt: {
      appIdTried: bundle.appId,
      httpStatus: res.status,
      ok: res.ok,
      bodySnippet
    }
  };
}

/**
 * Resuelve la URL streameable (FLAC/Hi-Res) firmada para un `trackId` dado.
 *
 * Estrategia de candidatos para firmar:
 *  1. Si hay secret real cacheado (`.data/qobuz-secrets.json`, extraído con
 *     Puppeteer ejecutando `window.rng.prototype.initialization()`), se prueba
 *     PRIMERO contra cada `app_id` conocido del bundle. Este es el único secret
 *     que Qobuz acepta para `track/getFileUrl` en production.
 *  2. Si falla o no hay cache, se intentan los pares `appId`/`appSecret` del
 *     bundle público — saben firmar `user/login` y `favorite/...`, pero
 *     **no** firman `track/getFileUrl` (Qobuz responde
 *     "Invalid Request Signature parameter (request_sig)"). Quedan como red
 *     de seguridad por si Qobuz cambia algo y vuelven a servir.
 *
 * La URL devuelta es temporal (suele caducar en minutos) y debe consumirse
 * rápido (p. ej. pasársela inmediatamente al MediaRenderer DLNA vía
 * `SetAVTransportURI`).
 *
 * Devuelve también la traza de cada intento (status + snippet) para diagnóstico.
 */
export async function getTrackFileUrlDetailed(
  authToken: string,
  trackId: string,
  formatId: number = QOBUZ_FORMAT_FLAC_HI_RES_96,
  env: QobuzEnv = resolveQobuzEnv()
): Promise<QobuzTrackFileResult> {
  const id = trackId.trim();
  const token = authToken.trim();
  const attempts: QobuzTrackFileAttempt[] = [];
  if (!id || !token) return { stream: null, attempts };

  const bundlePairs = await getQobuzWebBundleSecretPairs();
  const cachedSecret = await readCachedQobuzSecret();

  /**
   * Pares prioritarios cuando tenemos el secret real: combinarlo con cada
   * `appId` candidato (el efectivo es el `qobuzApiAppId` con que se logueó
   * el usuario, pero probamos todos los del bundle por robustez).
   */
  const realSecretCandidates: BundleSecrets[] = [];
  if (cachedSecret) {
    const seen = new Set<string>();
    const appIds = [env.appId, ...bundlePairs.map((p) => p.appId)];
    for (const appId of appIds) {
      const k = `${appId}:${cachedSecret.secret}`;
      if (appId && /^\d{6,12}$/.test(appId) && !seen.has(k)) {
        seen.add(k);
        realSecretCandidates.push({ appId, appSecret: cachedSecret.secret });
      }
    }
  }

  const fallbackCandidates = signingCandidatesFromPairs(bundlePairs, env.appId);
  const allCandidates = [...realSecretCandidates, ...fallbackCandidates];

  for (const bundle of allCandidates) {
    try {
      const { stream, attempt } = await execTrackFileUrlAttempt(bundle, token, id, formatId);
      attempts.push(attempt);
      if (stream && stream.url) return { stream, attempts };
    } catch (err) {
      attempts.push({
        appIdTried: bundle.appId,
        httpStatus: 0,
        ok: false,
        bodySnippet: err instanceof Error ? `EXCEPTION: ${err.message}` : "EXCEPTION"
      });
    }
  }
  return { stream: null, attempts };
}

/**
 * Prueba `format_id` en orden (por defecto de mayor a menor calidad) y devuelve
 * el primer stream que Qobuz acepte. Útil cuando la pista no tiene Hi-Res o el
 * plan del usuario no incluye ciertos formatos.
 */
export async function getTrackFileUrlBestDetailed(
  authToken: string,
  trackId: string,
  env: QobuzEnv = resolveQobuzEnv(),
  formatOrder: readonly number[] = QOBUZ_FORMAT_IDS_BEST_FIRST
): Promise<QobuzTrackFileResult> {
  const merged: QobuzTrackFileAttempt[] = [];
  for (const formatId of formatOrder) {
    const r = await getTrackFileUrlDetailed(authToken, trackId, formatId, env);
    merged.push(...r.attempts);
    if (r.stream?.url) {
      return { stream: r.stream, attempts: merged };
    }
  }
  return { stream: null, attempts: merged };
}

/** Atajo legacy que sólo devuelve el stream (o null). */
export async function getTrackFileUrl(
  authToken: string,
  trackId: string,
  formatId: number = QOBUZ_FORMAT_FLAC_HI_RES_96,
  env: QobuzEnv = resolveQobuzEnv()
): Promise<QobuzTrackStream | null> {
  const r = await getTrackFileUrlDetailed(authToken, trackId, formatId, env);
  return r.stream;
}
