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
- ⚠️ **Pendiente:** aún no se ha creado el primer usuario administrador. Hacerlo desde `/admin` → "Crear cuenta de administrador" (pantalla temporal).
- ⚠️ **Pendiente:** una vez creado ese usuario, **eliminar la pantalla temporal de registro** (instrucciones en [SETUP.md](SETUP.md) sección 3) — mientras siga ahí, cualquiera que entre a `/admin` puede crearse una cuenta de administrador.
- ⚠️ **Pendiente:** cargar las primeras propiedades reales desde el panel (la tabla está vacía, por eso el landing muestra el estado "Pronto publicaremos nuevas propiedades disponibles").
- ⚠️ No probado end-to-end todavía: crear/editar/eliminar una propiedad real y subir fotos desde `/admin` contra el proyecto Supabase real (sí se probó la lógica con datos simulados en local, ver historial de la conversación).

## Arquitectura / mapa de archivos

```
index.html                   → landing público
admin/index.html             → panel de administración
assets/css/style.css         → estilos del landing
assets/css/admin.css         → estilos del panel
assets/js/supabase-config.js → credenciales de Supabase (URL + anon key, públicas por diseño)
assets/js/main.js            → landing: fetch propiedades, carrusel 3D en anillo, modal con WhatsApp
assets/js/admin.js           → panel: auth, CRUD propiedades, subida de fotos, reordenar drag&drop
supabase/schema.sql          → tabla properties + políticas RLS + bucket property-photos
SETUP.md                     → guía de puesta en marcha (crear proyecto, correr SQL, crear admin)
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

1. Crear el primer usuario admin y quitar la pantalla de registro temporal.
2. Cargar las propiedades reales de la firma.
3. Probar el CRUD completo (crear/editar/subir fotos/reordenar/eliminar) contra el proyecto Supabase real.
4. Confirmar con la firma si el video de fondo del hero se debe recuperar/reemplazar por uno propio.
