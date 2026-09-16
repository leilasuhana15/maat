# MAAT Firma Legal — Guía de puesta en marcha

Sitio estático (HTML/CSS/JS puro, sin build) con Supabase como backend.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta / un proyecto nuevo (plan gratuito).
2. Espera a que termine de aprovisionarse (1-2 minutos).
3. En el menú lateral ve a **SQL Editor** → **New query**, pega el contenido completo de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo (▶ Run). Esto crea:
   - La tabla `properties` con sus políticas de seguridad (RLS).
   - El bucket de Storage `property-photos` (público para lectura, solo administradores autenticados pueden subir/borrar).
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

Si en el futuro necesitas otro administrador, créalo directamente desde el dashboard de Supabase: **Authentication → Users → Add user**.

## 4. Publicar el sitio

Sube toda la carpeta a tu hosting estático (Hostinger, Netlify, Vercel, etc.). No requiere build ni Node — son archivos HTML/CSS/JS servidos tal cual. Asegúrate de que `/admin` quede accesible pero fuera del sitemap (ya tiene `<meta name="robots" content="noindex, nofollow">`).

## Estructura del proyecto

```
index.html                   → landing pública
admin/index.html             → panel de administración
assets/css/style.css         → estilos del landing
assets/css/admin.css         → estilos del panel
assets/js/supabase-config.js → credenciales de Supabase (editar aquí)
assets/js/main.js            → lógica del landing (fetch propiedades, carrusel 3D, modal)
assets/js/admin.js           → lógica del panel (auth, CRUD, fotos, reordenar)
supabase/schema.sql          → esquema de base de datos + políticas + bucket
```

## Cómo funciona

- El landing solo muestra propiedades con `status = 'available'`, ordenadas por `sort_order`.
- El carrusel 3D en anillo reutiliza exactamente la física del diseño original (12 tarjetas, radio 520px, rotación automática + arrastre).
- El modal de detalle arma el link de WhatsApp dinámicamente con el título y ubicación de la propiedad, e incluye navegación entre fotos cuando hay más de una.
- En el panel, arrastra las filas por el ícono `⠿` para reordenar cómo aparecen en el landing (actualiza `sort_order`).
- Al eliminar una propiedad o una foto, también se borra el archivo correspondiente del bucket de Storage.
