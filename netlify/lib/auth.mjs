// Autenticación por rol: "edit" (captura) y "view" (consulta).
// El token es un JSON firmado con HMAC-SHA256 (PP_SECRET). Incluye una huella de la
// contraseña del rol: si cambias la contraseña, las sesiones de ese rol dejan de servir.
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
export const LOCAL_KEYS = new Set(["pp.lastDate", "pp.view", "pp.lbl", "pp.seenVer", "pp.lastBackup"]);

export function configured() {
  return Boolean(env("PP_PASS_EDIT") && env("PP_PASS_VIEW") && env("PP_SECRET"));
}
const huella = (pw) => createHash("sha256").update(String(pw)).digest("hex").slice(0, 12);
export function safeEq(a, b) {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
}
export function roleFor(password) {
  if (safeEq(password, env("PP_PASS_EDIT"))) return "edit";
  if (safeEq(password, env("PP_PASS_VIEW"))) return "view";
  return null;
}
export function sign(role, days) {
  const pw = role === "edit" ? env("PP_PASS_EDIT") : env("PP_PASS_VIEW");
  const exp = Date.now() + days * 864e5;
  const p = Buffer.from(JSON.stringify({ r: role, exp, k: huella(pw) })).toString("base64url");
  const s = createHmac("sha256", env("PP_SECRET")).update(p).digest("base64url");
  return { token: `${p}.${s}`, exp };
}
export function verify(req) {
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [p, s] = t.split(".");
  if (!p || !s || !env("PP_SECRET")) return null;
  const e = createHmac("sha256", env("PP_SECRET")).update(p).digest("base64url");
  const a = Buffer.from(s), b = Buffer.from(e);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!o.exp || o.exp < Date.now()) return null;
    const pw = o.r === "edit" ? env("PP_PASS_EDIT") : env("PP_PASS_VIEW");
    if (o.k !== huella(pw)) return null;           // la contraseña del rol cambió
    return o;
  } catch { return null; }
}
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export const noConfig = () =>
  json({ error: "El servidor no está configurado: faltan las variables PP_PASS_EDIT, PP_PASS_VIEW o PP_SECRET en Netlify." }, 500);
