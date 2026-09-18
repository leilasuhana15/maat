# Bastet Propiedades · Inmobiliarias — Guía de puesta en marcha

Sitio estático (HTML/CSS/JS puro, sin build) con Supabase como backend.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta / un proyecto nuevo (plan gratuito).
2. Espera a que termine de aprovisionarse (1-2 minutos).
3. En el menú lateral ve a **SQL Editor** → **New query**, pega el contenido completo de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo (▶ Run). Esto crea:
   - La tabla `properties` con sus políticas de seguridad (RLS), incluyendo `owner_id` (quién puede editarla) y `featured` (destacada en el carrusel).
   - La tabla `profiles` (rol `admin`/`agent` y estado activo/desactivado de cada usuario), con un trigger que crea automáticamente el perfil de cualquier usuario nuevo.
   - El bucket de Storage `property-photos` (público para lectura, autenticados activos pueden subir/borrar).
   - La tabla `partners` (logos de empresas aliadas, solo editable por administradores) y el bucket `partner-logos`.
   - Es seguro volver a correr este script completo si ya lo habías ejecutado antes (usa `if not exists` / `drop policy if exists`) — así obtienes las tablas/columnas nuevas sin duplicar nada.
   - Si el bucket `property-photos` o `partner-logos` no aparece después de correr el script (puede pasar por permisos del SQL Editor), créalo manualmente en **Storage → New bucket** con ese nombre exacto y marca "Public bucket".
   - **Importante:** cerca del final de la sección de `profiles`, el script tiene una línea `update public.profiles set role = 'admin' where email in (...)`. Edita esa lista con los correos que deben ser administradores (acceso total) antes de correrlo — cualquier otro usuario queda como `agent` (agente, solo ve/edita sus propias propiedades). Puedes volver a correr solo esa línea más adelante para promover a alguien más.
4. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public** key

## 2. Conectar las credenciales

Abre [`assets/js/supabase-config.js`](assets/js/supabase-config.js) y reemplaza:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-PUBLIC-KEY';
```

con tus valores reales. Este archivo lo usan tanto `index.html` (landing) como `admin/index.html` (panel).

## 3. Crear tu usuario administrador

El panel vive en `/admin`. Incluye una pantalla temporal de registro:

1. Abre `admin/index.html` en el navegador (o publícalo y visita `tudominio.com/admin`).
2. Haz clic en **"Crear cuenta de administrador"**.
3. Registra tu correo y contraseña.
4. Si tu proyecto de Supabase tiene activada la confirmación por correo (viene así por defecto), revisa tu bandeja y confirma antes de iniciar sesión.

**Importante — seguridad:** una vez creado tu usuario, elimina la pantalla de registro para que nadie más pueda crear cuentas de administrador:
- En `admin/index.html`, borra el bloque `<div id="view-signup" ...> ... </div>` y el enlace `¿Primera vez? Crear cuenta de administrador` en la vista de login.
- En `assets/js/admin.js`, borra el bloque `signupForm.addEventListener(...)` y las líneas de `go-to-signup` / `go-to-login`.

Si en el futuro necesitas otro administrador, puedes crearlo directamente desde el dashboard de Supabase (**Authentication → Users → Add user**) o, una vez desplegada la Edge Function del paso siguiente, invitarlo desde la pestaña **Administradores** del propio panel.

## 4. Desplegar la función que invita administradores (opcional pero recomendado)

El panel tiene una pestaña **Administradores** para invitar por correo a nuevas personas que puedan gestionar propiedades. Crear cuentas de Supabase Auth requiere una clave (`service_role`) que nunca debe estar en el navegador, así que esto corre en una Edge Function del lado de Supabase:

1. En el dashboard de Supabase, ve a **Edge Functions** → **Deploy a new function**.
2. Nombre exacto: `invite-admin`.
3. Pega el contenido completo de [`supabase/functions/invite-admin/index.ts`](supabase/functions/invite-admin/index.ts).
4. Despliega. No necesitas configurar variables de entorno: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles automáticamente para toda función.
5. Prueba desde el panel: `/admin` → pestaña **Administradores** → ingresa un correo → **Enviar invitación**. La persona invitada recibe un correo de Supabase para crear su contraseña; al hacerlo, ya puede iniciar sesión en `/admin` con los mismos permisos que cualquier administrador.

Si no despliegas esta función, esa pestaña simplemente mostrará un error al intentar invitar — el resto del panel (propiedades, marcas) sigue funcionando igual.

## 5. Publicar el sitio

Sube toda la carpeta a tu hosting estático (Hostinger, Netlify, Vercel, etc.). No requiere build ni Node — son archivos HTML/CSS/JS servidos tal cual. Asegúrate de que `/admin` quede accesible pero fuera del sitemap (ya tiene `<meta name="robots" content="noindex, nofollow">`).

## Estructura del proyecto

```
index.html                          → landing pública
admin/index.html                    → panel de administración
assets/css/style.css                → estilos del landing
assets/css/admin.css                → estilos del panel
assets/js/supabase-config.js        → credenciales de Supabase (editar aquí)
assets/js/bolivia-cities.js         → lista de ciudades de Bolivia (landing + admin)
assets/js/main.js                   → lógica del landing (fetch propiedades, carrusel 3D, modal, franja de marcas)
assets/js/admin.js                  → lógica del panel (auth, CRUD propiedades, marcas, invitar admins)
supabase/schema.sql                 → esquema de base de datos + políticas + buckets
supabase/functions/invite-admin/    → Edge Function para invitar administradores (ver paso 4)
```

## Cómo funciona

- El landing solo muestra propiedades con `status = 'available'`, ordenadas por `sort_order`.
- El carrusel 3D en anillo reutiliza exactamente la física del diseño original (12 tarjetas, radio 520px, rotación automática + arrastre).
- El modal de detalle arma el link de WhatsApp dinámicamente con el título y ubicación de la propiedad, e incluye navegación entre fotos cuando hay más de una.
- La franja de logos ("empresas con las que trabajamos") debajo del hero se alimenta de la tabla `partners`; si está vacía, la franja simplemente no se muestra. Se administra desde la pestaña **Marcas** del panel.
- En el panel, un **administrador** arrastra las filas por el ícono `⠿` para reordenar cómo aparecen en el landing (actualiza `sort_order`), tanto en Propiedades como en Marcas. Un **agente** no puede reordenar (solo ve/edita sus propias propiedades, y reordenar un subconjunto filtrado pisaría el orden de las propiedades de otros).
- Al eliminar una propiedad, un logo, o una foto individual, también se borra el archivo correspondiente del bucket de Storage.
- **Roles:** un **administrador** ve y gestiona todas las propiedades, las Marcas de la firma, y la pestaña Administradores (invitar/desactivar usuarios). Un **agente** (invitado desde esa pestaña) tiene su propio panel restringido: solo ve/crea/edita sus propias propiedades y puede cambiar su contraseña en "Mi cuenta" — no ve Marcas ni Administradores, y no puede marcar una propiedad como "destacada" (eso solo lo hace un admin, protegido también a nivel de base de datos con un trigger). Las propiedades destacadas aparecen ~3 veces más seguido en el carrusel del landing (con una ⭐ junto al título en el panel).
- Un administrador puede **desactivar** a cualquier usuario desde la pestaña Administradores; esa persona pierde acceso al panel de inmediato en su próximo intento de iniciar sesión, sin borrar las propiedades que ya había creado.
- La pestaña **Administradores** invita nuevos usuarios por correo (requiere desplegar la Edge Function del paso 4); por defecto quedan como `agent` — para que alguien sea admin, agrega su correo a la lista de promoción en `supabase/schema.sql` y vuelve a correr esa línea.
