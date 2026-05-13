import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";

import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard.js";
import { SourceAccountService } from "../services/sourceAccountService.js";
import type { SourceType } from "../types/domain.js";

type SourceCallbackBody = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresInSeconds?: number;
};

type SourceConnectBody = {
  email?: string;
  password?: string;
};

@Controller("/api/v1/sources")
@UseGuards(AuthGuard)
export class SourcesController {
  constructor(
    @Inject(SourceAccountService) private readonly sourceAccountService: SourceAccountService
  ) {}

  @Get()
  listSources(@Req() req: AuthenticatedRequest) {
    return this.sourceAccountService.listAccounts(req.user!.uid);
  }

  @Post(":source/connect")
  async connect(
    @Req() req: AuthenticatedRequest,
    @Param("source") source: SourceType,
    @Body() body?: SourceConnectBody
  ) {
    const result = await this.sourceAccountService.connect(req.user!.uid, source, body as Record<string, unknown> | undefined);
    if (!result) {
      throw new HttpException(
        { error: { code: "UNKNOWN_SOURCE", message: "Fuente no soportada" } },
        HttpStatus.NOT_FOUND
      );
    }
    return result;
  }

  @Post(":source/callback")
  async callback(@Req() req: AuthenticatedRequest, @Param("source") source: SourceType, @Body() body: SourceCallbackBody) {
    const result = await this.sourceAccountService.callback(req.user!.uid, { source, ...body });
    if (!result) {
      throw new HttpException(
        { error: { code: "UNKNOWN_SOURCE", message: "Fuente no soportada" } },
        HttpStatus.NOT_FOUND
      );
    }
    return result;
  }

  @Post(":source/verify")
  async verify(@Req() req: AuthenticatedRequest, @Param("source") source: SourceType) {
    const result = await this.sourceAccountService.verify(req.user!.uid, source);
    switch (result.kind) {
      case "not_found":
        throw new HttpException(
          { error: { code: "UNKNOWN_SOURCE", message: "Fuente no soportada" } },
          HttpStatus.NOT_FOUND
        );
      case "not_connected":
        throw new HttpException(
          {
            source: result.source,
            ok: false,
            status: result.status,
            verifiedAt: result.verifiedAt,
            error: { code: "SOURCE_NOT_CONNECTED", message: "No hay token activo, reconecta la cuenta" }
          },
          HttpStatus.CONFLICT
        );
      case "decrypt_failed":
        throw new HttpException(
          {
            source: result.source,
            ok: false,
            status: result.status,
            verifiedAt: result.verifiedAt,
            error: { code: "TOKEN_DECRYPT_FAILED", message: "No se pudo verificar el token cifrado" }
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      case "expired":
        throw new HttpException(
          {
            source: result.source,
            ok: false,
            status: result.status,
            verifiedAt: result.verifiedAt,
            error: { code: "TOKEN_EXPIRED", message: "Token expirado, requiere refresh o reconexión" }
          },
          HttpStatus.UNAUTHORIZED
        );
      case "ok":
        return {
          source: result.source,
          ok: result.ok,
          status: result.status,
          verifiedAt: result.verifiedAt
        };
    }
  }

  @Post(":source/disconnect")
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: AuthenticatedRequest, @Param("source") source: SourceType) {
    const result = await this.sourceAccountService.disconnect(req.user!.uid, source);
    if (!result) {
      throw new HttpException(
        { error: { code: "UNKNOWN_SOURCE", message: "Fuente no soportada" } },
        HttpStatus.NOT_FOUND
      );
    }
    return result;
  }
}

