import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard.js";

@Controller("/api/v1/auth")
export class AuthController {
  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { user: req.user };
  }
}

