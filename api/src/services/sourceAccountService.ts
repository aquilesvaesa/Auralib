import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { QobuzLoginRejectedError } from "../providers/qobuzLoginError.js";
import { computeCombinedDiscographyConfidence } from "../providers/discographyConfidence.js";
import { clearLastfmTitleCache, fetchLastfmTopAlbumTitles, resolveLastfmApiKey } from "../providers/lastFmApiClient.js";
import { clearMusicBrainzReleaseGroupCache, fetchMusicBrainzReleaseGroupTitles } from "../providers/musicBrainzApiClient.js";
import {
  compareQobuzDiscographyAlbumsForDisplay,
  fetchArtistDiscography
} from "../providers/qobuzApiClient.js";
import type { QobuzDiscographyAlbum } from "../providers/qobuzApiClient.js";
import { decryptToken, encryptToken } from "../security/tokenCrypto.js";
import { createProviderRegistry } from "../providers/mockProviders.js";
import { SourceAccountStore } from "./sourceAccountStore.js";
import type {
  SourceAccount,
  SourceStatus,
  SourceType,
  SyncJob,
  UnifiedAlbum
} from "../types/domain.js";

function nowIso() {
  return new Date().toISOString();
}

type CachedDiscographyAlbum = QobuzDiscographyAlbum & { matchConfidence: number | null };

function buildArtistQueryCandidates(artistName: string): string[] {
  const base = artistName.trim();
  if (!base) return [];
  const out = new Set<string>([base]);
  const lowered = base.toLowerCase();
  const markers = [" feat. ", " feat ", " ft. ", " ft ", " featuring ", " & ", ",", ";", " x "];
  for (const marker of markers) {
    const idx = lowered.indexOf(marker);
    if (idx > 0) {
      const head = base.slice(0, idx).trim();
      if (head.length >= 2) out.add(head);
    }
  }
  return Array.from(out).slice(0, 4);
}

@Injectable()
export class SourceAccountService {
  private readonly providers = createProviderRegistry();
  /** Lista completa mergeada por usuario+artista (TTL corto) para paginar sin re-golpear Qobuz en cada página. */
  private readonly discographyListCache = new Map<
    string,
    { expiresAt: number; rows: CachedDiscographyAlbum[]; musicBrainzReferenceCount: number }
  >();
  private static readonly DISCOGRAPHY_CACHE_TTL_MS = 4 * 60 * 1000;
  private static readonly DISCOGRAPHY_MERGE_CAP = 280;

  constructor(@Inject(SourceAccountStore) private readonly store: SourceAccountStore) {}

  private clearDiscographyCacheForUser(userId: string): void {
    const prefix = `${userId}::`;
    for (const k of [...this.discographyListCache.keys()]) {
      if (k.startsWith(prefix)) this.discographyListCache.delete(k);
    }
  }

  async getDiscographyProviderStatus(userId: string): Promise<{
    lastFmKeySaved: boolean;
    lastFmEnvConfigured: boolean;
    musicBrainzEnabled: boolean;
  }> {
    const state = await this.store.getUserState(userId);
    return {
      lastFmKeySaved: Boolean(state.lastFmApiKeyEncrypted),
      lastFmEnvConfigured: resolveLastfmApiKey() !== null,
      musicBrainzEnabled: true
    };
  }

  /** Last.fm: clave del usuario o variable de entorno. */
  async getResolvedLastfmApiKey(userId: string): Promise<string | null> {
    const state = await this.store.getUserState(userId);
    const enc = state.lastFmApiKeyEncrypted;
    if (enc) {
      try {
        const p = decryptToken(enc).trim();
        if (p.length >= 8) return p;
      } catch {
        /* ignore */
      }
    }
    return resolveLastfmApiKey();
  }

  async setUserLastfmApiKey(userId: string, apiKey: string | null): Promise<void> {
    await this.store.mutateUserState(userId, (st) => {
      if (!apiKey?.trim()) {
        st.lastFmApiKeyEncrypted = null;
      } else {
        st.lastFmApiKeyEncrypted = encryptToken(apiKey.trim());
      }
      return undefined;
    });
    this.clearDiscographyCacheForUser(userId);
    clearLastfmTitleCache();
    clearMusicBrainzReleaseGroupCache();
  }

  async listAccounts(userId: string) {
    const userState = await this.store.getUserState(userId);
    return Object.values(userState.sourceAccounts).map((account) => this.accountPublicView(account));
  }

  async connect(userId: string, source: SourceType, body?: Record<string, unknown>) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    if (!account) return null;
    const provider = this.providers[source];

    const now = nowIso();
    let providerResult;
    try {
      providerResult = await provider.connect(body);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      if (msg === "QOBUZ_CREDENTIALS_REQUIRED") {
        throw new BadRequestException({
          error: { code: msg, message: "Indica email y contraseña de Qobuz para conectar." }
        });
      }
      if (err instanceof QobuzLoginRejectedError) {
        const hint =
          " ¿Entraste solo con Microsoft/Google en Qobuz? Crea también una contraseña en qobuz.com (Mi cuenta → Seguridad); la del correo no sirve para la API.";
        throw new UnauthorizedException({
          error: { code: "QOBUZ_LOGIN_FAILED", message: `${err.detail}${hint}` }
        });
      }
      if (msg === "QOBUZ_LOGIN_FAILED" || msg === "QOBUZ_TOKEN_VERIFY_FAILED") {
        throw new UnauthorizedException({
          error: { code: msg, message: "No se pudo validar las credenciales o el token Qobuz." }
        });
      }
      throw err;
    }
    account.status = "connected";
    account.externalUserId = providerResult.externalUserId;
    account.accessTokenEncrypted = encryptToken(providerResult.accessToken);
    account.refreshTokenEncrypted = encryptToken(providerResult.refreshToken || "_noop_refresh_");
    account.tokenExpiresAt = new Date(Date.now() + providerResult.expiresInSeconds * 1000).toISOString();
    account.lastVerifiedAt = now;
    account.updatedAt = now;
    if (source === "qobuz") {
      const aid = providerResult.qobuzApiAppId?.trim();
      account.qobuzApiAppId = aid && aid.length > 0 ? aid : null;
    }

    await this.store.mutateUserState(userId, () => undefined);
    return { source, status: account.status, account: this.accountPublicView(account) };
  }

  async callback(userId: string, input: {
    source: SourceType;
    code?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  }) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[input.source];
    if (!account) return null;
    const provider = this.providers[input.source];

    let providerResult;
    try {
      providerResult = await provider.callback(input);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      if (msg === "QOBUZ_TOKEN_REQUIRED" || msg === "QOBUZ_TOKEN_VERIFY_FAILED") {
        throw new UnauthorizedException({
          error: { code: msg, message: "Token Qobuz inválido o ausente." }
        });
      }
      throw err;
    }
    const now = nowIso();

    account.status = "connected";
    account.externalUserId = providerResult.externalUserId;
    account.accessTokenEncrypted = encryptToken(providerResult.accessToken);
    account.refreshTokenEncrypted = encryptToken(providerResult.refreshToken || "_noop_refresh_");
    account.tokenExpiresAt = new Date(Date.now() + providerResult.expiresInSeconds * 1000).toISOString();
    account.lastVerifiedAt = now;
    account.updatedAt = now;
    if (input.source === "qobuz") {
      const aid = providerResult.qobuzApiAppId?.trim();
      account.qobuzApiAppId = aid && aid.length > 0 ? aid : null;
    }
    await this.store.mutateUserState(userId, () => undefined);

    return {
      source: input.source,
      status: account.status,
      verifiedAt: account.lastVerifiedAt,
      account: this.accountPublicView(account)
    };
  }

  async verify(
    userId: string,
    source: SourceType
  ): Promise<
    | { kind: "not_found" }
    | { kind: "not_connected"; source: SourceType; status: SourceStatus; verifiedAt: string | null }
    | { kind: "decrypt_failed"; source: SourceType; status: SourceStatus; verifiedAt: string | null }
    | { kind: "expired"; source: SourceType; status: SourceStatus; verifiedAt: string | null }
    | { kind: "ok"; source: SourceType; ok: boolean; status: SourceStatus; verifiedAt: string | null }
  > {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    if (!account) return { kind: "not_found" };

    if (!account.accessTokenEncrypted) {
      account.status = "reconnect_required";
      account.updatedAt = nowIso();
      return {
        kind: "not_connected",
        source,
        status: account.status,
        verifiedAt: account.lastVerifiedAt
      };
    }

    const now = nowIso();
    const provider = this.providers[source];
    let accessToken = "";
    try {
      accessToken = decryptToken(account.accessTokenEncrypted);
    } catch {
      account.status = "error";
      account.updatedAt = now;
      return {
        kind: "decrypt_failed",
        source,
        status: account.status,
        verifiedAt: account.lastVerifiedAt
      };
    }

    if (!(await provider.verify(accessToken, { qobuzApiAppId: account.qobuzApiAppId })).ok) {
      account.status = "degraded";
      account.updatedAt = now;
      return { kind: "ok", source, ok: false, status: account.status, verifiedAt: account.lastVerifiedAt };
    }

    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() <= Date.now()) {
      account.status = "expired";
      account.updatedAt = now;
      return { kind: "expired", source, status: account.status, verifiedAt: account.lastVerifiedAt };
    }

    const ok = account.status === "connected";
    if (ok) {
      account.lastVerifiedAt = now;
      account.updatedAt = now;
    }
    await this.store.mutateUserState(userId, () => undefined);
    return { kind: "ok", source, ok, status: account.status, verifiedAt: account.lastVerifiedAt };
  }

  async disconnect(userId: string, source: SourceType) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    if (!account) return null;
    this.providers[source].disconnect();

    const now = nowIso();
    account.status = "disconnected";
    account.externalUserId = null;
    if (source === "qobuz") {
      account.qobuzApiAppId = null;
    }
    account.accessTokenEncrypted = null;
    account.refreshTokenEncrypted = null;
    account.tokenExpiresAt = null;
    account.updatedAt = now;

    await this.store.mutateUserState(userId, () => undefined);
    return { source, status: account.status, account: this.accountPublicView(account) };
  }

  private async syncLibrary(userId: string, source: SourceType) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    if (!account || account.status !== "connected") return null;
    if (!account.accessTokenEncrypted) return null;
    const accessToken = decryptToken(account.accessTokenEncrypted).trim();
    userState.bySourceAlbums[source] = await this.providers[source].syncFavorites({
      userId,
      accessToken,
      qobuzApiAppId: account.qobuzApiAppId
    });
    await this.store.mutateUserState(userId, () => undefined);
    return { source, synced: userState.bySourceAlbums[source].length };
  }

  async enqueueFavoritesSync(userId: string, source: SourceType) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    if (!account || account.status !== "connected") return null;

    const jobId = `sync-${++userState.syncJobCounter}`;
    const job: SyncJob = {
      id: jobId,
      source,
      status: "queued",
      createdAt: nowIso(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null
    };
    userState.syncJobs[job.id] = job;
    await this.store.mutateUserState(userId, () => undefined);

    setTimeout(async () => {
      const state = await this.store.getUserState(userId);
      const pendingJob = state.syncJobs[job.id];
      if (!pendingJob) return;
      pendingJob.status = "running";
      pendingJob.startedAt = nowIso();

      try {
        const syncResult = await this.syncLibrary(userId, source);
        if (!syncResult) throw new Error("SOURCE_NOT_CONNECTED");
        pendingJob.status = "completed";
        pendingJob.result = { synced: syncResult.synced };
        pendingJob.finishedAt = nowIso();
      } catch (error) {
        pendingJob.status = "failed";
        pendingJob.error = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        pendingJob.finishedAt = nowIso();
      }
      await this.store.mutateUserState(userId, () => undefined);
    }, 150);

    return { jobId: job.id, source: job.source, status: job.status, createdAt: job.createdAt };
  }

  async getSyncJob(userId: string, jobId: string) {
    const userState = await this.store.getUserState(userId);
    return userState.syncJobs[jobId] ?? null;
  }

  async getUnifiedLibraryWithQuery(userId: string, input: {
    q?: string;
    limit?: number;
    offset?: number;
    onlyFavorites?: boolean;
    mode?: "recent" | "artist";
  }) {
    const userState = await this.store.getUserState(userId);
    const allItems = this.flattenAlbumsConnectedOnly(userState);
    const filtered = this.filterAlbums(this.sortAlbums(allItems, input.mode), input.q, input.onlyFavorites);
    const items = this.paginateAlbums(filtered, input.limit, input.offset);
    return {
      items,
      total: filtered.length,
      limit: input.limit ?? filtered.length,
      offset: input.offset ?? 0,
      q: input.q ?? null,
      onlyFavorites: input.onlyFavorites ?? false,
      mode: input.mode ?? "recent"
    };
  }

  async getLibraryBySourceWithQuery(
    userId: string,
    source: SourceType,
    input: { q?: string; limit?: number; offset?: number; onlyFavorites?: boolean; mode?: "recent" | "artist" }
  ) {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts[source];
    const allItems =
      account?.status === "connected" ? (userState.bySourceAlbums[source] ?? []) : [];
    const filtered = this.filterAlbums(this.sortAlbums(allItems, input.mode), input.q, input.onlyFavorites);
    const items = this.paginateAlbums(filtered, input.limit, input.offset);
    return {
      source,
      items,
      total: filtered.length,
      limit: input.limit ?? filtered.length,
      offset: input.offset ?? 0,
      q: input.q ?? null,
      onlyFavorites: input.onlyFavorites ?? false,
      mode: input.mode ?? "recent"
    };
  }



  async getQobuzArtistDiscography(
    userId: string,
    artistName: string,
    options?: { limit?: number; offset?: number; excludeAlbumId?: string }
  ): Promise<{
    artist: string;
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    /** True si hay clave Last.fm (usuario o entorno). */
    lastFmConfigured: boolean;
    /** Cuántos release groups de MusicBrainz se usaron como referencia (0 si falló). */
    musicBrainzReferenceCount: number;
    items: Array<{
      albumId: string;
      title: string;
      artist: string;
      year: string;
      quality: string;
      coverUrl: string;
      category: "studio" | "live" | "ep_single" | "compilation" | "other";
      inLibrary: boolean;
      /** 0–100 combinando Last.fm + MusicBrainz; null sin referencias útiles. */
      matchConfidence: number | null;
    }>;
  }> {
    const userState = await this.store.getUserState(userId);
    const account = userState.sourceAccounts.qobuz;
    if (!account || account.status !== "connected" || !account.accessTokenEncrypted) {
      throw new UnauthorizedException({
        error: { code: "QOBUZ_NOT_CONNECTED", message: "Conecta Qobuz antes de consultar discografía." }
      });
    }

    const pageLimit = Math.max(1, Math.min(80, Math.round(options?.limit ?? 36)));
    const pageOffset = Math.max(0, Math.round(options?.offset ?? 0));
    const excludeId = (options?.excludeAlbumId ?? "").trim();

    const token = decryptToken(account.accessTokenEncrypted).trim();
    const env = account.qobuzApiAppId?.trim() ? { appId: account.qobuzApiAppId.trim() } : undefined;
    const cacheKey = `${userId}::${artistName.trim().toLowerCase()}`;
    const hit = this.discographyListCache.get(cacheKey);
    const lastFmKeyResolved = await this.getResolvedLastfmApiKey(userId);
    let merged: CachedDiscographyAlbum[];
    let musicBrainzReferenceCount = 0;
    if (hit && hit.expiresAt > Date.now()) {
      merged = hit.rows;
      musicBrainzReferenceCount = hit.musicBrainzReferenceCount ?? 0;
    } else {
      const mergeCap = SourceAccountService.DISCOGRAPHY_MERGE_CAP;
      const queries = buildArtistQueryCandidates(artistName);
      const artistTrim = artistName.trim();

      const [chunkGroups, lastFmTitles, mbTitles] = await Promise.all([
        Promise.all(
          queries.map((q) =>
            fetchArtistDiscography(token, q, env, mergeCap).catch(() => [] as QobuzDiscographyAlbum[])
          )
        ),
        fetchLastfmTopAlbumTitles(artistTrim, 120, lastFmKeyResolved).catch(() => [] as string[]),
        fetchMusicBrainzReleaseGroupTitles(artistTrim, 90).catch(() => [] as string[])
      ]);
      musicBrainzReferenceCount = mbTitles.length;

      const byAlbumId = new Map<string, QobuzDiscographyAlbum>();
      for (const chunk of chunkGroups) {
        for (const item of chunk) {
          if (!byAlbumId.has(item.albumId)) byAlbumId.set(item.albumId, item);
        }
      }

      merged = Array.from(byAlbumId.values()).map((row) => ({
        ...row,
        matchConfidence: computeCombinedDiscographyConfidence(row.title, row.year, lastFmTitles, mbTitles)
      }));

      merged.sort((a, b) => compareQobuzDiscographyAlbumsForDisplay(a, b));

      this.discographyListCache.set(cacheKey, {
        expiresAt: Date.now() + SourceAccountService.DISCOGRAPHY_CACHE_TTL_MS,
        rows: merged,
        musicBrainzReferenceCount
      });
    }

    const favorites = new Set(
      (userState.bySourceAlbums.qobuz ?? [])
        .flatMap((a) => a.sources)
        .filter((s) => s.source === "qobuz")
        .map((s) => s.externalAlbumId)
    );

    let rows = merged.map((d) => ({
      albumId: d.albumId,
      title: d.title,
      artist: d.artist,
      year: d.year,
      quality: d.quality,
      coverUrl: d.coverUrl,
      category: d.category,
      inLibrary: favorites.has(d.albumId),
      matchConfidence: d.matchConfidence
    }));
    if (excludeId) {
      rows = rows.filter((r) => r.albumId !== excludeId);
    }
    rows.sort((a, b) => compareQobuzDiscographyAlbumsForDisplay(a, b));
    const total = rows.length;
    const slice = rows.slice(pageOffset, pageOffset + pageLimit);
    const hasMore = pageOffset + slice.length < total;

    return {
      artist: artistName.trim(),
      total,
      offset: pageOffset,
      limit: pageLimit,
      hasMore,
      lastFmConfigured: Boolean(lastFmKeyResolved && lastFmKeyResolved.length >= 8),
      musicBrainzReferenceCount,
      items: slice
    };
  }

  private flattenAlbumsConnectedOnly(userState: {
    sourceAccounts: Record<SourceType, SourceAccount>;
    bySourceAlbums: Record<SourceType, UnifiedAlbum[]>;
  }): UnifiedAlbum[] {
    const sources: SourceType[] = ["qobuz"];
    const chunks: UnifiedAlbum[] = [];
    for (const s of sources) {
      const acc = userState.sourceAccounts[s];
      if (acc?.status !== "connected") continue;
      chunks.push(...(userState.bySourceAlbums[s] ?? []));
    }
    return chunks;
  }

  private accountPublicView(account: SourceAccount) {
    return {
      id: account.id,
      userId: account.userId,
      source: account.source,
      status: account.status,
      externalUserId: account.externalUserId,
      tokenExpiresAt: account.tokenExpiresAt,
      lastVerifiedAt: account.lastVerifiedAt,
      hasAccessToken: Boolean(account.accessTokenEncrypted),
      hasRefreshToken: Boolean(account.refreshTokenEncrypted),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }

  private filterAlbums(items: UnifiedAlbum[], q?: string, onlyFavorites?: boolean) {
    const filteredByFavorite = onlyFavorites ? items.filter((item) => item.isFavorite) : items;
    if (!q) return filteredByFavorite;
    const needle = q.trim().toLowerCase();
    if (!needle) return filteredByFavorite;
    return filteredByFavorite.filter(
      (item) =>
        item.artist.toLowerCase().includes(needle) ||
        item.album.toLowerCase().includes(needle) ||
        item.matchKey.toLowerCase().includes(needle)
    );
  }

  private sortAlbums(items: UnifiedAlbum[], mode: "recent" | "artist" = "recent") {
    const copy = [...items];
    if (mode === "artist") return copy.sort((a, b) => a.artist.localeCompare(b.artist));
    return copy.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  }

  private paginateAlbums(items: UnifiedAlbum[], limit?: number, offset?: number) {
    const safeOffset = Math.max(0, offset ?? 0);
    const fallbackLength = items.length > 0 ? items.length : 1;
    const safeLimit = Math.max(1, limit ?? fallbackLength);
    return items.slice(safeOffset, safeOffset + safeLimit);
  }
}

