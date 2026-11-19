import { getStore } from "@netlify/blobs";
// En pruebas locales se inyecta un almacén en memoria con globalThis.__PP_STORE__
export const store = () => globalThis.__PP_STORE__ || getStore({ name: "plan-personal", consistency: "strong" });
export const EMPTY = () => ({ v: 0, at: null, data: {} });
