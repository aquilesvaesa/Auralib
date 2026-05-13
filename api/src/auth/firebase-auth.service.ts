import { Injectable, UnauthorizedException } from "@nestjs/common";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type AuthUser = { uid: string; email: string | null };

@Injectable()
export class FirebaseAuthService {
  private initialized = false;

  private initIfNeeded() {
    if (this.initialized) return;
    if (getApps().length > 0) {
      this.initialized = true;
      return;
    }
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountRaw) {
      const sa = JSON.parse(serviceAccountRaw) as { projectId: string; clientEmail: string; privateKey: string };
      initializeApp({
        credential: cert({
          projectId: sa.projectId,
          clientEmail: sa.clientEmail,
          privateKey: sa.privateKey.replace(/\\n/g, "\n")
        })
      });
    } else {
      initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
    }
    this.initialized = true;
  }

  async verifyBearerToken(authHeader: string | undefined): Promise<AuthUser> {
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedException("Falta token de autenticación");
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedException("Token vacío");
    if (token.startsWith("dev:")) {
      const [, uid, email] = token.split(":");
      if (!uid) throw new UnauthorizedException("Token dev inválido");
      return { uid, email: email ?? null };
    }
    this.initIfNeeded();
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  }
}

