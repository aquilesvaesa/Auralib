# Ejecución, pruebas y despliegue (AuraLib)

Este documento unifica **cómo levantar** el monorepo en desarrollo, **cómo probar** la app y el API, y **dónde puede vivir** el backend en producción. El cliente Flutter y el API Nest son **dos procesos distintos** en desarrollo; en producción el usuario solo instala la app y el API corre en **internet** (no en su PC).

---

## 1. Qué piezas hay y quién habla con quién

| Pieza | Rol |
|--------|-----|
| **`app/`** (Flutter) | UI, Firebase Auth en el teléfono, reproductor, DLNA, llama al API por HTTP. |
| **`api/`** (NestJS) | Valida el JWT de Firebase, guarda tokens Qobuz cifrados, biblioteca, sync, Last.fm/MusicBrainz, etc. |
| **Firebase** | Identidad (email/contraseña); emite el ID token que el API verifica. |
| **Qobuz / Last.fm / …** | El **backend** las llama con secretos; la app no embebe esas claves de servicio. |

En **desarrollo** sueles tener el Mac con el API en `localhost:3100` y el móvil o emulador apuntando a esa red. En **producción** despliegas el API en un host con HTTPS y la app se compila con `API_BASE_URL` apuntando a esa URL pública.

---

## 2. Requisitos previos

- **Node.js 20+** y **npm** (para `api/`).
- **Flutter** estable (SDK en `PATH`; ver `app/README.md`).
- **Android SDK** (emulador o dispositivo USB con depuración).
- **Proyecto Firebase** (Auth email/contraseña, `google-services.json`, cuenta de servicio para el Nest si usas verificación de tokens en el API).
- **Chrome/Chromium** en la máquina donde corre el API (el flujo Qobuz puede usar `puppeteer-core`; ver `api/README.md`).

---

## 3. Procedimiento de ejecución en local (orden recomendado)

### 3.1 Backend (`api/`)

```bash
cd api
cp .env.example .env
# Edita .env: Firebase, cifrado, Qobuz, etc. (ver comentarios en .env.example)
npm install
npm run dev
```

- El API escucha en **`http://0.0.0.0:3100`** o **`http://localhost:3100`** (según `main.ts`; lo habitual es puerto **3100**).
- Comprueba que responde:

```bash
curl -s http://localhost:3100/api/v1/health
# Debe devolver JSON con ok (según implementación actual).
```

Si `curl` falla, no sigas con la app hasta que el Nest arranque sin errores en consola.

### 3.2 Cliente Flutter (`app/`)

```bash
cd app
flutter pub get
# Si usas código generado (freezed, etc.):
# dart run build_runner build --delete-conflicting-outputs
```

**Firebase (opciones reales en tu máquina):**

- Coloca `android/app/google-services.json`.
- Genera `lib/firebase_options.dart` **en local** (no subas claves al repo):

```bash
./setup_local.sh
# o: dart run tool/sync_firebase_options.dart
```

**URL del API (`API_BASE_URL`):**

| Dónde ejecutas la app | Valor típico de `API_BASE_URL` |
|------------------------|----------------------------------|
| **Emulador Android** (en el mismo Mac que el API) | Por defecto **`http://10.0.2.2:3100`** (ya viene en `AppConfig`; es el “localhost” del Mac visto desde el emulador). |
| **Tablet / móvil físico** (misma Wi‑Fi que el Mac) | IP LAN del Mac, p. ej. **`http://192.168.1.5:3100`** (sustituye por tu IP; `ifconfig` / Preferencias del sistema → Red). Debes pasar: `--dart-define=API_BASE_URL=http://192.168.1.5:3100`. |

**Ejemplos de `flutter run`:**

```bash
# Emulador (API en el mismo Mac, puerto 3100)
cd app && flutter run

# Dispositivo físico
cd app && flutter run --dart-define=API_BASE_URL=http://TU_IP_LAN:3100
```

**Solo probar el API sin Firebase en el teléfono** (modo dev del Nest con bearer `dev:…`):

```bash
flutter run \
  --dart-define=SKIP_FIREBASE=true \
  --dart-define=DEV_AUTH_UID=testuid \
  --dart-define=DEV_AUTH_EMAIL=dev@example.com \
  --dart-define=API_BASE_URL=http://TU_IP_LAN:3100
```

Detalle del contrato: [`BACKEND_API.md`](BACKEND_API.md).

---

## 4. Procedimiento de prueba (smoke + fases)

### 4.1 Smoke rápido (manual)

1. **API:** `GET /api/v1/health` sin auth (desde el Mac o desde la red donde esté el API).
2. **App + Firebase:** login / registro; `GET /api/v1/auth/me` debe funcionar con el Bearer del ID token (lo hace la app tras login).
3. **Fuentes:** Ajustes → Fuentes Qobuz → debe cargar `GET /api/v1/sources` (sin timeout: revisa `API_BASE_URL` en físico).
4. **Errores:** corta el API o pon mala IP y comprueba que la app muestra mensaje claro (timeout / sin conexión), no pantalla en blanco.

### 4.2 Checklists por fase (UI)

Los criterios visuales y de salida por fase están en **[`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md)** (móvil + tablet donde aplique).

### 4.3 Pruebas automatizadas

- **API:** `cd api && npm test` (si el proyecto define tests).
- **Flutter:** `cd app && flutter analyze` (y `flutter test` cuando existan tests).

---

## 5. Dónde alojar el API (producción)

**No hay un proveedor único impuesto por el repo.** El API es un proceso Node/Nest que necesita:

- **HTTPS** público (certificado TLS; la app en release no debería hablar HTTP plano a arbitrarios).
- **Variables de entorno** (Firebase Admin, secretos de cifrado, Qobuz, Last.fm, etc.) gestionadas en el panel del proveedor o en un gestor de secretos.
- **Persistencia** si usáis almacenamiento en disco (el store JSON actual del API es adecuado para dev; en producción valorar volumen o base de datos según evolución).
- **Chrome/Chromium** si mantenéis el flujo con **Puppeteer** para Qobuz: muchos entornos **serverless** (función fría, sin navegador) **no** sirven tal cual. Opciones habituales:
  - **Máquina virtual / VPS** (Debian, Ubuntu) con Node + Chrome instalados.
  - **Contenedor** (Docker) en Kubernetes, ECS, etc., con imagen que incluya Chromium.
  - **PaaS** tipo **Railway**, **Render**, **Fly.io**, **DigitalOcean App Platform**, siempre que permitan proceso largo, disco o volumen, y dependencias del sistema.
  - **Google Cloud Run / AWS Fargate** solo si empaquetáis Chromium y aceptáis límites de CPU/memoria y cold start; hay que validar el flujo Puppeteer explícitamente.

**Firebase:** el mismo proyecto que usa la app debe ser el que use el Nest (**Firebase Admin**) para verificar los ID tokens.

**Dominio:** por ejemplo `https://api.tudominio.com` → ese valor es el que debe ir en **`API_BASE_URL`** al construir la app de producción (`--dart-define` o pipeline CI).

**La app en el teléfono del usuario** solo necesita esa URL y Firebase configurado; **no** necesita tu Mac encendido.

---

## 6. Despliegue de la app (cliente)

- **QA interna:** ver [`QA_TESTING.md`](QA_TESTING.md) (p. ej. Firebase App Distribution).
- **Play Store (futuro):** build firmado, políticas de datos, etc.; la `API_BASE_URL` de producción debe estar inyectada en el pipeline de release.

---

## 7. Documentación relacionada

| Documento | Contenido |
|-----------|-------------|
| [`app/README.md`](../app/README.md) | Bootstrap Flutter, Firebase, `setup_local.sh`, `SKIP_FIREBASE`. |
| [`api/README.md`](../api/README.md) | Setup Nest, `.env`, Puppeteer, puerto y emulador vs físico. |
| [`BACKEND_API.md`](BACKEND_API.md) | Contrato REST, códigos de error, auth. |
| [`INTEGRATION_PLAN.md`](INTEGRATION_PLAN.md) | Fases y pruebas visuales por fase. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Decisiones de arquitectura. |

---

## 8. Resumen en una frase

**Desarrollo:** levantas **API** y **app** en dos terminales y alineas red + `API_BASE_URL`. **Producción:** subes el **API** a un hosting con HTTPS y variables de entorno, y publicas la **app** apuntando a esa URL; el usuario final no ejecuta el monorepo en su PC.
