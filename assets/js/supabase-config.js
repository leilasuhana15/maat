// Configuración de Supabase para MAAT Firma Legal.
// 1. Crea un proyecto en https://supabase.com (o usa uno existente).
// 2. Ve a Project Settings > API y copia "Project URL" y "anon public" key.
// 3. Reemplaza los dos valores de abajo.
// 4. Ejecuta supabase/schema.sql en el SQL Editor del proyecto.
// 5. Crea el bucket "property-photos" (el schema.sql ya lo crea si tienes permisos).

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-PUBLIC-KEY';

const PROPERTY_PHOTOS_BUCKET = 'property-photos';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
