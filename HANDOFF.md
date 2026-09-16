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
- ✅ **Edge Function `invite-admin` desplegada y funcionando** — confirmado: pasó de 404 a 401 ("Missing authorization header"), y la dueña ya invitó exitosamente a un agente nuevo por correo.
- ✅ **Fix de invitación por correo**: el primer intento de invitar falló con `otp_expired` porque el **Site URL** de Supabase (Authentication → URL Configuration) seguía apuntando a `http://localhost:3000` (el default de ejemplo). Se corrigió a `https://leilasuhana15.github.io/maat/admin/` + Redirect URL `https://leilasuhana15.github.io/maat/**`; tras eso, una invitación reenviada funcionó.
- ✅ **Sistema de roles admin/agente (cambio grande)**: hasta ahora cualquier usuario invitado tenía acceso total al panel — la dueña pidió que un agente invitado solo pueda gestionar sus propias propiedades y su cuenta, no la de otros ni las Marcas. Se implementó:
  - Tabla `profiles` nueva (`role`: `admin`/`agent`, `is_active`): se crea automáticamente para cualquier usuario nuevo vía trigger `on_auth_user_created`. La lista de qué correos son `admin` se define en `supabase/schema.sql` (hay que editarla con los correos reales antes de correr — actualmente incluye `kunabox14@gmail.com` y `laboratoriovisnity@gmail.com` como placeholder, **verificar que sea correcto**).
  - RLS de `properties` ahora exige `owner_id = auth.uid()` para insertar, y `owner_id = auth.uid() OR es_admin` para editar/borrar — un agente ya no puede tocar propiedades de otro, ni siquiera manipulando el cliente (queda forzado en la base de datos, no solo en la UI).
  - Columna `properties.featured` (booleano): protegida por un trigger (`protect_featured_column`) que revierte el cambio si quien edita no es admin — un agente no puede autodestacarse aunque intente mandar el campo directo por API.
  - El panel (`admin.js`) ahora, tras el login, lee el `profile` del usuario: si `is_active = false` lo desloguea con mensaje; según `role` muestra el dashboard completo (admin) o uno restringido (agente: sin pestañas Marcas/Administradores, sin checkbox "Destacada", sin drag-reorder, propiedades filtradas a `owner_id` propio, título "Mis propiedades").
  - Nueva pestaña **"Mi cuenta"** (todos los roles): cambiar contraseña.
  - Pestaña **Administradores** ampliada: además de invitar, lista todos los usuarios (`profiles`) con su rol y estado, y un botón para activar/desactivar acceso (actualiza `is_active`; no borra sus propiedades).
  - `main.js`: el carrusel del landing arma un "pool" ponderado (`FEATURED_WEIGHT = 3`) y lo baraja en cada render, así una propiedad destacada aparece ~3x más seguido; se ve con una ⭐ junto al título tanto en el carrusel como en la lista del panel.
  - **Limitación conocida**: el reordenar por drag&drop en Propiedades quedó deshabilitado para agentes (solo admin), porque reordenar un subconjunto filtrado por `owner_id` pisaría el `sort_order` global de propiedades de otros dueños.
- ⚠️ **Pendiente — crítico:** correr de nuevo `supabase/schema.sql` en el proyecto real. Todavía no está confirmado que la tabla `profiles`, las nuevas columnas (`owner_id`, `featured`) y las políticas RLS actualizadas existan en producción — probado localmente que sin la tabla `profiles`, la pestaña Administradores muestra un error claro ("Could not find the table") en vez de romper el panel, pero el sistema de roles no funcionará hasta correr el script.
- ⚠️ **Pendiente:** después de correr el script, confirmar que los correos correctos quedaron como `admin` (revisar la lista `where email in (...)` antes de correr, o correr un `update` aparte después).
- ⚠️ **Pendiente:** eliminar la pantalla temporal de registro de `/admin` (instrucciones en [SETUP.md](SETUP.md) sección 3) — cualquiera que la use hoy se registra como `agent` (no como admin, gracias al nuevo sistema de roles, así que el riesgo bajó), pero sigue siendo mejor quitarla y usar solo el flujo de invitación.
- ⚠️ No probado end-to-end contra el proyecto real: el flujo completo de un agente real (login, ver "Mis propiedades" vacío, crear una propiedad propia, confirmar que NO ve Marcas/Administradores), y que un admin pueda desactivar a ese agente y que pierda el acceso. Sí se probó toda la lógica de roles con sesiones simuladas en local (ver detalle en la conversación).
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
assets/js/admin.js           → panel: auth+roles, tabs, CRUD propiedades (con owner_id/featured), marcas, invitar/gestionar usuarios, mi cuenta, mapa de ubicación
supabase/schema.sql          → tablas properties + profiles (roles) + partners, funciones/triggers de permisos, políticas RLS, buckets property-photos + partner-logos
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

1. **Correr `supabase/schema.sql` de nuevo en producción** — trae la tabla `profiles` y el sistema de roles admin/agente; nada de eso funciona hasta hacerlo. Revisar/editar antes la lista de correos que deben quedar como `admin`.
2. Verificar que el agente ya invitado (el que probó el flujo de invitación) haya quedado con rol `agent` y que su dashboard se vea restringido como corresponde.
3. Quitar la pantalla de registro temporal de `/admin`.
4. Probar el flujo de editar/eliminar en Marcas y Propiedades contra el proyecto real (agregar ya se probó).
5. Confirmar con la firma si el video de fondo del hero se debe recuperar/reemplazar por uno propio.
