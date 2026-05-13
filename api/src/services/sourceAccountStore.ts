import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EncryptedSecret, SourceAccount, SourceType, SyncJob, UnifiedAlbum } from "../types/domain.js";

type UserState = {
  sourceAccounts: Record<SourceType, SourceAccount>;
  bySourceAlbums: Record<SourceType, UnifiedAlbum[]>;
  syncJobs: Record<string, SyncJob>;
  syncJobCounter: number;
  /** API key Last.fm del usuario (opcional); si falta se usa LASTFM_API_KEY del entorno. */
  lastFmApiKeyEncrypted?: EncryptedSecret | null;
};

type PersistedState = { users: Record<string, UserState> };

const STORE_DIR = path.resolve(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "source-account-store.json");

function nowIso() {
  return new Date().toISOString();
}

function buildAccount(userId: string, source: SourceType, id: string): SourceAccount {
  const ts = nowIso();
  return {
    id,
    userId,
    source,
    status: "disconnected",
    externalUserId: null,
    accessTokenEncrypted: null,
    refreshTokenEncrypted: null,
    tokenExpiresAt: null,
    lastVerifiedAt: null,
    createdAt: ts,
    updatedAt: ts
  };
}

function defaultUser(userId: string): UserState {
  return {
    sourceAccounts: {
      qobuz: buildAccount(userId, "qobuz", `srcacc-${userId}-qobuz`),
      youtube_music: buildAccount(userId, "youtube_music", `srcacc-${userId}-ytm`),
      spotify: buildAccount(userId, "spotify", `srcacc-${userId}-spotify`)
    },
    bySourceAlbums: { qobuz: [], youtube_music: [], spotify: [] },
    syncJobs: {},
    syncJobCounter: 0,
    lastFmApiKeyEncrypted: null
  };
}

@Injectable()
export class SourceAccountStore {
  private loaded = false;
  private state: PersistedState = { users: {} };

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      this.state = JSON.parse(await readFile(STORE_FILE, "utf8")) as PersistedState;
    } catch {
      this.state = { users: {} };
    }
    this.loaded = true;
  }

  private async persist() {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(this.state, null, 2), "utf8");
  }

  async getUserState(userId: string): Promise<UserState> {
    await this.ensureLoaded();
    if (!this.state.users[userId]) {
      this.state.users[userId] = defaultUser(userId);
      await this.persist();
    }
    return this.state.users[userId];
  }

  async mutateUserState<T>(userId: string, updater: (state: UserState) => T): Promise<T> {
    const state = await this.getUserState(userId);
    const result = updater(state);
    await this.persist();
    return result;
  }
}

