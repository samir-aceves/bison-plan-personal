"""Genera public/index.html (versión Netlify) a partir del archivo de la app local.

Uso:  python3 tools/build_server.py "Plan de personal v2.8.html" public/index.html

Qué cambia respecto al archivo local:
  - Quita los datos de personal incluidos (base, vacantes y faltas): en Netlify la
    página es pública y los datos solo llegan desde /api/state después de entrar.
  - Agrega la pantalla de acceso con contraseña y el arranque que descarga los datos
    compartidos antes de iniciar la app.
"""
import re
import sys

src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding="utf8").read()


def sub1(pattern, repl, flags=0):
    global h
    h, n = re.subn(pattern, lambda m: repl, h, count=1, flags=flags)
    assert n == 1, f"no se encontró: {pattern[:60]}"


# 1) sin datos personales en la página pública
sub1(r"const BASE_ROSTER = \[.*?\];\n", "const BASE_ROSTER = [];\n")
sub1(r"const BASE_VAC = \[.*?\];\n", "const BASE_VAC = [];\n")
sub1(r"const BASE_ASIS = \{.*?\};\n", "const BASE_ASIS = {};\n")
sub1(r"const BASE_CHANGES = \{.*?\};\n", 'const BASE_CHANGES = {fecha:"",archivo:"",altas:[],bajas:[],cambios:[]};\n', re.S)
for nombre in ("VERA ACOSTA", "GALLEGOS GUTIERREZ", "MARQUEZ GARCIA GERARDO"):
    assert nombre not in h, f"quedó un nombre en la página: {nombre}"

# 2) la app espera a que el arranque traiga los datos
idx = h.rfind("<script>")
assert idx > 0
h = h[:idx] + '<script type="text/plain" id="app-main">' + h[idx + len("<script>"):]

# 3) no indexar
h = h.replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">', 1)

AUTH_CSS = r"""
/* ---------- acceso (patrón formulario de acceso) ---------- */
body.booting>header.top,body.booting>.toolbar,body.booting>.layout{display:none!important}
.auth{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg)}
.auth-card{width:100%;max-width:400px;background:var(--panel);border:1px solid var(--tilebd);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);padding:32px;display:flex;flex-direction:column;gap:8px}
.auth-card h1{font-family:var(--cond);font-size:28px;font-weight:600;line-height:1.2;margin:0}
.auth-sub{margin:0 0 16px;font-size:14px;color:var(--muted);line-height:1.5}
.auth-card label{font-size:14px;font-weight:500}
.pw{display:flex;border:1px solid var(--rule);border-radius:8px;background:var(--soft);overflow:hidden}
.pw:focus-within{outline:2px solid var(--per);outline-offset:1px}
.pw input{flex:1;min-width:0;border:0;background:transparent;padding:0 12px;min-height:44px;font-size:16px;color:var(--ink);outline:none}
.pw button{border:0;border-left:1px solid var(--rule);background:transparent;padding:0 16px;min-height:44px;font-size:14px;color:var(--muted)}
.auth-err{min-height:22px;margin:0;font-size:14px;color:var(--err);line-height:1.5}
.auth-card .btn.primary{width:100%;min-height:44px;font-size:16px}
.auth-help{margin:8px 0 0;font-size:14px;color:var(--muted);line-height:1.5}
"""
h = h.replace("</style>", AUTH_CSS + "</style>", 1)

AUTH_HTML = r"""
<div class="auth" id="auth" hidden>
  <form class="auth-card" id="authForm" novalidate>
    <h1>Plan de personal</h1>
    <p class="auth-sub">Bison · Dirección de Operaciones</p>
    <label for="authPw">Contraseña</label>
    <div class="pw">
      <input id="authPw" name="password" type="password" autocomplete="current-password" required aria-describedby="authErr">
      <button type="button" id="authShow" aria-pressed="false">Mostrar</button>
    </div>
    <p class="auth-err" id="authErr" role="alert"></p>
    <button class="btn primary" type="submit" id="authGo">Entrar</button>
    <p class="auth-help">¿No tienes contraseña? Pídela a la Gerencia de Operaciones.</p>
  </form>
</div>
<script>
(function(){
  const $=s=>document.querySelector(s);
  const LOCAL=new Set(["pp.lastDate","pp.view","pp.lbl","pp.seenVer","pp.lastBackup"]);
  document.body.classList.add("booting");
  // datos compartidos que no deben quedarse en el navegador sin una sesión válida (los pendientes por subir se conservan)
  const limpiar=()=>{ try{ Object.keys(localStorage).filter(k=>k.startsWith("pp.")&&!LOCAL.has(k)).forEach(k=>localStorage.removeItem(k)); }catch(e){} };
  let expirada=false;
  const leerAuth=()=>{ let raw=null; try{ raw=localStorage.getItem("pp-auth"); }catch(e){}
    if(!raw) return null;
    try{ const a=JSON.parse(raw); if(a&&a.token&&a.exp>Date.now()) return a; }catch(e){}
    expirada=true; return null; };
  async function subirPendientes(a){
    let p=null; try{ p=JSON.parse(localStorage.getItem("pp-pending")||"null"); }catch(e){}
    if(!p||!Object.keys(p).length) return;
    const r=await fetch("/api/state",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+a.token},body:JSON.stringify({set:p})});
    if(r.ok) localStorage.removeItem("pp-pending");
  }
  function iniciar(a,st){
    Object.keys(localStorage).filter(k=>k.startsWith("pp.")&&!LOCAL.has(k)).forEach(k=>localStorage.removeItem(k));
    Object.entries(st.data||{}).forEach(([k,v])=>{ if(!LOCAL.has(k)) localStorage.setItem(k,v); });
    window.PP_SERVER={token:a.token,role:a.role,v:st.v,at:st.at};
    $("#auth").hidden=true; document.body.classList.remove("booting");
    const s=document.createElement("script"); s.textContent=$("#app-main").textContent; document.body.appendChild(s);
  }
  function mostrar(msg){ $("#auth").hidden=false; $("#authErr").textContent=msg||""; setTimeout(()=>$("#authPw").focus(),0); }
  async function entrar(a){
    if(a.role==="edit") await subirPendientes(a).catch(()=>{});
    const r=await fetch("/api/state",{headers:{authorization:"Bearer "+a.token}});
    if(r.status===401){ localStorage.removeItem("pp-auth"); limpiar(); return mostrar("Tu sesión terminó. Vuelve a escribir la contraseña."); }
    if(!r.ok) throw new Error("estado "+r.status);
    iniciar(a,await r.json());
  }
  $("#authShow").addEventListener("click",e=>{ const i=$("#authPw"), ver=i.type==="password"; i.type=ver?"text":"password";
    e.currentTarget.textContent=ver?"Ocultar":"Mostrar"; e.currentTarget.setAttribute("aria-pressed",String(ver)); });
  $("#authPw").addEventListener("blur",e=>{ if(!e.target.value) $("#authErr").textContent="Escribe la contraseña para entrar."; });
  $("#authPw").addEventListener("input",()=>{ $("#authErr").textContent=""; });
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault(); const pw=$("#authPw").value;
    if(!pw){ $("#authErr").textContent="Escribe la contraseña para entrar."; $("#authPw").focus(); return; }
    const b=$("#authGo"); b.disabled=true; b.textContent="Entrando…";
    try{
      const r=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:pw})});
      const j=await r.json().catch(()=>({}));
      if(r.status===401){ $("#authErr").textContent="Esa contraseña no coincide. Revisa mayúsculas y vuelve a intentar."; return; }
      if(!r.ok){ $("#authErr").textContent=j.error||"El servidor no respondió. Intenta de nuevo en un momento."; return; }
      const a={token:j.token,role:j.role,exp:j.exp}; localStorage.setItem("pp-auth",JSON.stringify(a));
      await entrar(a);
    }catch(err){ $("#authErr").textContent="No hay conexión con el servidor. Revisa tu internet e intenta de nuevo."; }
    finally{ b.disabled=false; b.textContent="Entrar"; }
  });
  const a=leerAuth();
  if(a) entrar(a).catch(()=>mostrar("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo."));
  else{ if(expirada){ try{ localStorage.removeItem("pp-auth"); }catch(e){} } limpiar();
    mostrar(expirada?"Tu sesión terminó. Vuelve a escribir la contraseña.":""); }
})();
</script>
"""
idx = h.rfind('<script type="text/plain" id="app-main">')
h = h[:idx] + AUTH_HTML + h[idx:]

open(out, "w", encoding="utf8").write(h)
print(f"OK: {out} ({len(h):,} bytes)")
