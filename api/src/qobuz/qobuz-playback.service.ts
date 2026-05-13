import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  fetchAlbum,
  getTrackFileUrlBestDetailed,
  getTrackFileUrlDetailed,
  resolveQobuzEnv
} from "../providers/qobuzApiClient.js";
import { decryptToken } from "../security/tokenCrypto.js";
import { SourceAccountStore } from "../services/sourceAccountStore.js";
import type { UnifiedAlbum } from "../types/domain.js";

export type ResolveTrackInput = {
  /** ID de pista en Qobuz (lo expone `UnifiedAlbum.tracks[].trackId`). */
  trackId: string;
  /** ID de álbum (`UnifiedAlbum.sources[].externalAlbumId`). Necesario para metadata. */
  albumId?: string;
  /**
   * Format Qobuz (5 MP3, 6 FLAC CD, 7 FLAC 96, 27 FLAC 192).
   * Si se omite, se elige la **mayor calidad disponible** para la pista y la cuenta.
   */
  formatId?: number;
};

export type TrackMetadata = {
  title: string;
  artist: string | null;
  album: string | null;
  albumArtUri: string | null;
  durationSec: number | null;
  mimeType: string;
};

export type ResolveTrackResult = {
  uri: string;
  formatId: number;
  bitDepth: number | null;
  samplingRate: number | null;
  durationSec: number | null;
  metadata: TrackMetadata;
};

/**
 * Servicio agnóstico de transporte: dado un usuario y una pista de Qobuz, resuelve
 * la URL streameable firmada y la metadata (título, artista, portada, duración).
 *
 * El cliente decide qué hacer con esa URL:
 *  - Reproducirla localmente (just_audio / ExoPlayer).
 *  - Mandarla a un MediaRenderer DLNA en su LAN (control UPnP en el cliente).
 */
@Injectable()
export class QobuzPlaybackService {
  constructor(@Inject(SourceAccountStore) private readonly accounts: SourceAccountStore) {}

  async resolveTrack(userId: string, input: ResolveTrackInput): Promise<ResolveTrackResult> {
    const trackId = input.trackId.trim();
    if (!trackId) {
      throw new BadRequestException({
        error: { code: "TRACK_ID_REQUIRED", message: "trackId requerido" }
      });
    }

    const authToken = await this.requireQobuzToken(userId);

    const explicitFormat =
      typeof input.formatId === "number" &&
      Number.isFinite(input.formatId) &&
      input.formatId > 0;

    const detailed = explicitFormat
      ? await getTrackFileUrlDetailed(authToken, trackId, input.formatId)
      : await getTrackFileUrlBestDetailed(authToken, trackId);

    const stream = detailed.stream;
    if (!stream) {
      const traces = detailed.attempts
        .map((a) => `app_id=${a.appIdTried} http=${a.httpStatus} body=${a.bodySnippet.replace(/\s+/g, " ").slice(0, 200)}`)
        .join(" | ");
      const fmtHint = explicitFormat ? `formato ${input.formatId}` : "mejor calidad disponible (27→7→6→5)";
      throw new ConflictException({
        error: {
          code: "QOBUZ_STREAM_UNAVAILABLE",
          message: `Qobuz no devolvió URL streameable para track ${trackId} (${fmtHint}).`,
          details: traces || "ninguno"
        }
      });
    }

    const metadata = await this.resolveMetadata(userId, input, stream.mimeType, stream.durationSec);

    return {
      uri: stream.url,
      formatId: stream.formatId,
      bitDepth: stream.bitDepth,
      samplingRate: stream.samplingRate,
      durationSec: stream.durationSec ?? metadata.durationSec ?? null,
      metadata
    };
  }

  private async requireQobuzToken(userId: string): Promise<string> {
    const userState = await this.accounts.getUserState(userId);
    const account = userState.sourceAccounts.qobuz;
    if (!account || account.status !== "connected" || !account.accessTokenEncrypted) {
      throw new ConflictException({
        error: {
          code: "SOURCE_NOT_CONNECTED",
          message: "Cuenta Qobuz no conectada para este usuario."
        }
      });
    }
    try {
      return decryptToken(account.accessTokenEncrypted).trim();
    } catch {
      throw new ConflictException({
        error: {
          code: "TOKEN_DECRYPT_FAILED",
          message: "Token Qobuz no se pudo descifrar; reconecta la cuenta."
        }
      });
    }
  }

  private async resolveMetadata(
    userId: string,
    input: ResolveTrackInput,
    mimeType: string,
    durationFromStream: number | null
  ): Promise<TrackMetadata> {
    const fromAlbum = await this.lookupAlbumMetadata(userId, input);

    const title = (fromAlbum.trackTitle || "Pista").toString();
    const artist = fromAlbum.artist ?? null;
    const album = fromAlbum.album ?? null;
    const albumArtUri = fromAlbum.coverUrl ?? null;
    const durationSec = fromAlbum.trackDurationSec ?? durationFromStream ?? null;

    return {
      title,
      artist,
      album,
      albumArtUri,
      durationSec,
      mimeType
    };
  }

  private async lookupAlbumMetadata(
    userId: string,
    input: ResolveTrackInput
  ): Promise<{
    trackTitle: string | null;
    trackDurationSec: number | null;
    artist: string | null;
    album: string | null;
    coverUrl: string | null;
  }> {
    const empty = {
      trackTitle: null,
      trackDurationSec: null,
      artist: null,
      album: null,
      coverUrl: null
    };

    const userState = await this.accounts.getUserState(userId);
    const albums = userState.bySourceAlbums.qobuz ?? [];

    const matchedFromLibrary = findTrackInAlbums(albums, input.trackId, input.albumId);
    if (matchedFromLibrary) return matchedFromLibrary;

    if (!input.albumId?.trim()) return empty;

    const account = userState.sourceAccounts.qobuz;
    if (!account?.accessTokenEncrypted) return empty;
    let token = "";
    try {
      token = decryptToken(account.accessTokenEncrypted).trim();
    } catch {
      return empty;
    }

    const album = await fetchAlbum(token, input.albumId, resolveQobuzEnv());
    if (!album) return empty;

    const track = album.tracks?.find((t) => t.trackId === input.trackId);
    if (!track && !album) {
      throw new NotFoundException({
        error: { code: "ALBUM_NOT_FOUND", message: "Álbum no encontrado en Qobuz" }
      });
    }
    return {
      trackTitle: track?.title ?? null,
      trackDurationSec: track?.durationSec ?? null,
      artist: album.artist || null,
      album: album.title || null,
      coverUrl: album.coverUrl || null
    };
  }
}

function findTrackInAlbums(
  albums: UnifiedAlbum[],
  trackId: string,
  albumIdHint?: string
): {
  trackTitle: string | null;
  trackDurationSec: number | null;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
} | null {
  const candidateAlbums = albumIdHint
    ? albums.filter((a) => a.sources.some((s) => s.externalAlbumId === albumIdHint))
    : albums;
  for (const a of candidateAlbums) {
    const tracks = a.tracks ?? [];
    const match = tracks.find((t) => t.trackId === trackId);
    if (!match) continue;
    const qobuzSource = a.sources.find((s) => s.source === "qobuz");
    return {
      trackTitle: match.title,
      trackDurationSec: match.durationSec,
      artist: a.artist,
      album: a.album,
      coverUrl: qobuzSource?.coverUrl ?? null
    };
  }
  return null;
}
