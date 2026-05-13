# Plan de ramas e integración desde apps heredadas

Referencia para no perder la **interfaz ya validada** en `DacToDock` (Android nativo) y
`DacToDockWeb` (Angular), mientras se portan capacidades a AuraLib (Flutter).

## 1. Modelo de ramas (recomendado)

| Rama | Propósito |
|------|-----------|
| `main` | Siempre desplegable: build OK, sin features a medias. Solo merge vía PR. |
| `develop` | Tronco de integración UX + features (AuraLib día a día). |
| `feature/<area>-<tema-corto>` | Una capacidad acotada (ej. `feature/auth-firebase-login`). |
| `fix/<tema>` | Correcciones sin nueva funcionalidad. |

**Flujo:** `feature/*` → PR contra `develop` (o `main` si no usas develop) → revisión ligera
(analyze + pruebas manuales en tablet/teléfono) → merge.

**Convención de commits:** mensajes claros en inglés o español, una idea por commit; enlazar
issue/Notion si lo usan.

## 2. Preservar la UI validada (obligatorio en cada PR)

1. **Inventario visual legacy** (una sola vez, puede vivir en carpeta privada o wiki):
   - Capturas por pantalla de **DacToDock** y **DacToDockWeb** (flujos críticos: login,
     biblioteca, álbum, reproductor mini/full, settings Qobuz/DAC, errores comunes).
   - Anotar **densidades** probadas (teléfono + tablet).

2. **Contrato de diseño en Flutter** (ya iniciado en [`app/lib/shared/theme/app_theme.dart`](../app/lib/shared/theme/app_theme.dart)):
   - No cambiar semillas de color / tipografía de forma “casual”; los cambios van en PR
     dedicado `feature/ui-tokens-...` con capturas antes/después.
   - Nuevas pantallas deben **reutilizar** `AppTheme`, componentes en `shared/widgets/`, y
     mismas jerarquías (app bar, bottom nav / rail según ancho) que defina el parity con legacy.

3. **Checklist de paridad por feature** (copiar al PR):
   - [ ] Misma información visible que en la app antigua (campos, estados vacío/error).
   - [ ] Tablet (ej. SM X820) y teléfono sin overflow; navegación usable.
   - [ ] Accesibilidad básica: contraste similar al legacy, targets táctiles ≥ 48 dp donde aplique.

4. **No mezclar** en un mismo PR “lógica nueva” + “rediseño masivo”; el rediseño se hace
   explícito y con referencias a capturas legacy.

## 3. Orden sugerido de integración (alineado a MUST en PRODUCT_GUIDE)

Portar por **valor vertical** delgado antes que pantallas sueltas:

1. **Auth Firebase** — login / registro / logout; rutas protegidas en `go_router`.
2. **Fuentes Qobuz** — conectar / estado / desconectar; pantallas en `features/sources`.
3. **Biblioteca** — lista favoritos, búsqueda local, orden; `features/library`.
4. **Detalle álbum + sync manual** — acuerdo con backend existente.
5. **Reproducción “este dispositivo”** — `just_audio` + cola mínima + mini/full player.
6. **Selector de salida + UPnP** — discovery SSDP, renderer, transporte (puede requerir
   `MethodChannel` nativo según [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)).
7. **Discografía enriquecida** — vistas y orden por categorías.
8. **Settings restantes** — Last.fm key, QA, about.

Cada bloque = **una o varias ramas `feature/...`** que se pueden mergear de forma independiente
si el contrato API está listo.

## 4. Referencias en disco (solo lectura durante el port)

- `../DacToDock` — layouts, strings, flujos Android legacy.
- `../DacToDockWeb` — flujos web y textos de error/éxito.

No copiar código legacy a ciegas: **reimplementar en Flutter** usando la documentación viva
en [`docs/PRODUCT_GUIDE.md`](PRODUCT_GUIDE.md) y [`docs/BACKEND_API.md`](BACKEND_API.md).

## 5. Shell principal en Flutter (navegación actual)

Tres destinos: **Biblioteca**, **Descubre**, **Ajustes**. Barra inferior en móvil (`<600dp`)
y **Navigation Rail** en tablet (`≥600dp`).

| Ruta | Pestaña |
|------|---------|
| `/biblioteca` | Biblioteca |
| `/descubre` | Descubre |
| `/ajustes` | Ajustes |

El reproductor a pantalla completa vive en `/player` (fuera del shell).

Redirecciones por compatibilidad: `/library` → `/biblioteca`; rutas antiguas `/monitor`, `/inspector` → destinos actuales.

## 6. Próximos pasos inmediatos (esta semana)

1. La rama **`develop`** es el tronco de trabajo UX + features; `main` queda para releases estables.
2. Añadir **capturas legacy** + checklist mínimo al primer PR de auth o biblioteca.
3. Abrir primera rama `feature/auth-firebase-bootstrap` (o nombre acordado): `flutterfire configure`,
   pantallas conectadas al shell y tema, sin saltarse el checklist de paridad.
4. En paralelo, listar **pantallas DacToDock/DacToDockWeb** vs rutas `app_router.dart` actuales
   para ver huecos.

## 7. Ramas por fase (integración)

| Rama | Contenido |
|------|------------|
| `feature/phase-0-firebase-router` | Firebase init, guard `go_router`, `ApiError` + Dio, modo `SKIP_FIREBASE` / bearer dev. |
| `feature/phase-1-auth` | Login/registro/logout reales (siguiente). |
| … | Fases 2+ según plan de integración. |

---

Este documento es vivo: actualizar el orden si el backend bloquea o desbloquea un bloque.
