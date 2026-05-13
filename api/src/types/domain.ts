export type SourceType = "qobuz" | "youtube_music" | "spotify";

export type SourceStatus =
  | "connected"
  | "expired"
  | "error"
  | "disconnected"
  | "degraded"
  | "reconnect_required";

export type EncryptedSecret = {
  iv: string;
  tag: string;
  data: string;
};

export type SourceAccount = {
  id: string;
  userId: string;
  source: SourceType;
  status: SourceStatus;
  externalUserId: string | null;
  accessTokenEncrypted: EncryptedSecret | null;
  refreshTokenEncrypted: EncryptedSecret | null;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  /** Solo Qobuz: mismo `app_id` con el que se obtuvo este token (`X-App-Id`). */
  qobuzApiAppId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedAlbum = {
  canonicalAlbumId: string;
  matchKey: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  addedAt?: string;
  isFavorite?: boolean;
  tracks?: Array<{ title: string; durationSec: number; trackId?: string }>;
  sources: Array<{
    source: SourceType;
    externalAlbumId: string;
    quality?: string;
    coverUrl?: string;
  }>;
};

export type SyncJobStatus = "queued" | "running" | "completed" | "failed";

export type SyncJob = {
  id: string;
  source: SourceType;
  status: SyncJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: { synced: number } | null;
  error: string | null;
};
