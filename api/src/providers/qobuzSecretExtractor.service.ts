import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

import {
  readCachedQobuzSecret,
  writeQobuzSecret,
  type QobuzSecretCacheEntry
} from "./qobuzSecretCache.js";

const QOBUZ_LOGIN_URL = "https://play.qobuz.com/login";
const QOBUZ_DISCOVER_URL = "https://play.qobuz.com/discover";
const QOBUZ_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_CHROME_PATHS_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Tiempo máx. para que el bundle del player exponga `window.rng` (red lenta / Qobuz pesado). */
const DEFAULT_WAIT_MS = 90_000;

/** Tiempo máx. del modo interactivo (login manual). 5 min cubre captcha + 2FA. */
const INTERACTIVE_WAIT_MS = 300_000;

/** Perfil persistente de Chrome: cookies de Qobuz sobreviven entre llamadas. */
const PROFILE_DIR = path.resolve(process.cwd(), ".data", "qobuz-puppeteer-profile");

/** Debug screenshots (PNG) cuando el login falla. */
const DEBUG_DIR = path.resolve(process.cwd(), ".data", "qobuz-debug");

function parseTimeoutMs(): number {
  const raw = process.env.QOBUZ_EXTRACTOR_TIMEOUT_MS;
  if (!raw) return DEFAULT_WAIT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 15_000 && n <= 300_000 ? n : DEFAULT_WAIT_MS;
}

function isHeadless(): boolean {
  return String(process.env.QOBUZ_EXTRACTOR_HEADLESS ?? "true").toLowerCase() !== "false";
}

export type ExtractCredentials = {
  email: string;
  password: string;
};

@Injectable()
export class QobuzSecretExtractorService {
  private readonly logger = new Logger("QobuzSecretExtractor");

  /** Devuelve el secret cacheado si existe y no expiró. */
  async getCachedSecret(): Promise<QobuzSecretCacheEntry | null> {
    return readCachedQobuzSecret();
  }

  /**
   * Lanza Chrome (perfil persistente) y extrae `window.rng.prototype.initialization()`.
   *
   * - Si el perfil ya tiene sesión Qobuz viva, salta el form y va directo a `/discover`.
   * - Si no, hace login con las credenciales recibidas (no se persisten aquí: viven sólo en este frame).
   * - Si la extracción es válida (32 hex), persiste el secret en cache (`.data/qobuz-secrets.json`).
   *
   * Las cookies del navegador sí se persisten (PROFILE_DIR), de modo que la próxima
   * extracción puede saltar el login completo.
   */
  async refreshFromBrowser(creds: ExtractCredentials): Promise<QobuzSecretCacheEntry> {
    const email = creds.email.trim();
    const password = creds.password;
    if (!email || !password) {
      throw new Error("Faltan credenciales (email + password) para refrescar el secret Qobuz.");
    }

    const chromePath = process.env.CHROME_PATH || DEFAULT_CHROME_PATHS_MAC;
    const waitMs = parseTimeoutMs();
    const headless = isHeadless();
    this.logger.log(
      `Lanzando Chrome (${headless ? "headless" : "con UI"}) para extraer secret Qobuz... (${chromePath}, timeout ${waitMs}ms, profile=${PROFILE_DIR})`
    );

    await mkdir(PROFILE_DIR, { recursive: true });

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless,
        userDataDir: PROFILE_DIR,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled"
        ]
      });
      const page = await this.preparePage(browser);

      // 1) Atajo: ¿ya hay sesión viva? Vamos directo a /discover.
      if (await this.tryUseExistingSession(page)) {
        this.logger.log("Sesión Qobuz preexistente detectada — saltando login.");
        return await this.extractRng(page, waitMs);
      }

      // 2) Sin sesión: ejecutar el flow de login completo.
      await this.runLoginFlow(page, email, password, waitMs);

      return await this.extractRng(page, waitMs);
    } catch (err) {
      // Capturamos screenshot para diagnóstico antes de propagar.
      const original = err instanceof Error ? err.message : String(err);
      const shotInfo = await this.captureDebugScreenshot(browser, "refresh");
      throw new Error(`${original}${shotInfo}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignored */
        }
      }
    }
  }

  /**
   * Modo interactivo: lanza Chrome con UI, abre `play.qobuz.com/login` y espera
   * hasta que el usuario complete el login a mano (captcha, 2FA, login social, etc.).
   * Cuando detecta sesión viva en `play.qobuz.com`, extrae `rng` y persiste el secret.
   * Las cookies se guardan en el perfil persistente: las próximas refresh pueden ir headless.
   */
  async refreshInteractive(): Promise<QobuzSecretCacheEntry> {
    const chromePath = process.env.CHROME_PATH || DEFAULT_CHROME_PATHS_MAC;
    const waitMs = INTERACTIVE_WAIT_MS;
    this.logger.log(
      `Lanzando Chrome con UI para login manual de Qobuz... (${chromePath}, timeout ${waitMs}ms, profile=${PROFILE_DIR})`
    );

    await mkdir(PROFILE_DIR, { recursive: true });

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: PROFILE_DIR,
        defaultViewport: null,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--start-maximized"
        ]
      });
      const page = await this.preparePage(browser);

      // Si ya hay sesión, no hace falta esperar al usuario.
      if (await this.tryUseExistingSession(page)) {
        this.logger.log("Sesión Qobuz preexistente — extrayendo sin intervención.");
        return await this.extractRng(page, DEFAULT_WAIT_MS);
      }

      await page.goto(QOBUZ_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      this.logger.log("Esperando a que completes el login manualmente en la ventana de Chrome...");

      // Esperar a que el usuario llegue a play.qobuz.com fuera de /login.
      await page.waitForFunction(
        () => {
          try {
            const h = (window.location.hostname || "").toLowerCase();
            const p = (window.location.pathname || "").toLowerCase();
            if (!h.includes("play.qobuz.com")) return false;
            return !p.includes("/login");
          } catch {
            return false;
          }
        },
        { timeout: waitMs, polling: 2000 }
      );

      this.logger.log("Sesión detectada en play.qobuz.com — extrayendo rng...");
      return await this.extractRng(page, DEFAULT_WAIT_MS);
    } catch (err) {
      const original = err instanceof Error ? err.message : String(err);
      const shotInfo = await this.captureDebugScreenshot(browser, "interactive");
      throw new Error(`${original}${shotInfo}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignored */
        }
      }
    }
  }

  /** Limpia el perfil persistente (cookies del extractor). Útil tras cambio de cuenta. */
  async clearProfile(): Promise<void> {
    const fs = await import("node:fs/promises");
    try {
      await fs.rm(PROFILE_DIR, { recursive: true, force: true });
      this.logger.log(`Perfil Puppeteer borrado: ${PROFILE_DIR}`);
    } catch (err) {
      this.logger.warn(
        `No se pudo borrar perfil Puppeteer: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers privados
  // ──────────────────────────────────────────────────────────────────────────

  private async preparePage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      try {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      } catch {
        /* ignored */
      }
    });
    // Qobuz se niega a renderizar el player web en viewports < 1024px.
    await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
    await page.setUserAgent(QOBUZ_BROWSER_UA);
    return page;
  }

  /**
   * Intenta usar la sesión preexistente del perfil persistente: va a `/discover`
   * y comprueba que NO haya redirección a `/login`. Devuelve `true` si sí hay sesión.
   */
  private async tryUseExistingSession(page: Page): Promise<boolean> {
    try {
      await page.goto(QOBUZ_DISCOVER_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await new Promise((r) => setTimeout(r, 1500));
      const url = page.url();
      return url.includes("play.qobuz.com") && !url.includes("/login");
    } catch {
      return false;
    }
  }

  /** Flow completo de login: play.qobuz.com → (a veces) www.qobuz.com/signin → play. */
  private async runLoginFlow(
    page: Page,
    email: string,
    password: string,
    waitMs: number
  ): Promise<void> {
    await page.goto(QOBUZ_LOGIN_URL, { waitUntil: "networkidle2", timeout: 45_000 });

    // Aceptar banner de cookies (si existe).
    await new Promise((r) => setTimeout(r, 1500));
    await this.acceptCookies(page);

    // Click en "Log in" (pantalla intermedia que añadió Qobuz recientemente).
    await new Promise((r) => setTimeout(r, 1200));
    await this.clickIntermediateLogin(page);
    await new Promise((r) => setTimeout(r, 1800));

    // Encontrar y rellenar el form (Qobuz puede usar email o name=username).
    const emailSel = await this.findFirstSelector(page, [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[id*="email"]',
      'input[id*="login"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ]);
    if (!emailSel) {
      throw new Error(
        "No se encontró el campo de email tras click en 'Log in'. Prueba modo interactivo (Chrome con UI)."
      );
    }
    await page.type(emailSel, email, { delay: 25 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 25 });
    await page.click('button[type="submit"], button[id*="submit"], button[id*="login"]');

    // Fase 1: play ya cargó el shell, O Qobuz redirigió al login central en www.qobuz.com/signin.
    this.logger.log("Esperando post-login (play o redirección a www.qobuz.com/signin)...");
    try {
      await page.waitForFunction(
        () => {
          try {
            const h = (window.location.hostname || "").toLowerCase();
            const path = (window.location.pathname || "").toLowerCase();
            const w = window as unknown as { rng?: unknown };
            if (typeof w.rng !== "undefined") return true;
            if (h.includes("play.qobuz.com")) {
              return (
                path.includes("/discover") ||
                path.includes("/home") ||
                path.includes("/playlists") ||
                path.includes("/library") ||
                path.includes("/search") ||
                path.includes("/album/") ||
                path.includes("/track/")
              );
            }
            if ((h === "www.qobuz.com" || h.endsWith(".qobuz.com")) && path.includes("/signin")) {
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        { timeout: waitMs }
      );
    } catch {
      const diag = await this.collectPageDiagnostics(page);
      throw new Error(
        `Tras enviar el login en play.qobuz.com, no hubo shell del player ni redirección a signin en ${waitMs}ms. ` +
          `¿Credenciales correctas, captcha o 2FA? Prueba modo interactivo. ${diag}`
      );
    }

    const urlAfterPlayLogin = page.url();
    if (urlAfterPlayLogin.includes("qobuz.com") && urlAfterPlayLogin.includes("/signin")) {
      await this.completeWwwQobuzSignIn(page, email, password, waitMs);
    }

    // Fase 2: si ya estamos en play pero `rng` aún no existe, forzar /discover.
    const needsDiscover = await page.evaluate(() => {
      try {
        const w = window as unknown as { rng?: unknown };
        if (typeof w.rng !== "undefined") return false;
        const h = (window.location.hostname || "").toLowerCase();
        if (!h.includes("play.qobuz.com")) return false;
        const p = window.location.pathname || "";
        return !p.includes("/discover");
      } catch {
        return true;
      }
    });
    if (needsDiscover) {
      this.logger.log("Abriendo /discover para forzar la carga del bundle (window.rng)...");
      await page.goto(QOBUZ_DISCOVER_URL, { waitUntil: "networkidle2", timeout: 60_000 });
    }
  }

  /** Espera `window.rng.prototype.initialization` y lo invoca. */
  private async extractRng(page: Page, waitMs: number): Promise<QobuzSecretCacheEntry> {
    // Aseguramos estar en /discover si no estamos ya: el bundle vive ahí.
    const url = page.url();
    if (!url.includes("play.qobuz.com") || url.includes("/login")) {
      await page.goto(QOBUZ_DISCOVER_URL, { waitUntil: "networkidle2", timeout: 60_000 });
    }

    this.logger.log("Esperando window.rng.prototype.initialization...");
    try {
      await page.waitForFunction(
        () => {
          try {
            const r = (window as unknown as { rng?: { prototype?: { initialization?: unknown } } }).rng;
            return typeof r?.prototype?.initialization === "function";
          } catch {
            return false;
          }
        },
        { timeout: waitMs }
      );
    } catch {
      const diag = await this.collectPageDiagnostics(page);
      throw new Error(
        `window.rng.prototype.initialization no estuvo disponible en ${waitMs}ms. ` +
          `Qobuz puede haber cambiado el bundle o bloquear headless. Prueba QOBUZ_EXTRACTOR_HEADLESS=false. ${diag}`
      );
    }

    const extracted = await page.evaluate(() => {
      try {
        const r = (window as unknown as { rng: { prototype: { initialization: () => string } } }).rng;
        const s = r.prototype.initialization();
        return typeof s === "string" ? s : null;
      } catch {
        return null;
      }
    });

    if (!extracted || typeof extracted !== "string") {
      throw new Error("La extracción de window.rng.prototype.initialization() devolvió vacío.");
    }

    const entry = await writeQobuzSecret(extracted, "puppeteer");
    this.logger.log(`Secret Qobuz refrescado: ${entry.secret.slice(0, 8)}... (TTL ${entry.ttlHours}h)`);
    return entry;
  }

  private async acceptCookies(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        const sels = [
          "#didomi-notice-agree-button",
          'button[id*="accept"]',
          "button[id*=onetrust-accept]",
          ".cky-btn-accept",
          '[aria-label="Aceptar"]',
          '[aria-label="Accept"]'
        ];
        for (const s of sels) {
          const b = document.querySelector(s) as HTMLElement | null;
          if (b) b.click();
        }
      })
      .catch(() => undefined);
  }

  /**
   * Click en el botón "Log in" de la pantalla intermedia de play.qobuz.com.
   * Incluye múltiples idiomas y selectores defensivos (puede ser <a>, <button>, <div role="button">).
   */
  private async clickIntermediateLogin(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        const re = /^(log\s*in|sign\s*in|iniciar\s*sesi[oó]n|conectar(?:se)?|connexion|se\s*connecter|anmelden)$/i;
        const nodes = Array.from(
          document.querySelectorAll(
            "button, a, [role='button'], span.button, div.button"
          )
        ) as HTMLElement[];
        // Intento exacto primero.
        for (const el of nodes) {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t.length > 0 && t.length < 30 && re.test(t)) {
            el.click();
            return;
          }
        }
        // Fallback: primer enlace cuyo href contenga "/login" o "/signin".
        const link = Array.from(document.querySelectorAll("a")).find((a) => {
          const href = (a.getAttribute("href") || "").toLowerCase();
          return href.includes("/login") || href.includes("/signin");
        }) as HTMLElement | undefined;
        if (link) link.click();
      })
      .catch(() => undefined);
  }

  private async findFirstSelector(page: Page, selectors: string[]): Promise<string | null> {
    for (const s of selectors) {
      try {
        await page.waitForSelector(s, { timeout: 4000, visible: true });
        return s;
      } catch {
        /* siguiente */
      }
    }
    return null;
  }

  /**
   * Qobuz redirige a veces desde play a `https://www.qobuz.com/signin?...`
   * (flujo OAuth + email). Hay que rellenar de nuevo email/contraseña y enviar
   * el formulario de la web principal; luego suele volver a `play.qobuz.com`.
   */
  private async completeWwwQobuzSignIn(
    page: Page,
    email: string,
    password: string,
    waitMs: number
  ): Promise<void> {
    this.logger.log("Completando login en www.qobuz.com/signin (segundo paso)...");
    await new Promise((r) => setTimeout(r, 1500));
    await this.acceptCookies(page);

    // Muchas veces el formulario email/contraseña está detrás de una pestaña o enlace "Email".
    await page
      .evaluate(() => {
        const nodes = Array.from(
          document.querySelectorAll("a, button, span, div[role='button'], label, p")
        ) as HTMLElement[];
        for (const el of nodes) {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (!t || t.length > 80) continue;
          if (
            /^(email|e-mail|correo)$/i.test(t) ||
            /continuar con (el |la )?correo|continuar con email|iniciar sesión con email|sign in with email|log in with email/i.test(
              t
            )
          ) {
            el.click();
            return;
          }
        }
      })
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 900));

    const setInputValue = async (selector: string, value: string) => {
      await page.waitForSelector(selector, { timeout: 10_000, visible: true });
      await page.evaluate(
        (sel, val) => {
          const el = document.querySelector(sel) as HTMLInputElement | null;
          if (!el) return;
          el.focus();
          el.value = "";
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        selector,
        value
      );
    };

    const emailSel = await this.findFirstSelector(page, [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      "#username",
      'input[id*="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]'
    ]);
    if (!emailSel) {
      throw new Error(
        "No se encontró el campo de email en www.qobuz.com/signin (¿captcha o página distinta?). " +
          "Prueba modo interactivo (Chrome con UI)."
      );
    }

    await setInputValue(emailSel, email);

    const passSel = 'input[type="password"], input[name="password"]';
    await setInputValue(passSel, password);

    this.logger.log("Enviando formulario www (Enter + clic botón)...");
    await page.focus(passSel);
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 2500));

    await page
      .evaluate(() => {
        const forms = Array.from(document.querySelectorAll("form"));
        for (const form of forms) {
          const pwd = form.querySelector('input[type="password"]');
          const mail = form.querySelector(
            'input[type="email"], input[name="email"], input[name="username"]'
          );
          if (!pwd || !mail) continue;
          const btn = form.querySelector(
            'button[type="submit"], input[type="submit"]'
          ) as HTMLElement | null;
          if (btn) {
            btn.click();
            return;
          }
        }
      })
      .catch(() => undefined);

    const evalPlayShell = () =>
      page.evaluate(() => {
        try {
          const h = (window.location.hostname || "").toLowerCase();
          const p = (window.location.pathname || "").toLowerCase();
          if (!h.includes("play.qobuz.com")) return false;
          return !p.includes("/login");
        } catch {
          return false;
        }
      });

    this.logger.log("Esperando sesión en play.qobuz.com (sin /login)...");
    const deadline = Date.now() + Math.min(waitMs, 60_000);
    while (Date.now() < deadline) {
      if (await evalPlayShell()) {
        this.logger.log("Sesión en play.qobuz.com detectada.");
        return;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }

    this.logger.log("Intentando abrir play.qobuz.com/discover con cookies de sesión...");
    await page.goto(QOBUZ_DISCOVER_URL, { waitUntil: "networkidle2", timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 2000));

    if (await evalPlayShell()) {
      return;
    }

    const diag = await this.collectPageDiagnostics(page);
    throw new Error(
      `No se estableció sesión en el player web tras www.qobuz.com/signin. ` +
        `Revisa credenciales, captcha o 2FA. Si usas solo redes sociales en Qobuz, activa contraseña en la cuenta. ` +
        `Si el problema persiste, prueba MODO INTERACTIVO (POST .../qobuz/refresh-secret/interactive). ${diag}`
    );
  }

  /** URL + título + snippet de texto visible para mensajes de error HTTP 502. */
  private async collectPageDiagnostics(page: Page): Promise<string> {
    try {
      const url = page.url();
      const title = await page.title();
      const snippet = await page.evaluate(() => {
        const body = document.body?.innerText ?? "";
        return body.replace(/\s+/g, " ").trim().slice(0, 280);
      });
      return `url=${url} title=${JSON.stringify(title)} text=${JSON.stringify(snippet)}`;
    } catch {
      return "(no se pudo leer diagnóstico de la página)";
    }
  }

  /**
   * Captura una screenshot de la primera página activa del browser (si lo hay).
   * Devuelve un sufijo " | screenshot=…" para anexar al mensaje de error,
   * vacío si no se pudo capturar.
   */
  private async captureDebugScreenshot(
    browser: Browser | null,
    tag: string
  ): Promise<string> {
    if (!browser) return "";
    try {
      await mkdir(DEBUG_DIR, { recursive: true });
      const pages = await browser.pages();
      const page = pages.find((p) => !p.isClosed()) ?? null;
      if (!page) return "";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = path.join(DEBUG_DIR, `qobuz-${tag}-${stamp}.png`);
      await page.screenshot({ path: file as `${string}.png`, fullPage: true });
      return ` | screenshot=${file}`;
    } catch {
      return "";
    }
  }
}
