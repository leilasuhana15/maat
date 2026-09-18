# HANDOFF — Bastet Propiedades · Inmobiliarias

> Lee este archivo primero al retomar el proyecto en una sesión nueva (después de un `/compact`, un reinicio, o un colaborador nuevo). Resume el estado real del proyecto para no tener que re-explorar todo el repo desde cero.
>
> **Práctica del proyecto:** este archivo se actualiza después de cada commit/push relevante, y antes de darlo por bueno se verifica que el sitio (landing + `/admin`) cargue sin errores de consola ni fallos de red. Ver [Cómo verificar antes de dar por bueno un cambio](#cómo-verificar-antes-de-dar-por-bueno-un-cambio).
>
> ⚠️ **El proyecto se renombró de "MAAT Firma Legal" a "Bastet Propiedades · Inmobiliarias"** (mismo negocio/dueña, nueva marca). La carpeta local, el nombre del repo de GitHub (`maat`) y el dominio de GitHub Pages (`leilasuhana15.github.io/maat`) siguen diciendo "maat" por razones históricas — no se renombraron para no romper el link ya compartido. Si algo dice "MAAT" en una URL, es solo el identificador técnico, no la marca visible.

## Qué es esto

Sitio estático (HTML/CSS/JS puro, sin build) para **Bastet**, inmobiliaria boliviana ("Propiedades · Inmobiliarias", con raíz en asesoría legal inmobiliaria). Landing público + panel de administración de propiedades sobre Supabase.

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
- ✅ **`supabase/schema.sql` confirmado corriendo en producción**: tabla `profiles` existe, `properties.owner_id` y `properties.featured` existen (confirmado por API — las 2 propiedades creadas antes del cambio quedaron con `owner_id: null`, así que solo un admin puede editarlas/borrarlas). El sistema de roles ya está operativo end-to-end: se invitó un agente real por correo y funcionó.
- ✅ **Rebranding completo de "MAAT Firma Legal" a "Bastet"** (la dueña compartió el Brand Book oficial — `BASTED BRAND B.pdf`, 11 páginas). Se aplicó en todo el sitio:
  - **Nombre y copy de marca**: `<title>`, meta description, nav, footer, panel admin (login/topbar), mensajes de WhatsApp (genérico y por propiedad) — todo pasó de "MAAT" / "Firma Legal" a "BASTET" / "PROPIEDADES · INMOBILIARIAS". El positioning oficial del brand book es *"Guardianes de tu patrimonio, con la serenidad de quien ya sabe proteger un hogar"* y el tagline *"Propiedades que se cuidan como se cuida un hogar"* — **no se incorporaron al copy visible todavía** (el pedido fue rebranding visual/de nombre, no reescribir el hero; están disponibles si se quiere usarlos después).
  - **Paleta de colores oficial** (reemplaza la anterior en `:root` de `style.css` y `admin.css`): `--color-primary:#2C402D` `--color-secondary:#627362` `--color-olive:#8C7F3B` `--color-accent:#F2B035` `--color-light:#F2E4DF`. Se barrieron también los hex/rgba hardcodeados que no usaban las variables (gradientes del hero, fondos de tarjetas, etc.) para que coincidan con la paleta nueva.
  - **Tipografía**: `Inter` → `Montserrat` (secundaria/cuerpo) según el brand book; `Cormorant Garamond` se mantiene para titulares (ya coincidía).
  - **CTA**: el brand book marca el dorado `#F2B035` como "Acento — CTAs, gato", así que `.cta-button` pasó de fondo negro con glow dorado a fondo dorado sólido con texto verde oscuro.
  - **Logo/ícono — actualizado con los archivos reales**: al principio no pude acceder a las imágenes que la dueña pegó directamente en el chat (solo llegan como archivo real cuando se referencian con ruta explícita `@`), así que recreé el ícono a mano en SVG como aproximación temporal. La dueña después compartió la carpeta real (`BASTET INMOBILIARIA LOGOS/assets/`, vía ruta de carpeta) con los archivos oficiales, ya en uso:
    - `assets/img/bastet-gato-dorado.png` (500×470, fondo transparente) — gato sentado completo, dorado. Usado en nav, footer y topbar del admin (todos sobre fondo verde oscuro).
    - `assets/img/bastet-icon-verde.png` (905×1169, fondo transparente) — solo cabeza + collar, verde oscuro. Usado como favicon y en las pantallas de login/registro del admin (fondo claro).
    - `assets/img/bastet-logo-completo.png` (2089×1249, fondo transparente) — lockup completo (ícono + "BASTET" + tagline) ya compuesto como una sola imagen; no está en uso todavía en ningún lado (el sitio arma el lockup en vivo con ícono + texto HTML), pero queda disponible si se prefiere usar la imagen pre-compuesta en algún lugar.
    - `assets/img/hero-start.jpg` — primer frame del video del hero, comprimido a JPEG (de 1.79MB a ~160KB) y usado como `poster` del `<video>` para que se vea algo antes de que cargue el video.
    - Los SVG dibujados a mano (`bastet-icon.svg`, `favicon.svg`) se borraron del repo, ya no se usan.
  - **Contacto**: teléfono/WhatsApp actualizado al estándar del brand book (`+591 77666205`, antes `70613687`), dirección agregada al footer (`Calle Yanacocha, Edif. Cristal, Of. 706 — La Paz, Bolivia`). El **email de contacto quedó igual** (`maatfirmalegal.sv@gmail.com`) porque el brand book no especifica uno nuevo — pendiente de confirmar con la dueña si debe cambiar.
  - **Video del hero recuperado**: la dueña pasó el archivo original (`MAAT VIDEO.mp4`, vía ruta explícita) — ya no es el gradiente placeholder. Vive en `assets/video/hero.mp4` (1.17MB) y reproduce con el mismo efecto "ping-pong" del diseño original (al llegar al final retrocede en cámara lenta en vez de cortar y reiniciar), respetando `prefers-reduced-motion`.
- ⚠️ **Pendiente:** eliminar la pantalla temporal de registro de `/admin` (instrucciones en [SETUP.md](SETUP.md) sección 3) — cualquiera que la use hoy se registra como `agent` (no como admin, gracias al nuevo sistema de roles, así que el riesgo bajó), pero sigue siendo mejor quitarla y usar solo el flujo de invitación.
- ⚠️ **Pendiente:** confirmar con la dueña si el email de contacto del footer debe actualizarse (ver nota de rebranding arriba).
- ⚠️ No probado end-to-end contra el proyecto real: el flujo completo de un agente real viendo su dashboard restringido tras el rebrand (los cambios de color/marca no deberían afectar la lógica de roles, pero no se re-verificó explícitamente tras estos últimos cambios).
- 🐛 **Nota de diseño (`.partners-strip`):** pasó por dos iteraciones. Primero fondo transparente puro — pero el `<body>` es crema y cada sección pinta su propio fondo (no hay fondo oscuro global), así que "transparente" mostraba una franja crema entre dos secciones verde oscuro. Luego se probó pintarla del mismo verde de sus vecinas. La versión final, pedida por la dueña tras ver los logos reales (varios con fondo blanco sólido, no transparente): franja blanca y delgada, para que combine con el fondo blanco que ya traen los logos en vez de pelear contra él.
- 🐛 **Nota de entorno de pruebas:** el servidor local (`python -m http.server`, ver `.claude/launch.json`) a veces sirve JS desactualizado al navegador de pruebas por caché agresiva del propio navegador (no del servidor — confirmado con `curl` directo al puerto local, que siempre devolvió el archivo correcto). Si algo se ve "viejo" al probar localmente, verificar primero con `curl http://localhost:8080/...` antes de asumir que el código está mal.
- ✅ **Sección de Testimonios (nueva) — landing + admin**:
  - **Landing**: la vieja grilla estática de 3 testimonios se reemplazó por un carrusel de anillo 3D infinito, igual en física/interacción al de Propiedades. Se extrajo el motor del anillo a una factory genérica reutilizable, `createRingCarousel({...})` en `main.js`, y tanto Propiedades como Testimonios ahora se construyen sobre ella (antes el código del anillo estaba duplicado/acoplado solo a Propiedades). Cada tarjeta de testimonio muestra una **foto circular a la izquierda** + nombre/rol arriba y la cita debajo (`.testi-ring-card` en `style.css`).
  - **Datos**: tabla `testimonials` nueva en `supabase/schema.sql` (con RLS: público solo ve `is_active=true`, solo admin puede insertar/editar/borrar) + bucket de Storage `testimonial-photos` (público de lectura, solo admin escribe). El script incluye un `insert ... on conflict (id) do nothing` con **10 testimonios semilla** (5 individuales + 5 "Familia X"), con `photo_url` apuntando a `assets/img/testimonials/testi-01.jpg` … `testi-10.jpg` — fotos de stock reales (no Supabase Storage; se sirven como archivos estáticos del propio repo, mismo patrón usado antes para los assets de marca).
  - **Admin**: nueva pestaña **"Testimonios"** (solo admin, junto a Marcas y Administradores) con formulario para agregar (nombre, descripción breve, cita, foto opcional vía upload a `testimonial-photos`) y lista con reordenar por drag&drop (⠿) + eliminar (borra también la foto del bucket si la tenía). No tiene edición inline todavía — para corregir un testimonio hay que borrarlo y recrearlo.
  - ⚠️ **Pendiente manual de la dueña**: el `supabase/schema.sql` actualizado **debe volver a correrse en el SQL Editor de Supabase** para que la tabla `testimonials`, sus políticas RLS, el bucket `testimonial-photos` y los 10 testimonios semilla existan en producción — igual que se hizo con `properties`/`profiles`/`partners` en su momento. Hasta que eso pase, la sección de Testimonios del landing mostrará el estado vacío ("Pronto compartiremos las experiencias de nuestros clientes.") porque la consulta a `testimonials` fallará (tabla inexistente).
- ✅ **Cambio de rol de usuario desde el panel (nuevo)**: en la pestaña Administradores, cada usuario (menos uno mismo, para evitar bloquearse por error) ahora tiene un `<select>` Agente/Admin en vez de una etiqueta fija; cambiarlo pide confirmación y actualiza `profiles.role` directo (la política RLS `"admin can update profiles"` ya permitía esto, no hizo falta tocar el esquema). Antes solo se podía activar/desactivar acceso, no cambiar el rol sin editar la base de datos a mano.

## Arquitectura / mapa de archivos

```
index.html                   → landing público
admin/index.html             → panel de administración
assets/css/style.css         → estilos del landing
assets/css/admin.css         → estilos del panel
assets/js/supabase-config.js → credenciales de Supabase (URL + anon key, públicas por diseño)
assets/js/bolivia-cities.js  → lista canónica de ciudades de Bolivia (compartida landing + admin)
assets/js/main.js            → landing: createRingCarousel() genérico (motor del anillo 3D), fetch+render propiedades y testimonios, modal con WhatsApp, franja de marcas
assets/js/admin.js           → panel: auth+roles, tabs, CRUD propiedades (con owner_id/featured), marcas, testimonios, invitar/gestionar usuarios + cambio de rol, mi cuenta, mapa de ubicación
supabase/schema.sql          → tablas properties + profiles (roles) + partners + testimonials, funciones/triggers de permisos, políticas RLS, buckets property-photos + partner-logos + testimonial-photos
supabase/functions/invite-admin/index.ts → Edge Function para invitar administradores (usa service_role, server-side)
assets/img/bastet-gato-dorado.png / bastet-icon-verde.png / bastet-logo-completo.png → logos oficiales de marca (ver nota de rebranding en Estado actual)
assets/img/favicon.png       → versión cuadrada con padding del ícono, usada como favicon (el ícono original es rectangular y se veía "achatado" si se usaba directo)
assets/img/testimonials/testi-01.jpg … testi-10.jpg → fotos de stock para los testimonios semilla, servidas como archivos estáticos del repo (no Supabase Storage)
assets/video/hero.mp4        → video de fondo del hero (loop ping-pong)
SETUP.md                     → guía de puesta en marcha (crear proyecto, correr SQL, crear admin, desplegar function)
.claude/launch.json          → server estático local para preview (python -m http.server 8080)
```

### Decisiones de diseño clave

- El HTML original que trajo el usuario era un **export empaquetado de Claude Design** (formato `.dc.html` con bindings `{{ }}`), no HTML plano. Se decodificó el bundle y se reconstruyó como HTML/CSS/JS vanilla fiel al diseño original (mismo carrusel 3D: 12 tarjetas, radio 520px, `perspective:1000px`, auto-rotación + drag).
- Colores de marca oficiales (Brand Book de Bastet): `--color-primary:#2C402D` `--color-secondary:#627362` `--color-olive:#8C7F3B` `--color-accent:#F2B035` `--color-light:#F2E4DF`. Tipografías: Cormorant Garamond (títulos) / Montserrat (cuerpo), vía Google Fonts. (Los colores/tipografía anteriores de "MAAT" — verde `#123F39`, dorado `#D9B26D`, Inter — quedaron completamente reemplazados.)
- WhatsApp: cada propiedad puede tener su propio número de contacto (`properties.whatsapp`, opcional); si está vacío, el modal usa el número general de la firma (`WHATSAPP_PHONE` en `main.js`, actualmente `59177666205`).
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

1. **Correr el `supabase/schema.sql` actualizado en el SQL Editor de Supabase** para que la tabla `testimonials`, sus RLS, el bucket `testimonial-photos` y los 10 testimonios semilla queden creados en producción (ver nota en Estado actual sobre Testimonios).
2. Confirmar que el agente ya invitado quede con su dashboard restringido correctamente en la práctica (login real, no solo simulado en local).
3. Quitar la pantalla de registro temporal de `/admin`.
4. Confirmar con la dueña el email de contacto del footer (sigue siendo el de "maatfirmalegal.sv", no se especificó uno nuevo en el brand book).
5. Decidir si se incorpora el tagline oficial del brand book ("Propiedades que se cuidan como se cuida un hogar") al copy visible del hero/landing.
