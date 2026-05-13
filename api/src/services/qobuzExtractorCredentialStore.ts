import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { encryptToken, decryptToken } from "../security/tokenCrypto.js";
import type { EncryptedSecret } from "../types/domain.js";

/**
 * Credenciales Qobuz (email + contraseña web) usadas **sólo** para que el
 * extractor Puppeteer pueda hacer login en play/www y obtener el
 * `appSecret` de runtime. Se guardan **cifradas** con la misma clave AES
 * que el resto de tokens (`TOKEN_ENCRYPTION_KEY`).
 *
 * No sustituyen al `user_auth_token` de la API Qobuz (eso sigue en
 * SourceAccountStore); son un par adicional opcional por usuario.
 */
type StoredRow = {
  emailEncrypted: EncryptedSecret;
  passwordEncrypted: EncryptedSecret;
  savedAt: string;
};

type PersistedFile = {
  users: Record<string, StoredRow>;
};

const STORE_DIR = path.resolve(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "qobuz-extractor-credentials.json");

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

@Injectable()
export class QobuzExtractorCredentialStore {
  private loaded = false;
  private file: PersistedFile = { users: {} };

  async save(userId: string, email: string, password: string): Promise<void> {
    const em = email.trim();
    const pw = password;
    if (!em || !pw) throw new Error("Email y contraseña son obligatorios para guardar.");
    await this.ensureLoaded();
    this.file.users[userId] = {
      emailEncrypted: encryptToken(em),
      passwordEncrypted: encryptToken(pw),
      savedAt: new Date().toISOString()
    };
    await this.persist();
  }

  async clear(userId: string): Promise<void> {
    await this.ensureLoaded();
    if (userId in this.file.users) {
      delete this.file.users[userId];
      await this.persist();
    }
  }

  /** Devuelve credenciales en claro sólo en memoria (p. ej. para Puppeteer). */
  async get(userId: string): Promise<{ email: string; password: string } | null> {
    await this.ensureLoaded();
    const row = this.file.users[userId];
    if (!row) return null;
    try {
      return {
        email: decryptToken(row.emailEncrypted).trim(),
        password: decryptToken(row.passwordEncrypted)
      };
    } catch {
      return null;
    }
  }

  async getStatus(userId: string): Promise<{ hasCredentials: boolean; emailHint?: string }> {
    await this.ensureLoaded();
    const row = this.file.users[userId];
    if (!row) return { hasCredentials: false };
    try {
      const email = decryptToken(row.emailEncrypted).trim();
      return { hasCredentials: true, emailHint: maskEmail(email) };
    } catch {
      return { hasCredentials: false };
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw) as PersistedFile;
      if (parsed && typeof parsed === "object") {
        this.file = { users: parsed.users ?? {} };
      }
    } catch {
      this.file = { users: {} };
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(this.file, null, 2), "utf8");
  }
}
