// Respaldos automáticos diarios (solo rol de captura).
// GET /api/snapshots           -> { days: ["2026-11-19", ...] }
// GET /api/snapshots?day=DIA   -> el documento de estado de ese día
import { verify, json, configured, noConfig } from "../lib/auth.mjs";
import { store } from "../lib/store.mjs";

export default async (req) => {
  if (!configured()) return noConfig();
  const who = verify(req);
  if (!who) return json({ error: "Sesión no válida o vencida" }, 401);
  if (who.r !== "edit") return json({ error: "Solo el acceso de captura puede ver los respaldos" }, 403);
  const s = store();
  const day = new URL(req.url).searchParams.get("day");
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "Fecha inválida" }, 400);
    const st = await s.get(`snap/${day}`, { type: "json" });
    return st ? json(st) : json({ error: "No hay respaldo de ese día" }, 404);
  }
  const { blobs } = await s.list({ prefix: "snap/" });
  return json({ days: blobs.map((b) => b.key.slice(5)).sort().reverse() });
};
export const config = { path: "/api/snapshots" };
