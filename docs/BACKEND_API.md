# Contrato del backend AuraLib API

Base URL: `http://localhost:3100` (dev), `https://...` (prod).
Todos los endpoints excepto `/health` requieren `Authorization: Bearer <ID-TOKEN-FIREBASE>`.
Errores siempre vuelven como JSON `{ error: { code, message, details? } }`.

---

## Health

### `GET /api/v1/health`
**Sin auth.** Devuelve `{ ok: true }`. Usado para verificar conectividad desde la app.

---

## Auth

### `GET /api/v1/auth/me`
Devuelve el `user` decodificado del ID token: `{ uid, email }`.

---

## Sources (cuentas externas)

### `GET /api/v1/sources`
Lista las fuentes vinculadas del usuario. Hoy: Qobuz.

### `POST /api/v1/sources/qobuz/connect`
Body: `{ email?, password? }` o vacío para login asistido.

### `POST /api/v1/sources/qobuz/callback`
Body: `{ accessToken?, refreshToken?, code?, expiresInSeconds? }`. Para flujo de paste-token.

### `POST /api/v1/sources/qobuz/verify`
Verifica que el token guardado siga válido. Códigos posibles:
- `200 ok`
- `404 UNKNOWN_SOURCE`
- `409 SOURCE_NOT_CONNECTED`
- `401 TOKEN_EXPIRED`
- `500 TOKEN_DECRYPT_FAILED`

### `POST /api/v1/sources/qobuz/disconnect`
Borra el token. 200 si se hizo.

---

## Library

### `GET /api/v1/library/unified`
Query: `q`, `limit`, `offset`, `onlyFavorites=true|false`, `mode=recent|artist`.
Devuelve `{ albums: UnifiedAlbum[], total }`.

### `GET /api/v1/library/by-source/qobuz`
Mismos query params que `unified`.

### `GET /api/v1/library/qobuz/discography?artist=...&limit=...&offset=...&excludeAlbumId=...`
Discografía Qobuz enriquecida con MusicBrainz + Last.fm. Devuelve algo como:

```ts
{
  artist: string,
  total: number,
  musicBrainzReferenceCount: number | null,
  items: Array<{
    canonicalAlbumId: string,
    title: string,
    year: string | null,
    coverUrl: string | null,
    category: 'studio' | 'compilation' | 'live' | 'ep_single' | 'other',
    confidencePercent: number | null,
    qobuzAlbumId: string,
    inLibrary: boolean
  }>
}
```

Orden garantizado: studio → compilation → live → ep_single → other; dentro de cada categoría por confianza desc + año desc.

### `POST /api/v1/library/sync/qobuz`
Encola un job de sync de favoritos. Devuelve `{ jobId }`.

### `GET /api/v1/library/sync/jobs/:jobId`
`{ id, source, status, createdAt, startedAt, finishedAt, result, error }`.

---

## Settings

### `GET /api/v1/settings/discography-providers`
Estado de proveedores de discografía: `{ lastfm: { configured, source }, musicbrainz: { configured } }`.

### `POST /api/v1/settings/lastfm-key`
Body `{ apiKey }`. Guarda la API key personal del usuario (cifrada server-side).

### `DELETE /api/v1/settings/lastfm-key`
Borra la API key personal. Vuelve a usar la global si existe.

---

## Qobuz (reproducción)  ⭐ NUEVO

### `POST /api/v1/qobuz/track-url`
Body:
```ts
{
  trackId: string,             // requerido
  albumId?: string,            // recomendado para metadata
  formatId?: 5 | 6 | 7 | 27    // opcional; si se omite, mejor calidad disponible
}
```

Respuesta 200:
```ts
{
  uri: string,                 // URL HTTPS firmada al CDN de Qobuz
  formatId: number,
  bitDepth: number | null,
  samplingRate: number | null,
  durationSec: number | null,
  metadata: {
    title: string,
    artist: string | null,
    album: string | null,
    albumArtUri: string | null,
    durationSec: number | null,
    mimeType: string           // "audio/flac", "audio/mpeg", ...
  }
}
```

Errores típicos:
- `400 TRACK_ID_REQUIRED`
- `409 SOURCE_NOT_CONNECTED`
- `409 TOKEN_DECRYPT_FAILED`
- `409 QOBUZ_STREAM_UNAVAILABLE` (con `details` para diagnóstico)

El cliente decide qué hacer con `uri`:
- **Local**: pasarla a `just_audio` (`AudioPlayer.setUrl(uri)`).
- **DLNA**: armar DIDL-Lite con `metadata` y mandar `SetAVTransportURI` al renderer.

---

## Tipos compartidos

```ts
type SourceType = "qobuz" | "youtube_music" | "spotify";

type UnifiedAlbum = {
  canonicalAlbumId: string;
  matchKey: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  addedAt?: string;
  isFavorite?: boolean;
  tracks?: Array<{ title: string; durationSec: number; trackId?: string }>;
  sources: Array<{
    source: SourceType;
    externalAlbumId: string;
    quality?: string;
    coverUrl?: string;
  }>;
};
```

---

## Cabeceras

- `Authorization: Bearer <ID-TOKEN-FIREBASE>` en todas las rutas autenticadas.
- `Content-Type: application/json` en POST/PATCH.
- En desarrollo se admite `Bearer dev:<uid>:<email>` para saltarse Firebase
  (sólo usar local; **no exponer en prod**).
