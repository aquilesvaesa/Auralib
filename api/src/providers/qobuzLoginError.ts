/** Error de login Qobuz con mensaje legible (API o red). */
export class QobuzLoginRejectedError extends Error {
  constructor(readonly detail: string) {
    super("QOBUZ_LOGIN_FAILED");
    this.name = "QobuzLoginRejectedError";
    Object.setPrototypeOf(this, QobuzLoginRejectedError.prototype);
  }
}
