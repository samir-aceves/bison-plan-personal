// Estado compartido: un solo documento { v, at, data } donde data guarda las claves pp.* de la app.
// GET  /api/state?v=N  -> 204 si no hay cambios desde la versión N; si no, el documento completo.
// POST /api/state      -> { set:{clave:valor}, del:[clave], replace:{...} }  (solo rol de captura)
// Antes del primer cambio de cada día se guarda una copia en snap/AAAA-MM-DD.
import { verify, json, configured, noConfig, LOCAL_KEYS } from "../lib/auth.mjs";
import { store, EMPTY } from "../lib/store.mjs";

const MAX = 8 * 1024 * 1024;
const valida = (k, v) => typeof k === "string" && k.startsWith("pp.") && !LOCAL_KEYS.has(k) && typeof v === "string" && k.length < 200;

export default async (req) => {
  if (!configured()) return noConfig();
  const who = verify(req);
  if (!who) return json({ error: "Sesión no válida o vencida" }, 401);
  const s = store();

  if (req.method === "GET") {
    const st = (await s.get("state", { type: "json" })) || EMPTY();
    const v = new URL(req.url).searchParams.get("v");
    if (v !== null && Number(v) === st.v) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    return json(st);
  }

  if (req.method === "POST") {
    if (who.r !== "edit") return json({ error: "Tu acceso es de consulta: no puede guardar cambios" }, 403);
    const raw = await req.text();
    if (raw.length > MAX) return json({ error: "La información enviada es demasiado grande" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Solicitud inválida" }, 400); }
    const st = (await s.get("state", { type: "json" })) || EMPTY();
    const dia = new Date().toISOString().slice(0, 10);
    if (st.v > 0 && !(await s.getMetadata(`snap/${dia}`))) await s.setJSON(`snap/${dia}`, st);
    if (body.replace && typeof body.replace === "object") {
      st.data = {};
      for (const [k, v] of Object.entries(body.replace)) if (valida(k, v)) st.data[k] = v;
    }
    if (body.set && typeof body.set === "object") for (const [k, v] of Object.entries(body.set)) if (valida(k, v)) st.data[k] = v;
    if (Array.isArray(body.del)) for (const k of body.del) if (typeof k === "string") delete st.data[k];
    st.v = (st.v || 0) + 1;
    st.at = new Date().toISOString();
    await s.setJSON("state", st);
    return json({ v: st.v, at: st.at });
  }
  return json({ error: "Método no permitido" }, 405);
};
export const config = { path: "/api/state" };
