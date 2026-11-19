# Plan de personal · Bison

Versión compartida en Netlify del plan de personal: planes del día y folio, asistencia, plantilla y vacantes, y el Reporte DG.

- **Captura (Felipe):** arma planes, captura asistencia, carga el archivo de personal. Todo se guarda en el servidor.
- **Consulta (RH y DG):** ve todo y descarga folios y asistencia en Excel, pero no puede modificar nada. Entra directo al Reporte DG y la página se actualiza sola cada 45 segundos.

La página pública (`public/index.html`) **no contiene datos de personal**. Los nombres, faltas y planes solo llegan desde el servidor después de entrar con contraseña.

## Instalación en Netlify (una sola vez)

1. En Netlify: **Add new site → Import an existing project → GitHub** y elige `samir-aceves/bison-plan-personal`.
   No hace falta comando de compilación: `netlify.toml` ya indica que se publica la carpeta `public` y dónde están las funciones.
2. En **Site configuration → Environment variables** agrega tres variables (alcance: *Functions*):

   | Variable | Para qué |
   |---|---|
   | `PP_PASS_EDIT` | Contraseña de captura (solo Felipe y tú) |
   | `PP_PASS_VIEW` | Contraseña de consulta (RH y DG) |
   | `PP_SECRET` | Texto largo y aleatorio para firmar las sesiones (32 caracteres o más). Nadie lo escribe nunca. |

3. **Deploys → Trigger deploy** para que las funciones tomen las variables.
4. Opcional: cambia el nombre del sitio en **Site configuration → Change site name** (por ejemplo `bison-plan-personal.netlify.app`).

Los datos se guardan en **Netlify Blobs** del mismo sitio (almacén `plan-personal`). No hay que activar nada aparte.

## Primer uso: pasar los datos de Felipe

1. En la computadora de Felipe, abre la app (v2.4 o posterior) → **Configuración → Descargar respaldo**. Desde la v2.4 el respaldo incluye la base de personal completa y las vacantes.
2. Entra al sitio de Netlify con la contraseña de **captura** → **Abrir Configuración → Restaurar respaldo** y elige ese archivo.
3. Comparte la dirección del sitio y la contraseña de **consulta** con RH y DG.

Desde ese momento Felipe trabaja en el sitio de Netlify, no en el archivo. Si sigue usando el archivo, sus cambios no llegan a RH ni a DG.

## Operación

- **Cambiar una contraseña:** cambia la variable en Netlify y vuelve a desplegar. Las sesiones de ese rol se cierran solas. Úsalo cuando alguien deja de necesitar acceso.
- **Respaldos automáticos:** antes del primer cambio de cada día el servidor guarda una copia. Felipe los ve en **Configuración → Respaldo de datos** y los puede descargar; para volver a uno, se descarga y se carga con **Restaurar respaldo**.
- **Duración de la sesión:** 14 días para captura y 30 para consulta.
- **Dos personas capturando a la vez:** cada cambio se guarda por clave (un día de plan, un día de asistencia, la configuración). Si dos personas editan el mismo día al mismo tiempo, se queda el último en guardar. Por eso solo Felipe debe capturar.

## Actualizar la app

`public/index.html` se genera desde el archivo de la app local:

```bash
python3 tools/build_server.py "Plan de personal v2.5.html" public/index.html
```

El script quita los datos de personal incluidos, agrega la pantalla de acceso y falla si detecta que quedó algún nombre en la página. Después se sube el cambio a GitHub y Netlify despliega solo.

## Estructura

```
public/index.html            app (sin datos) + pantalla de acceso
netlify/functions/login.mjs  POST /api/login     → token por rol
netlify/functions/state.mjs  GET/POST /api/state → datos compartidos (POST solo captura)
netlify/functions/snapshots.mjs  GET /api/snapshots → respaldos diarios (solo captura)
netlify/lib/                 firma de sesiones y acceso al almacén
tools/build_server.py        genera public/index.html desde el archivo local
```
