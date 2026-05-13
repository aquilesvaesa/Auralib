# Guía de producto v1 — AuraLib

> Reemplaza a los proyectos previos `DacToDock` (Android nativo legacy) y
> `DacToDockWeb` (Angular). Documento de referencia para el desarrollo y el QA.

## 0. Identidad

- **Nombre**: AuraLib
- **Tagline**: *Tu biblioteca musical, sonando donde quieras.*
- **Plataforma v1**: Android 8.0+ (smartphones y tablets, layout adaptive).
- **Idioma UI v1**: Español (estructura preparada para multi-idioma).

## 1. Visión

Una sola app móvil donde el usuario:

1. Inicia sesión con su cuenta.
2. Conecta su servicio de música (v1: Qobuz).
3. Ve su biblioteca unificada y la discografía enriquecida (Last.fm + MusicBrainz).
4. Decide dónde sale el audio: **DAC en red** (R4 vía UPnP) o **este dispositivo**.
5. Reproduce con calidad hi-fi sin tocar nada raro.

Sin túneles, sin instalar utilidades extra, sin web.

## 2. Usuarios

- **Owner / dev**: uso diario con HiBy R4.
- **2-3 testers de QA**: cada uno con su HiBy R4 en su WiFi.
- **Beta abierta (futuro)**: usuarios con DAC DLNA o auriculares.

## 3. Funcionalidades v1 (alcance bloqueado)

> Prioridad: **MUST** = no se entrega sin esto · **SHOULD** = se intenta · **COULD** = si sobra tiempo.

### 3.1 Cuenta
- **MUST** Login email/contraseña (Firebase Auth).
- **MUST** Registro de cuenta nueva.
- **MUST** Logout.
- **SHOULD** Restablecer contraseña (link Firebase).
- **COULD** Login con Google.

### 3.2 Conectar fuente Qobuz
- **MUST** Conectar Qobuz con email + contraseña.
- **MUST** Conectar Qobuz pegando token de sesión.
- **MUST** Verificar / reconectar fuente.
- **MUST** Desconectar fuente.
- **SHOULD** Login asistido (extractor Puppeteer del backend) cuando Qobuz pide captcha.
- **MUST** Estado visible: conectado / expirado / requiere reconexión.

### 3.3 Biblioteca
- **MUST** Listado unificado de favoritos.
- **MUST** Listado por fuente.
- **MUST** Búsqueda local (artista / álbum).
- **MUST** Modos de orden: por artista / recientes.
- **MUST** Solo favoritos vs todo sincronizado.
- **MUST** Detalle de álbum: portada, año, calidad, tracks.
- **MUST** Sincronización manual con WorkManager + indicador.
- **SHOULD** Sincronización al abrir si pasaron N horas.
- **COULD** Caché offline de la lista.

### 3.4 Discografía enriquecida
- **MUST** Vista discografía Qobuz por artista, paginada.
- **MUST** Cruce con MusicBrainz y Last.fm (endpoints actuales del backend).
- **MUST** Orden por categoría: **estudio → compilación → en vivo → EP/singles → colaboraciones/otros**.
- **MUST** Marcar “en mi biblioteca” vs “no en favoritos”.
- **SHOULD** Porcentaje de confianza.
- **SHOULD** API key personal de Last.fm desde Settings.

### 3.5 Reproducción

#### Selector "dónde suena"
- **MUST** Dos modos visibles: **DAC en red (DLNA)** y **Este dispositivo**.
- **MUST** Mostrar la salida activa del sistema cuando es "este dispositivo".
- **SHOULD** Botón "Cambiar salida del sistema" (Output Switcher Android).

#### DAC en red (UPnP/DLNA)
- **MUST** Descubrir MediaRenderers en la WiFi (SSDP).
- **MUST** Seleccionar uno y guardar alias amigable.
- **MUST** Quitar selección.
- **MUST** Reproducir track Qobuz: la app pide la URL al backend (`POST /api/v1/qobuz/track-url`) y la manda al renderer.
- **MUST** Pause / Resume / Stop / Seek / Volume.
- **MUST** Estado de transporte (polling o eventos), tiempo actual.
- **SHOULD** Mensaje claro si el R4 no aparece (AP isolation, modo UPnP apagado).

#### Este dispositivo
- **MUST** Reproducir Qobuz con `just_audio` + `just_audio_background` (MediaSession).
- **MUST** Notificación con controles (play, pause, next, prev).
- **MUST** Soporte controles de auriculares y lockscreen.
- **SHOULD** Cola de reproducción básica.
- **COULD** Gapless (ya viene de ExoPlayer).

### 3.6 Reproductor (mini + full)
- **MUST** Mini player anclado abajo con portada, título, artista, play/pause, scrubber.
- **MUST** Pantalla full player con info de calidad (formato/bit/khz).
- **SHOULD** Indicador "suena en [renderer]" o "suena en este dispositivo (jack/BT/USB)".

### 3.7 Settings
- **MUST** Cuenta (email, logout, verificar API).
- **MUST** Qobuz (estado, conectar/desconectar, sync).
- **MUST** Discografía (Last.fm key, ver estado proveedores).
- **MUST** API base URL (avanzado): override del backend para staging.
- **SHOULD** Acerca de (versión, créditos, licencias).
- **COULD** Tema (sistema/oscuro/claro).

### 3.8 UI / UX
- **MUST** Material 3 + paleta cobre/grafito.
- **MUST** Layout adaptive: NavigationBar abajo en móvil, NavigationRail + 2 paneles en tablet.
- **MUST** Splash screen con logo.
- **MUST** Ícono de app (adaptive, mono, dark).
- **SHOULD** Animaciones de portada y transiciones suaves.
- **SHOULD** Haptics sutiles.
- **SHOULD** Pull-to-refresh en biblioteca.

### 3.9 Diagnóstico / errores
- **MUST** Health check visible (API arriba, sesión válida, renderer seleccionado).
- **MUST** Mensajes de error legibles.
- **SHOULD** Crashlytics opcional.

## 4. Fuera de v1 (registrado para futuro)

- iOS.
- Web (Flutter Web).
- Más fuentes: YouTube Music, Spotify, Tidal, Deezer.
- Chromecast.
- Roon Ready / AirPlay.
- Editor de playlists.
- Letras sincronizadas.
- Recomendaciones / "descubre".
- Compartir entre usuarios.
- Modo offline real (descargas).
- Ecualizador propio.

## 5. Naming descartados (por si vuelven a discusión)

Fonoteca, Tonebox, AuraDock, Highnote, DockPlay → todas viables; AuraLib ganó.

## 6. Lo que dejamos atrás

| Cosa anterior | Por qué se descarta |
|---------------|----------------------|
| Frontend Angular | Sirvió como prototipo de UX; no aporta a Android. |
| Cliente Android antiguo | Refactor sale más barato que adaptar. |
| Firebase Hosting | Innecesario para v1 móvil. |
| Túneles para QA (Cloudflare/Tailscale) | El dispositivo descubre el DAC solo. |
| Endpoints UPnP del backend | El cliente lo hace localmente. |
| `playbackState` server-side | El cliente sabe qué está sonando. |

Lo que **sí** se conserva: backend NestJS (cuentas, Qobuz, Last.fm, MusicBrainz, sync, Firebase Auth). Es trabajo caro y funciona.
