import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { FirebaseAuthService, type AuthUser } from "./firebase-auth.service.js";

export type AuthenticatedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  user?: AuthUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(FirebaseAuthService) private readonly firebaseAuthService: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = req.headers?.authorization as string | undefined;
    const user = await this.firebaseAuthService.verifyBearerToken(authorization);
    req.user = user;
    return true;
  }
}

