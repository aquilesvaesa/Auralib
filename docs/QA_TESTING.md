# QA / Testing — AuraLib

Guía para distribuir el APK a testers (con su HiBy R4 en su WiFi) sin pagar
los 25 USD de Play Console.

---

## Opciones de distribución

| Vía | Coste | Esfuerzo del tester | Recomendada para |
|-----|-------|----------------------|-------------------|
| `flutter run` por USB | 0 USD | Habilitar developer mode + USB debug | Owner/dev. |
| APK por Drive/Telegram | 0 USD | Habilitar "fuentes desconocidas" | 1-2 testers de confianza. |
| **Firebase App Distribution** ⭐ | 0 USD | Aceptar invitación por email + abrir link | **2-3 testers QA con HiBy.** |
| Google Play Internal Testing | 25 USD una vez | Aceptar invitación en Play | Cuando ya esté listo para Play. |

> Recomendación v1: **Firebase App Distribution**.

---

## Setup Firebase App Distribution

### Una sola vez (owner)

1. En la consola Firebase del proyecto AuraLib:
   - Activar **App Distribution**.
   - Crear un grupo de testers: `qa-band` (lo usaremos como alias).
   - Agregar emails de los testers.
2. Localmente:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

### En cada release

1. Construir el APK release:
   ```bash
   cd app
   flutter build apk --release \
     --dart-define=API_BASE_URL=https://tu-backend-en-cloud.com
   ```
   El APK queda en `app/build/app/outputs/flutter-apk/app-release.apk`.

2. Subir a App Distribution:
   ```bash
   firebase appdistribution:distribute \
     app/build/app/outputs/flutter-apk/app-release.apk \
     --app <FIREBASE_ANDROID_APP_ID> \
     --release-notes "Versión 0.1.x — cambios: ..." \
     --groups qa-band
   ```

3. Los testers reciben un email automático con link e instrucciones de instalación.

---

## Lo que el tester hace en su casa

1. Abre el email de Firebase App Distribution.
2. Acepta los términos y se descarga el "App Tester" (una sola vez).
3. Abre AuraLib desde el app tester.
4. Login con su cuenta (si todavía no tiene, registro desde la app).
5. Conecta Qobuz con su credencial.
6. Va a **Settings → DAC** y descubre su HiBy R4 en la WiFi.
7. Reproduce.

> No hace falta túnel. No hace falta cambiar URLs. La app es **una** y el
> backend **uno** (el de producción).

---

## Checklist de release

- [ ] `pubspec.yaml` con `version: X.Y.Z+N` actualizado.
- [ ] `flutter analyze` sin errores nuevos.
- [ ] `flutter test` pasa.
- [ ] `flutter build apk --release` exitoso.
- [ ] Login funciona (Firebase Auth de prod).
- [ ] Conectar Qobuz funciona.
- [ ] Sync de favoritos funciona.
- [ ] Reproducción local funciona (jack y BT).
- [ ] Descubrimiento DLNA encuentra el R4.
- [ ] Reproducción DLNA al R4 funciona.
- [ ] Pause / Resume / Seek funcionan en ambos modos.
- [ ] Notificación de MediaSession aparece y responde a controles.

---

## Diagnóstico común

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| "No encuentro el DAC" | AP isolation activo en el router; modo UPnP del R4 apagado | Desactivar AP isolation; activar modo UPnP en R4. |
| 401 al llamar al backend | Token Firebase expiró | Cerrar y abrir sesión. |
| 409 SOURCE_NOT_CONNECTED | El usuario no conectó Qobuz | Settings → Fuentes → conectar. |
| 409 QOBUZ_STREAM_UNAVAILABLE | Secret Qobuz desactualizado o cuenta sin permisos al formato pedido | Bajar formatId (ej: 7 en lugar de 27); reconectar Qobuz. |
| Audio se corta al bloquear pantalla | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` no concedido | Verificar permisos en Settings de Android. |

---

## Cuándo pasar a Play Store

Cuando los 3 testers den feedback OK durante 2 semanas seguidas sin bugs
bloqueantes, abrir la cuenta de Play Console (25 USD), subir el AAB a
Internal Testing y migrar a Closed/Open desde ahí.
