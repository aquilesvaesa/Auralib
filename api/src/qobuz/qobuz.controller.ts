import { BadRequestException, Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { QobuzPlaybackService, type ResolveTrackResult } from "./qobuz-playback.service.js";

type ResolveTrackBody = {
  trackId?: string;
  albumId?: string;
  formatId?: number;
};

@Controller("/api/v1/qobuz")
@UseGuards(AuthGuard)
export class QobuzController {
  constructor(
    @Inject(QobuzPlaybackService) private readonly playback: QobuzPlaybackService
  ) {}

  /**
   * Resuelve la URL streameable firmada de Qobuz + metadata para una pista.
   * El cliente decide qué hacer con esa URL (just_audio local o renderer DLNA).
   *
   * Body:
   *  - `trackId` (string, requerido)
   *  - `albumId` (string, opcional pero recomendado para metadata)
   *  - `formatId` (number, opcional: 5/6/7/27; si se omite se elige la mejor calidad)
   */
  @Post("track-url")
  async resolveTrackUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: ResolveTrackBody
  ): Promise<ResolveTrackResult> {
    const trackId = (body?.trackId ?? "").trim();
    if (!trackId) {
      throw new BadRequestException({
        error: { code: "TRACK_ID_REQUIRED", message: "trackId requerido" }
      });
    }
    return this.playback.resolveTrack(req.user!.uid, {
      trackId,
      albumId: body?.albumId?.trim() || undefined,
      formatId:
        typeof body?.formatId === "number" && Number.isFinite(body.formatId) ? body.formatId : undefined
    });
  }
}
