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
- ✅ **Hero actualizado**: el badge ya no dice "Resultados en máximo 30 días" sino "La primera web app Inmobiliaria de Bolivia".
- ✅ **Franja de marcas/aliados**: nueva sección justo debajo del hero, franja discreta con logos en escala de grises que se animan en loop horizontal (pausa al pasar el mouse). Se alimenta de la tabla `partners` (nueva) + bucket `partner-logos` (nuevo); si no hay logos cargados, la franja no se muestra (no deja espacio vacío). Administrable desde la nueva pestaña **Marcas** del panel (agregar con nombre opcional + imagen, reordenar por drag&drop, eliminar).
- ✅ **Panel reorganizado en pestañas**: Propiedades / Marcas / Administradores (antes solo había una vista de propiedades).
- ✅ **Invitar administradores**: nueva pestaña "Administradores" con formulario de invitación por correo. Requiere desplegar la Edge Function `supabase/functions/invite-admin` (código listo, instrucciones en [SETUP.md](SETUP.md) paso 4) — crear usuarios de Supabase Auth necesita la `service_role` key, que nunca debe estar en el navegador, así que corre server-side en la función. Cualquier administrador ya logueado puede invitar a otro; todos los administradores tienen los mismos permisos (no hay roles).
- ⚠️ **Pendiente:** eliminar la pantalla temporal de registro de `/admin` (instrucciones en [SETUP.md](SETUP.md) sección 3) — mientras siga ahí, cualquiera que entre a `/admin` puede crearse una cuenta de administrador. Esperando confirmación de la dueña para quitarla. (Ahora que existe la pestaña "Administradores", esta pantalla temporal es aún más prioritaria de quitar.)
- ⚠️ **Pendiente:** correr de nuevo `supabase/schema.sql` en el proyecto real para crear la tabla `partners` y el bucket `partner-logos` (es seguro re-ejecutarlo completo). Confirmado localmente que sin esa tabla el panel muestra un error claro en la pestaña Marcas ("Could not find the table") en vez de romperse.
- ⚠️ **Pendiente:** desplegar la Edge Function `invite-admin` (ver arriba) — sin esto, la pestaña Administradores muestra error al invitar, pero el resto del panel sigue funcionando normal.
- ⚠️ **Pendiente:** cargar las primeras propiedades reales y los logos de las empresas aliadas (REMAX, La Orchila Bienes Raíces, SOBOCE, 3G Constructora, Eddyfica) desde el panel — no se subieron automáticamente porque solo un administrador autenticado puede escribir en Storage/DB (RLS), y no tengo esa sesión.
- ⚠️ No probado end-to-end todavía contra el proyecto Supabase real: crear/editar/eliminar una propiedad, un logo de marca, o invitar un admin (sí se probó toda la lógica — selects, mapa, matching de ciudad, filtro del landing, tabs, formularios — con datos simulados en local; ver historial de la conversación).
- 🐛 **Nota de CSS (`.partners-strip`):** el `<body>` es crema (`--color-light`); el hero y "Propiedades" son verde oscuro solo porque cada `<section>` pinta su propio fondo, no porque la página tenga un fondo oscuro global. Por eso `.partners-strip { background: transparent; }` se veía como una franja crema (el body asomando) en vez de "invisible". El fix fue pintarla del mismo verde (`var(--color-primary)`) que sus vecinas, no dejarla literalmente transparente — así los logos (con su propio fondo transparente en el PNG) quedan flotando sobre el verde sin caja visible alrededor.
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

1. Volver a correr `supabase/schema.sql` completo (crea la tabla `partners` y el bucket `partner-logos` que faltan).
2. Desplegar la Edge Function `invite-admin` (ver [SETUP.md](SETUP.md) paso 4).
3. Quitar la pantalla de registro temporal de `/admin`.
4. Cargar las propiedades reales y los 5 logos de empresas aliadas (REMAX, La Orchila Bienes Raíces, SOBOCE, 3G Constructora, Eddyfica) desde el panel. Para verse bien en la franja transparente, conviene que esos logos sean PNG con fondo transparente (no blanco/crema sólido).
5. Probar el CRUD completo (crear/editar/subir fotos/reordenar/eliminar) contra el proyecto Supabase real, tanto en Propiedades como en Marcas.
6. Confirmar con la firma si el video de fondo del hero se debe recuperar/reemplazar por uno propio.
