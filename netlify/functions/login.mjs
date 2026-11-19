import { configured, roleFor, sign, json, noConfig } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!configured()) return noConfig();
  let body;
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }
  const role = roleFor(String(body?.password ?? ""));
  if (!role) {
    await new Promise((r) => setTimeout(r, 700));   // frena intentos repetidos
    return json({ error: "Contraseña incorrecta" }, 401);
  }
  const { token, exp } = sign(role, role === "edit" ? 14 : 30);
  return json({ token, role, exp });
};
export const config = { path: "/api/login" };
