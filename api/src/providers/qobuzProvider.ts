import { createHash } from "node:crypto";

import type {
  MusicSourceProvider,
  ProviderConnectResult,
  ProviderVerifyResult
} from "./musicSourceProvider.js";
import type { UnifiedAlbum } from "../types/domain.js";

import {
  fetchAlbum,
  fetchFavoriteAlbumIds,
  getQobuzWebBundleSecrets,
  loginWithCredentials,
  resolveQobuzEnv,
  verifySession,
  type QobuzEnv
} from "./qobuzApiClient.js";
import { QobuzLoginRejectedError } from "./qobuzLoginError.js";

const CONNECT_TOKEN_TTL_SEC = 60 * 60 * 24 * 7;

function normalizeMatchKey(artist: string, albumTitle: string): string {
  const part = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  return `${part(artist)}::${part(albumTitle)}`;
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickQobuzEnv(providerBase: QobuzEnv, hintAppId?: string | null): QobuzEnv {
  const t = hintAppId?.trim();
  return t ? { appId: t } : providerBase;
}

export class QobuzMusicProvider implements MusicSourceProvider {
  readonly source = "qobuz" as const;
  private readonly env: QobuzEnv;

  constructor(env: QobuzEnv = resolveQobuzEnv()) {
    this.env = env;
  }

  /** Qobuz: requiere `email` y `password` en el cuerpo del POST `/connect`. */
  async connect(input?: Record<string, unknown>): Promise<ProviderConnectResult> {
    const email = String(input?.email ?? "").trim();
    const password = String(input?.password ?? "");
    if (!email || !password) {
      throw Object.assign(new Error("QOBUZ_CREDENTIALS_REQUIRED"), { code: "QOBUZ_CREDENTIALS_REQUIRED" });
    }

    let authToken: string;
    let externalUserId: string;
    let appIdUsed: string;
    try {
      ({ authToken, externalUserId, appIdUsed } = await loginWithCredentials(email, password, this.env));
    } catch (e: unknown) {
      if (e instanceof QobuzLoginRejectedError) throw e;
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "No hubo respuesta válida desde Qobuz (red o servidor).";
      throw new QobuzLoginRejectedError(msg);
    }

    return {
      externalUserId,
      accessToken: authToken,
      refreshToken: "",
      expiresInSeconds: CONNECT_TOKEN_TTL_SEC,
      qobuzApiAppId: appIdUsed
    };
  }

  async callback(input: {
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  }): Promise<ProviderConnectResult> {
    const token = String(input.accessToken ?? "").trim();
    if (!token) {
      throw Object.assign(new Error("QOBUZ_TOKEN_REQUIRED"), { code: "QOBUZ_TOKEN_REQUIRED" });
    }
    const bundled = await getQobuzWebBundleSecrets();
    const envForCb = bundled ? pickQobuzEnv(this.env, bundled.appId) : this.env;
    const ok = await verifySession(token.trim(), envForCb);
    if (!ok) throw Object.assign(new Error("QOBUZ_TOKEN_VERIFY_FAILED"), { code: "QOBUZ_TOKEN_VERIFY_FAILED" });

    return {
      externalUserId: `qobuz_token:${createHash("sha256").update(token, "utf8").digest("hex").slice(0, 24)}`,
      accessToken: token,
      refreshToken: "",
      expiresInSeconds: input.expiresInSeconds ?? CONNECT_TOKEN_TTL_SEC,
      qobuzApiAppId: bundled?.appId ?? envForCb.appId
    };
  }

  async verify(
    accessToken: string,
    hint?: { qobuzApiAppId?: string | null }
  ): Promise<ProviderVerifyResult> {
    const merged = pickQobuzEnv(this.env, hint?.qobuzApiAppId ?? null);
    const ok = await verifySession(accessToken.trim(), merged);
    return { ok };
  }

  disconnect(): { ok: true } {
    return { ok: true };
  }

  async syncFavorites(input: {
    userId: string;
    accessToken: string;
    qobuzApiAppId?: string | null;
  }): Promise<UnifiedAlbum[]> {
    const env = pickQobuzEnv(this.env, input.qobuzApiAppId ?? null);
    const ids = await fetchFavoriteAlbumIds(input.accessToken.trim(), env);
    if (ids.length === 0) return [];

    const indexById = new Map(ids.map((id, idx) => [id, idx] as const));
    const slots = new Map<string, UnifiedAlbum>();

    const batches = chunkIds(ids, 6);
    for (const batch of batches) {
      const token = input.accessToken.trim();
      const results = await Promise.all(batch.map((id) => fetchAlbum(token, id, env)));
      for (let idx = 0; idx < batch.length; idx += 1) {
        const albumId = batch[idx];
        const info = results[idx];
        if (!info || !info.title.trim()) continue;

        const matchKey = normalizeMatchKey(info.artist || "Sin artista", info.title);

        slots.set(albumId, {
          canonicalAlbumId: `qobuz:${input.userId}:${albumId}`,
          matchKey,
          artist: info.artist || "Sin artista",
          album: info.title,
          year: info.year || undefined,
          genre: info.genre || undefined,
          addedAt: new Date(Date.now() - (indexById.get(albumId) ?? 0) * 1000).toISOString(),
          isFavorite: true,
          tracks: info.tracks,
          sources: [
            {
              source: "qobuz",
              externalAlbumId: albumId,
              quality: info.quality || undefined,
              coverUrl: info.coverUrl || undefined
            }
          ]
        });
      }
    }

    const ordered: UnifiedAlbum[] = [];
    for (const id of ids) {
      const u = slots.get(id);
      if (u) ordered.push(u);
    }
    return ordered;
  }
}
