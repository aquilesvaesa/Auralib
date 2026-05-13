import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";

import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { SourceAccountService } from "../services/sourceAccountService.js";
import type { SourceType } from "../types/domain.js";

function parseNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@Controller("/api/v1/library")
@UseGuards(AuthGuard)
export class LibraryController {
  constructor(
    @Inject(SourceAccountService) private readonly sourceAccountService: SourceAccountService
  ) {}

  @Get("unified")
  getUnified(
    @Req() req: AuthenticatedRequest,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("onlyFavorites") onlyFavorites?: string,
    @Query("mode") mode?: "recent" | "artist"
  ) {
    return this.sourceAccountService.getUnifiedLibraryWithQuery(req.user!.uid, {
      q,
      limit: parseNumber(limit),
      offset: parseNumber(offset),
      onlyFavorites: onlyFavorites === "true",
      mode
    });
  }

  @Get("by-source/:source")
  getBySource(
    @Req() req: AuthenticatedRequest,
    @Param("source") source: SourceType,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("onlyFavorites") onlyFavorites?: string,
    @Query("mode") mode?: "recent" | "artist"
  ) {
    return this.sourceAccountService.getLibraryBySourceWithQuery(req.user!.uid, source, {
      q,
      limit: parseNumber(limit),
      offset: parseNumber(offset),
      onlyFavorites: onlyFavorites === "true",
      mode
    });
  }



  @Get("qobuz/discography")
  async getQobuzDiscography(
    @Req() req: AuthenticatedRequest,
    @Query("artist") artist?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("excludeAlbumId") excludeAlbumId?: string
  ) {
    const name = (artist ?? "").trim();
    if (!name) {
      throw new HttpException(
        { error: { code: "ARTIST_REQUIRED", message: "Falta query param 'artist'." } },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.sourceAccountService.getQobuzArtistDiscography(req.user!.uid, name, {
      limit: parseNumber(limit),
      offset: parseNumber(offset),
      excludeAlbumId: (excludeAlbumId ?? "").trim() || undefined
    });
  }

  @Post("sync/:source")
  @HttpCode(HttpStatus.ACCEPTED)
  async sync(@Req() req: AuthenticatedRequest, @Param("source") source: SourceType) {
    const result = await this.sourceAccountService.enqueueFavoritesSync(req.user!.uid, source);
    if (!result) {
      throw new HttpException(
        { error: { code: "SOURCE_NOT_CONNECTED", message: "Conecta la fuente antes de sincronizar" } },
        HttpStatus.CONFLICT
      );
    }
    return result;
  }

  @Get("sync/jobs/:jobId")
  async getSyncJob(@Req() req: AuthenticatedRequest, @Param("jobId") jobId: string) {
    const job = await this.sourceAccountService.getSyncJob(req.user!.uid, jobId);
    if (!job) {
      throw new HttpException(
        { error: { code: "SYNC_JOB_NOT_FOUND", message: "Job no encontrado" } },
        HttpStatus.NOT_FOUND
      );
    }
    return job;
  }
}

