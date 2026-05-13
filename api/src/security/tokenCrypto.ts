import crypto from "node:crypto";

import type { EncryptedSecret } from "../types/domain.js";

function resolveTokenEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY ?? "local-dev-token-key-change-me";
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

const TOKEN_KEY = resolveTokenEncryptionKey();

export function encryptToken(plainText: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", TOKEN_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

export function decryptToken(secret: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    TOKEN_KEY,
    Buffer.from(secret.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.data, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

