# Plan de integración por fases + pruebas visuales

Este documento amplía el orden de integración del cliente Flutter con el backend
([`BACKEND_API.md`](BACKEND_API.md)) y define **qué validar en pantalla** (teléfono y tablet)
**antes de dar por cerrada cada fase** y pasar a la siguiente.

Convención: repetir las pruebas en **móvil** (p. ej. S25) y en **tablet** (p. ej. SM X820),
salvo que la fila indique solo uno.

---

## Qué es Firebase en AuraLib (y qué no es)

| Pregunta | Respuesta breve |
|----------|-------------------|
| ¿Firebase guarda los usuarios? | **Sí, en el sentido de identidad:** [Firebase Authentication](https://firebase.google.com/docs/auth) guarda la **cuenta de acceso** (email/contraseña en v1) y emite el **ID token** (JWT) que la app envía al API. |
| ¿Firebase es la base de datos de la biblioteca / Qobuz / favoritos? | **No.** Esa información la persiste y expone el **backend NestJS** (tokens Qobuz cifrados, sync de favoritos, discografía, URLs de streaming, etc.). El backend valida el JWT con **Firebase Admin**. |
| ¿Usamos Firestore o Realtime Database en v1? | **No está en el diseño actual** del monorepo: el diagrama en [`ARCHITECTURE.md`](ARCHITECTURE.md) muestra Firebase **solo en la capa Auth** frente al Nest. Si más adelante se añade Firestore, sería decisión explícita nueva. |

En resumen: **Firebase = login y quién eres**; **Nest = qué música tienes y cómo hablar con Qobuz/DAC**.

---

## Regla general antes de cerrar cualquier fase

1. **Sin errores rojos** de Flutter en consola al navegar los flujos de la fase.
2. **Sin overflow** (rayas amarillas/negras) en las pantallas tocadas.
3. **Barra inferior o rail** sigue funcionando (cambio de pestaña, estado seleccionado).
4. **Tema oscuro** coherente (fondos, texto legible, botones visibles).
5. Si la fase usa **API**: probar al menos **éxito** y **un error legible** (snackbar / texto / pantalla de error), aunque sea forzando credencial mala o backend apagado.

---

## Fase 0 — `feature/phase-0-firebase-router` (cimientos)

**Objetivo:** Firebase opcional, guard de rutas, Dio + errores API, modo dev sin Firebase.

### Pruebas visuales obligatorias (checklist)

- [ ] Con sesión **no** iniciada (o sin `SKIP_FIREBASE` + sin login): se ve **Login** y el layout (logo, campos, botones) sin solaparse en móvil y tablet.
- [ ] Con **`SKIP_FIREBASE` + DEV_** definidos: al abrir la app entra al **shell** (Biblioteca por defecto); se ven **3 pestañas** (Biblioteca, Descubre, Ajustes) con icono y etiqueta correctos.
- [ ] En **tablet (≥600 dp)**: aparece **Navigation Rail** sin pantalla roja; en **≥900 dp** rail extendido sin crash.
- [ ] En **móvil**: **NavigationBar** inferior; cambiar de pestaña varias veces sin glitch permanente.
- [ ] Abrir **Ajustes** y volver a **Biblioteca**: el título de AppBar y el contenido son coherentes.
- [ ] Abrir **reproductor** (`/player`) desde Biblioteca y **cerrar**: vuelve al shell sin perder la pestaña activa.
- [ ] (Opcional) Forzar URL API incorrecta: aparece feedback razonable o log en debug; la app no queda en blanco eterno.

**Criterio de salida:** checklist completo en móvil + tablet; entonces se puede abrir **Fase 1**.

---

## Fase 1 — `feature/phase-1-auth` (cuenta)

**Objetivo:** Login, registro, logout reales con Firebase Auth; `GET /api/v1/auth/me` para validar sesión.

### Pruebas visuales obligatorias

- [ ] **Login:** email/contraseña visibles, teclado no tapa el botón principal; error de credenciales muestra mensaje claro (no solo consola).
- [ ] **Login correcto:** transición al shell (Biblioteca); barra/rail visible.
- [ ] **Registro** (si está en alcance): flujo completo hasta poder entrar al shell.
- [ ] **Logout** desde Ajustes: vuelve a pantalla Login; no queda “atascado” en una ruta del shell.
- [ ] **Cold start** con sesión ya guardada: abre directo al shell (sin pedir login de nuevo), salvo que hayáis decidido política distinta documentada.
- [ ] **Tablet:** mismos flujos; formularios centrados / ancho máximo razonable.

**Criterio de salida:** checklist + `flutter analyze` sin errores nuevos.

---

## Fase 2 — `feature/phase-2-sources-qobuz` (fuente Qobuz)

**Objetivo:** Conectar / verificar / desconectar Qobuz; UI de estado en Ajustes o `sources`.

### Pruebas visuales obligatorias

- [ ] Estado **“no conectado”**: copy y CTA claros (conectar).
- [ ] Durante **conexión**: indicador de carga (no UI congelada).
- [ ] Estado **“conectado”**: se ve confirmación (texto o chip); no overflow en tablet.
- [ ] **Desconectar:** vuelve a estado desconectado con mensaje coherente.
- [ ] **Error 401/409** del API: mensaje entendible (no pantalla vacía).
- [ ] Navegación atrás desde subpantallas de Qobuz conserva el shell.

**Criterio de salida:** checklist; datos reales o staging acordado.

---

## Fase 3 — `feature/phase-3-library-unified` (biblioteca lista)

**Objetivo:** `GET /library/unified`; rejilla/lista; filtros; búsqueda local.

### Pruebas visuales obligatorias

- [ ] **Lista vacía:** estado vacío con ilustración o texto alineado al diseño (sin listas rotas).
- [ ] **Con álbumes:** portadas alineadas, relación de aspecto correcta; scroll fluido.
- [ ] **Chips / filtros:** selección visual clara (activo vs inactivo); en tablet no se cortan en una sola fila sin scroll horizontal intolerable.
- [ ] **Búsqueda:** campo visible; resultados actualizan la lista; estado “sin resultados”.
- [ ] **Pull-to-refresh** (si aplica en esta fase): animación y feedback.

**Criterio de salida:** checklist en datos reales o caché de prueba documentada.

---

## Fase 4 — `feature/phase-4-library-sync-detail` (sync + detalle álbum)

**Objetivo:** Jobs de sync + pantalla detalle de álbum / tracks.

### Pruebas visuales obligatorias

- [ ] Botón **Sincronizar** (o equivalente): estado “en curso” visible; al terminar, mensaje o icono de éxito/error.
- [ ] **Detalle álbum:** portada, título, artista, lista de tracks legible; scroll en listas largas.
- [ ] **Tablet:** dos columnas o layout ancho si está definido; sin texto cortado a la mitad.
- [ ] **Error de job** (simulado): UI no se queda colgada en “cargando”.

**Criterio de salida:** checklist.

---

## Fase 5 — `feature/phase-5-discover-discography` (Descubre / discografía)

**Objetivo:** `GET /library/qobuz/discography` en pestaña Descubre; categorías ordenadas.

### Pruebas visuales obligatorias

- [ ] **Descubre** con datos: secciones por categoría (estudio, compilación, etc.) visualmente distinguibles (título de sección, separación).
- [ ] **Badges** “en biblioteca” / calidad: legibles sin solapar portada.
- [ ] **Paginación o scroll infinito:** no saltos bruscos ni duplicados visibles obvios.
- [ ] **Vacío / artista sin datos:** mensaje útil.
- [ ] **Tablet:** más columnas si aplica; rail + contenido sin solapamiento.

**Criterio de salida:** checklist.

---

## Fase 6 — `feature/phase-6-player-local-qobuz` (reproducción local)

**Objetivo:** `POST /qobuz/track-url` + `just_audio` + mini player + pantalla full.

### Pruebas visuales obligatorias

- [ ] **Selector** “este dispositivo” vs “DAC en red”: estado seleccionado claro (aunque DLNA sea fase 7).
- [ ] **Reproducción local:** barra de progreso avanza; portada y metadatos en pantalla full.
- [ ] **Mini player** (si está en shell): no tapa elementos críticos de la barra de navegación; se puede expandir o ir a full player.
- [ ] **Notificación** de medios: al bajar notificaciones, controles y metadatos visibles (Android).
- [ ] **Pausa / play** desde notificación y desde la app: coherente.
- [ ] **Interrupción** (llamada simulada o cambio de app): comportamiento aceptable sin crash visual.

**Criterio de salida:** checklist en dispositivo físico recomendado (audio real).

---

## Fase 7 — `feature/phase-7-upnp-dlna` (DAC en red)

**Objetivo:** Descubrimiento SSDP, selección de renderer, transporte DLNA.

### Pruebas visuales obligatorias

- [ ] Lista de **renderers**: vacío con mensaje de ayuda (AP isolation, etc.) vs lista con nombres legibles.
- [ ] **Seleccionar** renderer: feedback de selección y persistencia al volver a la pantalla.
- [ ] **Reproducir** en DAC: indicador “suena en …” visible donde se haya definido en UX.
- [ ] **Error de red** (DAC apagado): mensaje claro, sin pantalla roja.
- [ ] **Tablet:** misma lista usable en ancho grande.

**Criterio de salida:** checklist con HiBy R4 o renderer de prueba en la misma WiFi.

---

## Fase 8 — `feature/phase-8-settings-health` (ajustes avanzados + diagnóstico)

**Objetivo:** Last.fm key, proveedores, health, acerca de, override API (si aplica).

### Pruebas visuales obligatorias

- [ ] Pantalla **Last.fm / proveedores:** campos y estados “configurado / no configurado” claros.
- [ ] **Guardar** clave: confirmación o error visible.
- [ ] **Health / diagnóstico:** semáforo o texto “API arriba / abajo”, sesión, renderer (según diseño).
- [ ] **Acerca de:** versión y enlaces leibles; no desborda en móvil.
- [ ] **Override URL** (si existe): campo, validación, advertencia de staging.

**Criterio de salida:** checklist.

---

## Fase 9 — `feature/phase-9-polish-v1` (pulido)

**Objetivo:** Splash, ícono adaptive, animaciones SHOULD, alineación doc PRODUCT/tema.

### Pruebas visuales obligatorias

- [ ] **Cold start:** splash con logo correcto, sin flash blanco incómodo (modo oscuro).
- [ ] **Launcher:** ícono adaptive correcto (forma, fondo).
- [ ] **Transiciones** entre pantallas principales: sin parpadeos críticos.
- [ ] Revisión final **móvil + tablet** de todas las pestañas y flujos MUST de [`PRODUCT_GUIDE.md`](PRODUCT_GUIDE.md).

**Criterio de salida:** checklist + criterio de release para QA / App Distribution.

---

## Enlace con ramas

La tabla de ramas por fase sigue en [`BRANCHING_AND_INTEGRATION.md`](BRANCHING_AND_INTEGRATION.md) §7; este archivo es la **fuente de verdad** para el contenido técnico + QA visual por fase.
