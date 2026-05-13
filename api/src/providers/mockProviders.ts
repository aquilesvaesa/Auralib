import type { MusicSourceProvider, ProviderConnectResult } from "./musicSourceProvider.js";
import type { SourceType, UnifiedAlbum } from "../types/domain.js";
import { QobuzMusicProvider } from "./qobuzProvider.js";

class BaseMockProvider implements MusicSourceProvider {
  constructor(readonly source: SourceType) {}

  async connect(): Promise<ProviderConnectResult> {
    return Promise.resolve({
      externalUserId: `${this.source}_user_demo`,
      accessToken: `${this.source}_access_token_demo`,
      refreshToken: `${this.source}_refresh_token_demo`,
      expiresInSeconds: 3600
    });
  }

  async callback(input: {
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  }): Promise<ProviderConnectResult> {
    return Promise.resolve({
      externalUserId: `${this.source}_user_demo`,
      accessToken: input.accessToken ?? `${this.source}_access_token_from_code_${input.code ?? "demo"}`,
      refreshToken:
        input.refreshToken ?? `${this.source}_refresh_token_from_code_${input.code ?? "demo"}`,
      expiresInSeconds: input.expiresInSeconds ?? 3600
    });
  }

  async verify(accessToken: string, _hint?: { qobuzApiAppId?: string | null }) {
    return Promise.resolve({ ok: accessToken.length > 0 });
  }

  disconnect() {
    return { ok: true as const };
  }

  async syncFavorites(input: {
    userId: string;
    accessToken: string;
    qobuzApiAppId?: string | null;
  }): Promise<UnifiedAlbum[]> {
    const seed = Math.abs(
      Array.from(`${input.userId}:${input.accessToken}`).reduce((acc, c) => acc + c.charCodeAt(0), 0)
    );
    return Promise.resolve(Array.from({ length: 6 }).map((_, idx) => ({
      canonicalAlbumId: `${this.source}-${input.userId}-${idx + 1}`,
      matchKey: `${this.source}-artist-${idx + 1}::${this.source}-album-${idx + 1}`,
      artist: `Artist ${idx + 1}`,
      album: `Favorite Album ${idx + 1}`,
      year: String(2020 + (idx % 5)),
      genre: idx % 2 === 0 ? "Electronic" : "Jazz",
      addedAt: new Date(Date.now() - idx * 86_400_000).toISOString(),
      isFavorite: idx % 5 !== 0,
      tracks: [
        { title: `Track ${idx + 1}.1`, durationSec: 200 + idx * 4 },
        { title: `Track ${idx + 1}.2`, durationSec: 180 + idx * 3 }
      ],
      sources: [
        {
          source: this.source,
          externalAlbumId: `${this.source}_album_${idx + 1}`,
          quality: seed % 2 === 0 ? "Hi-Res 24bit" : "CD 44.1kHz"
        }
      ]
    })));
  }
}

export function createProviderRegistry() {
  return {
    qobuz: new QobuzMusicProvider(),
    youtube_music: new BaseMockProvider("youtube_music"),
    spotify: new BaseMockProvider("spotify")
  };
}

