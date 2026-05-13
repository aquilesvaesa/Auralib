import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { SourceAccountService } from "../services/sourceAccountService.js";

@Controller("/api/v1/settings")
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(@Inject(SourceAccountService) private readonly sourceAccountService: SourceAccountService) {}

  @Get("discography-providers")
  getDiscographyProviders(@Req() req: AuthenticatedRequest) {
    return this.sourceAccountService.getDiscographyProviderStatus(req.user!.uid);
  }

  @Post("lastfm-key")
  @HttpCode(HttpStatus.OK)
  async saveLastfmKey(@Req() req: AuthenticatedRequest, @Body() body: { apiKey?: string }) {
    const raw = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (raw.length > 0 && raw.length < 8) {
      return { saved: false, error: "La API key de Last.fm parece demasiado corta." };
    }
    await this.sourceAccountService.setUserLastfmApiKey(req.user!.uid, raw.length > 0 ? raw : null);
    return { saved: true };
  }

  @Delete("lastfm-key")
  @HttpCode(HttpStatus.OK)
  async clearLastfmKey(@Req() req: AuthenticatedRequest) {
    await this.sourceAccountService.setUserLastfmApiKey(req.user!.uid, null);
    return { cleared: true };
  }
}
