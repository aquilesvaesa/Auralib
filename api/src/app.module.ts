import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { FirebaseAuthService } from "./auth/firebase-auth.service.js";

import { HealthController } from "./health.controller.js";
import { LibraryController } from "./library/library.controller.js";
import { SettingsController } from "./settings/settings.controller.js";
import { QobuzController } from "./qobuz/qobuz.controller.js";
import { QobuzPlaybackService } from "./qobuz/qobuz-playback.service.js";
import { SourceAccountService } from "./services/sourceAccountService.js";
import { QobuzExtractorCredentialStore } from "./services/qobuzExtractorCredentialStore.js";
import { SourceAccountStore } from "./services/sourceAccountStore.js";
import { SourcesController } from "./sources/sources.controller.js";
import { QobuzSecretExtractorService } from "./providers/qobuzSecretExtractor.service.js";

@Module({
  controllers: [
    HealthController,
    AuthController,
    SourcesController,
    LibraryController,
    SettingsController,
    QobuzController
  ],
  providers: [
    FirebaseAuthService,
    AuthGuard,
    SourceAccountStore,
    QobuzExtractorCredentialStore,
    SourceAccountService,
    QobuzPlaybackService,
    QobuzSecretExtractorService
  ]
})
export class AppModule {}
