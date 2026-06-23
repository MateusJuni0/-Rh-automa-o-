/**
 * Content-Security-Policy estrita do renderer do overlay (APP-DESKTOP §10 hardening R2).
 * `script-src 'self'` (sem inline → corta XSS→RCE); `style-src` permite inline (estilos do HUD/React,
 * risco baixo). `connect-src` recebe a origem do WS de estado (wss://…) por config, nunca '*'.
 */

export interface CspOptions {
  /** Origens extra para `connect-src` (ex.: o WS de estado e a API Vera). */
  connectSrc?: readonly string[];
}

export function buildCsp({ connectSrc = [] }: CspOptions = {}): string {
  const connect = ["'self'", ...connectSrc].join(" ");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
