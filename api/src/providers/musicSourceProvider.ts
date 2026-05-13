import type { SourceType } from "../types/domain.js";
import type { UnifiedAlbum } from "../types/domain.js";

export type ProviderConnectResult = {
  externalUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  /** Qobuz: persistir para cabeceras de API con este token */
  qobuzApiAppId?: string | null;
};

export type ProviderVerifyResult = {
  ok: boolean;
};

export interface MusicSourceProvider {
  readonly source: SourceType;
  connect(body?: Record<string, unknown>): Promise<ProviderConnectResult>;
  callback(input: {
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  }): Promise<ProviderConnectResult>;
  verify(accessToken: string, hint?: { qobuzApiAppId?: string | null }): Promise<ProviderVerifyResult>;
  disconnect(): { ok: true };
  syncFavorites(input: {
    userId: string;
    accessToken: string;
    qobuzApiAppId?: string | null;
  }): Promise<UnifiedAlbum[]>;
}

