// Índices de días: se recalculan en el servidor a partir de las claves existentes, para que dos capturas
// simultáneas nunca dejen un día fuera de la lista. Mismo formato que guarda el cliente (JSON.stringify):
//   pp.dates       días con plan que tiene personal asignado, de más reciente a más antiguo
//   pp.asisDates   días con asistencia no vacía, ascendente
//   pp.relojDates  días con datos de reloj, ascendente
const reDia = (pre) => new RegExp("^" + pre.replace(/\./g, "\\.") + "(\\d{4}-\\d{2}-\\d{2})$");
const objNoVacio = (s) => { try { const o = JSON.parse(s); return !!o && typeof o === "object" && Object.keys(o).length > 0; } catch { return false; } };
const planConGente = (s) => { try { const o = JSON.parse(s); return !!o && typeof o === "object" && !!o.assign && Object.keys(o.assign).length > 0; } catch { return false; } };
export function recalcIdx(data) {
  const rp = reDia("pp.plan."), ra = reDia("pp.asis."), rr = reDia("pp.reloj.");
  const dates = [], asis = [], reloj = [];
  for (const [k, v] of Object.entries(data)) {
    let m;
    if ((m = rp.exec(k))) { if (planConGente(v)) dates.push(m[1]); }
    else if ((m = ra.exec(k))) { if (objNoVacio(v)) asis.push(m[1]); }
    else if ((m = rr.exec(k))) reloj.push(m[1]);
  }
  return {
    "pp.dates": JSON.stringify(dates.sort().reverse()),
    "pp.asisDates": JSON.stringify(asis.sort()),
    "pp.relojDates": JSON.stringify(reloj.sort()),
  };
}
