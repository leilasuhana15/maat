# HANDOFF — MAAT Firma Legal

> Lee este archivo primero al retomar el proyecto en una sesión nueva (después de un `/compact`, un reinicio, o un colaborador nuevo). Resume el estado real del proyecto para no tener que re-explorar todo el repo desde cero.
>
> **Práctica del proyecto:** este archivo se actualiza después de cada commit/push relevante, y antes de darlo por bueno se verifica que el sitio (landing + `/admin`) cargue sin errores de consola ni fallos de red. Ver [Cómo verificar antes de dar por bueno un cambio](#cómo-verificar-antes-de-dar-por-bueno-un-cambio).

## Qué es esto

Sitio estático (HTML/CSS/JS puro, sin build) para **MAAT Firma Legal**, firma legal boliviana de asesoría inmobiliaria. Landing público + panel de administración de propiedades sobre Supabase.

- **Repo:** https://github.com/leilasuhana15/maat
- **Landing en vivo:** https://leilasuhana15.github.io/maat/
- **Panel admin:** https://leilasuhana15.github.io/maat/admin/
- **Deploy:** GitHub Pages, rama `main`, carpeta raíz. Se redespliega automáticamente en cada push (tarda ~30-90s en build + hasta ~10 min en propagar por el CDN de Fastly en todos los edges — si ves contenido viejo justo después de pushear, es caché, no un bug; confirma con `curl` directo en vez de solo el navegador).
- **Backend:** Supabase (proyecto `rtkcfmtwxkykjgkmyikg`, URL en `assets/js/supabase-config.js`).

## Estado actual (última actualización: este commit)

- ✅ Landing y panel admin construidos y desplegados en GitHub Pages.
- ✅ Repo conectado a `https://github.com/leilasuhana15/maat.git`, rama `main`.
- ✅ Proyecto Supabase creado, esquema (`supabase/schema.sql`) ejecutado: tabla `properties` + RLS confirmadas por API (`GET /rest/v1/properties` → 200).
- ✅ Bucket de Storage `property-photos` creado y con política de lectura pública confirmada (`POST /storage/v1/object/list/property-photos` → 200).
- ✅ Credenciales reales de Supabase conectadas en `assets/js/supabase-config.js` y desplegadas.
- ✅ Primer usuario administrador creado por la dueña del proyecto; login en `/admin` confirmado funcionando.
- ✅ Formulario de propiedad mejorado: "Ambientes" y "Baños" ahora son `<select>` con opciones predefinidas (con fallback automático si un valor antiguo no está en la lista), selector de ubicación con mapa (Leaflet + OpenStreetMap/Nominatim, sin API key ni costo — busca por texto o clic en el mapa), y etiquetas rápidas para armar la descripción (Soleado, Amplio y espacioso, Cerca de parques, etc). También se corrigió un bug de overflow en la grilla Área/Ambientes/Baños (el `<select>`/`<input>` podía forzar la columna del grid más ancha que su contenedor; fix: `min-width:0` en `.field` y en los inputs).
- ✅ **Filtro de ciudad unificado a ciudad real** (ya no departamento): se creó `assets/js/bolivia-cities.js` con la lista canónica de las 10 ciudades principales de Bolivia (los 9 capitales de departamento + El Alto), compartida entre `main.js` (filtro del landing) y `admin.js` (nuevo campo obligatorio "Ciudad" — `<select>`, ya no texto libre). El mapa sigue disponible como ayuda: al buscar/hacer clic, intenta reconocer la ciudad geocodificada contra la lista y selecciona automáticamente la opción correcta; si no la reconoce, avisa y deja que se seleccione manualmente en vez de guardar un valor no filtrable. Esto garantiza que `location` siempre sea exactamente `"<Ciudad de la lista>, Bolivia"`, así el filtro del landing y los datos del admin nunca se desincronizan.
- ✅ **Hero actualizado**: badge = "La primera web app Inmobiliaria de Bolivia"; título = "Certeza legal. Venda o Compre su inmueble en menos de 30 días."
- ✅ **Franja de marcas/aliados**: sección debajo del hero con los 5 logos reales ya cargados por la dueña (REMAX, La Orchila, SOBOCE, 3G Constructora, Eddyfica) en loop horizontal (pausa al pasar el mouse). Fondo **blanco, delgado** (`padding: 8px 0`, solo el alto del logo — ver nota de diseño abajo), logos a color real. Si no hay logos cargados, la franja no se muestra. Administrable desde la pestaña **Marcas** del panel.
- ✅ **Panel reorganizado en pestañas**: Propiedades / Marcas / Administradores.
- ✅ **Datos reales cargados**: la dueña ya agregó propiedades reales (confirmado vía API) y los 5 logos de marcas.
- ✅ **Esquema re-ejecutado en producción**: tabla `partners` y bucket `partner-logos` confirmados por API (antes daban error "table not found").
- ✅ **Bug crítico corregido — el clic en las tarjetas del carrusel no abría el modal**: el anillo gira continuamente (auto-rotate), así que para cuando el navegador procesaba el evento `click` nativo (después del `pointerup`), la tarjeta ya se había desplazado y el hit-test del click fallaba (el target resuelto era `.ring-stage`, no la tarjeta). Se reprodujo en producción con un clic real (no sintético) y se confirmó viendo `event.target` en la consola. Fix: la tarjeta se resuelve en el instante del `pointerdown` (guardada en `card.__property`, leída con `e.target.closest('.ring-card')`) y la apertura ocurre en `pointerup` usando esa referencia — ya no depende del evento `click` nativo ni de dónde quedó la tarjeta al soltar. Verificado con una prueba que fuerza 40° de rotación entre el down y el up: el modal se sigue abriendo correctamente; y que arrastrar (drag real) sigue sin abrir el modal.
- ⚠️ **Pendiente:** eliminar la pantalla temporal de registro de `/admin` (instrucciones en [SETUP.md](SETUP.md) sección 3). Ahora que existe la pestaña "Administradores" para invitar formalmente, esta pantalla temporal es aún más prioritaria de quitar.
- ⚠️ **Pendiente:** desplegar la Edge Function `invite-admin` — **confirmado que todavía NO está desplegada** (`POST /functions/v1/invite-admin` → 404 "Requested function was not found"). Instrucciones en [SETUP.md](SETUP.md) paso 4. Sin esto, la pestaña Administradores muestra error al invitar; el resto del panel funciona normal.
- ⚠️ No probado end-to-end contra el proyecto real: invitar un admin (bloqueado por el punto anterior), y el flujo completo de editar/eliminar en Marcas (sí se probó agregar, vía la dueña).
- 🐛 **Nota de diseño (`.partners-strip`):** pasó por dos iteraciones. Primero fondo transparente puro — pero el `<body>` es crema y cada sección pinta su propio fondo (no hay fondo oscuro global), así que "transparente" mostraba una franja crema entre dos secciones verde oscuro. Luego se probó pintarla del mismo verde de sus vecinas. La versión final, pedida por la dueña tras ver los logos reales (varios con fondo blanco sólido, no transparente): franja blanca y delgada, para que combine con el fondo blanco que ya traen los logos en vez de pelear contra él.
- 🐛 **Nota de entorno de pruebas:** el servidor local (`python -m http.server`, ver `.claude/launch.json`) a veces sirve JS desactualizado al navegador de pruebas por caché agresiva del propio navegador (no del servidor — confirmado con `curl` directo al puerto local, que siempre devolvió el archivo correcto). Si algo se ve "viejo" al probar localmente, verificar primero con `curl http://localhost:8080/...` antes de asumir que el código está mal.

## Arquitectura / mapa de archivos

```
index.html                   → landing público
admin/index.html             → panel de administración
assets/css/style.css         → estilos del landing
assets/css/admin.css         → estilos del panel
assets/js/supabase-config.js → credenciales de Supabase (URL + anon key, públicas por diseño)
assets/js/bolivia-cities.js  → lista canónica de ciudades de Bolivia (compartida landing + admin)
assets/js/main.js            → landing: fetch propiedades, carrusel 3D en anillo, modal con WhatsApp, franja de marcas
assets/js/admin.js           → panel: auth, tabs, CRUD propiedades, marcas, invitar admins, mapa de ubicación
supabase/schema.sql          → tablas properties + partners, políticas RLS, buckets property-photos + partner-logos
supabase/functions/invite-admin/index.ts → Edge Function para invitar administradores (usa service_role, server-side)
SETUP.md                     → guía de puesta en marcha (crear proyecto, correr SQL, crear admin, desplegar function)
.claude/launch.json          → server estático local para preview (python -m http.server 8080)
```

### Decisiones de diseño clave

- El HTML original que trajo el usuario era un **export empaquetado de Claude Design** (formato `.dc.html` con bindings `{{ }}`), no HTML plano. Se decodificó el bundle y se reconstruyó como HTML/CSS/JS vanilla fiel al diseño original (mismo carrusel 3D: 12 tarjetas, radio 520px, `perspective:1000px`, auto-rotación + drag).
- El video de fondo del hero original no se pudo portar (no venía como archivo, solo referenciado dentro del bundle) — se reemplazó por un gradiente en los mismos tonos de marca.
- Colores de marca: `--color-primary:#123F39` `--color-secondary:#C9A063` `--color-light:#F5F1E8` `--color-accent:#D9B26D`. Tipografías: Cormorant Garamond (títulos) / Inter (cuerpo), vía Google Fonts.
- WhatsApp: cada propiedad puede tener su propio número de contacto (`properties.whatsapp`, opcional); si está vacío, el modal usa el número general de la firma (`WHATSAPP_PHONE` en `main.js`, actualmente `59170613687`).
- `properties.photos` es un array de URLs públicas del bucket `property-photos`. Al borrar una propiedad o una foto individual, el admin también borra el archivo del bucket.
- Reordenar propiedades en el admin (drag & drop) actualiza `sort_order` de todas las filas; el landing ordena por ese campo.

## Cómo verificar antes de dar por bueno un cambio

Después de cada commit + push a `main`:

1. **Confirmar el deploy real con `curl`** (no confiar solo en el navegador, que puede mostrar caché vieja):
   ```bash
   curl -s https://leilasuhana15.github.io/maat/assets/js/main.js | head -5
   ```
2. **Abrir la landing y el admin en el navegador** y revisar la consola:
   - Errores esperados/inofensivos: ninguno, si las credenciales de Supabase están bien conectadas.
   - Si aparece `Failed to fetch` en `main.js` al cargar propiedades → revisar que `SUPABASE_URL`/`SUPABASE_ANON_KEY` en `assets/js/supabase-config.js` sean correctos y que el proyecto Supabase esté activo.
   - Si aparece `net::ERR_BLOCKED_BY_CLIENT` en la consola del navegador pero `curl` a los mismos recursos devuelve 200 → es un bloqueador de contenido del entorno de pruebas, no un bug real del sitio.
3. **Probar el flujo real en `/admin`**: login, crear una propiedad de prueba con foto, verificar que aparece en el landing con `status='available'`, editarla, marcarla como `sold` y confirmar que desaparece del landing, borrarla.
4. **Actualizar la sección "Estado actual" de este archivo** con lo que cambió.

## Próximos pasos sugeridos

1. Desplegar la Edge Function `invite-admin` (ver [SETUP.md](SETUP.md) paso 4) — es lo único de la lista original que sigue pendiente de la dueña.
2. Quitar la pantalla de registro temporal de `/admin`.
3. Probar el flujo de editar/eliminar en Marcas y Propiedades contra el proyecto real (agregar ya se probó).
4. Confirmar con la firma si el video de fondo del hero se debe recuperar/reemplazar por uno propio.
