function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const citySelectEl = document.getElementById('field-city');
BOLIVIA_CITIES.forEach((city) => {
  const opt = document.createElement('option');
  opt.value = city;
  opt.textContent = city;
  citySelectEl.appendChild(opt);
});

function normalizeCityName(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function matchBoliviaCity(name) {
  const target = normalizeCityName(name);
  if (!target) return null;
  return BOLIVIA_CITIES.find((c) => {
    const nc = normalizeCityName(c);
    return nc === target || target.includes(nc) || nc.includes(target);
  }) || null;
}

function traduceAuthError(message) {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/user already registered/i.test(message)) return 'Ya existe una cuenta con ese correo.';
  if (/password should be at least/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de iniciar sesión.';
  return message;
}

/* ── View switching ── */
const views = {
  login: document.getElementById('view-login'),
  signup: document.getElementById('view-signup'),
  dashboard: document.getElementById('view-dashboard'),
};
function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}

document.getElementById('go-to-signup').addEventListener('click', (e) => { e.preventDefault(); showView('signup'); });
document.getElementById('go-to-login').addEventListener('click', (e) => { e.preventDefault(); showView('login'); });

/* ── Auth ── */
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  btn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (error) {
    loginError.textContent = traduceAuthError(error.message);
    loginError.classList.remove('hidden');
  }
});

const signupForm = document.getElementById('signup-form');
const signupError = document.getElementById('signup-error');
const signupSuccess = document.getElementById('signup-success');
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupError.classList.add('hidden');
  signupSuccess.classList.add('hidden');
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-password-confirm').value;
  if (password !== confirm) {
    signupError.textContent = 'Las contraseñas no coinciden.';
    signupError.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('signup-submit');
  btn.disabled = true;
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  btn.disabled = false;
  if (error) {
    signupError.textContent = traduceAuthError(error.message);
    signupError.classList.remove('hidden');
    return;
  }
  if (data.session) {
    signupForm.reset();
    return;
  }
  signupSuccess.textContent = 'Cuenta creada. Revisa tu correo para confirmar el acceso y luego inicia sesión.';
  signupSuccess.classList.remove('hidden');
  signupForm.reset();
});

document.getElementById('logout-btn').addEventListener('click', () => supabaseClient.auth.signOut());

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  handleSession(session);
  supabaseClient.auth.onAuthStateChange((_event, newSession) => handleSession(newSession));
}

let currentSession = null;
let currentProfile = null; // { role: 'admin'|'agent', is_active: boolean }

async function handleSession(session) {
  const wasSignedIn = !!currentSession;
  currentSession = session;
  if (!session) {
    currentProfile = null;
    showView('login');
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile) {
    await supabaseClient.auth.signOut();
    loginError.textContent = 'No se pudo verificar tu cuenta. Contacta al administrador.';
    loginError.classList.remove('hidden');
    showView('login');
    return;
  }

  if (!profile.is_active) {
    await supabaseClient.auth.signOut();
    loginError.textContent = 'Tu acceso fue desactivado por un administrador.';
    loginError.classList.remove('hidden');
    showView('login');
    return;
  }

  currentProfile = profile;
  document.getElementById('admin-user-email').textContent = session.user.email;
  applyRoleUI();
  showView('dashboard');
  if (!wasSignedIn) loadProperties();
}

function applyRoleUI() {
  const isAdmin = currentProfile && currentProfile.role === 'admin';
  document.getElementById('admin-role-badge').textContent = isAdmin ? 'Administrador' : 'Agente';
  document.querySelectorAll('.admin-only-tab').forEach((el) => el.classList.toggle('hidden', !isAdmin));
  document.getElementById('field-featured-wrap').classList.toggle('hidden', !isAdmin);
  document.getElementById('properties-panel-title').textContent = isAdmin ? 'Propiedades' : 'Mis propiedades';
  document.getElementById('properties-panel-hint').textContent = isAdmin
    ? 'Arrastra las filas por el ícono ⠿ para reordenar cómo aparecen en el landing.'
    : 'Aquí solo ves y editas las propiedades que tú creaste.';
  // Si el agente estaba parado en una pestaña que ya no le corresponde, vuelve a Propiedades.
  const activeTab = document.querySelector('.admin-tab.is-active');
  if (!isAdmin && activeTab && activeTab.classList.contains('admin-only-tab')) {
    document.querySelector('.admin-tab[data-tab="properties"]').click();
  }
}

/* ── Property list ── */
let properties = [];
const propertyListEl = document.getElementById('property-list');

async function loadProperties() {
  propertyListEl.innerHTML = '<p class="property-empty">Cargando propiedades…</p>';
  let query = supabaseClient.from('properties').select('*').order('sort_order', { ascending: true });
  if (!currentProfile || currentProfile.role !== 'admin') {
    query = query.eq('owner_id', currentSession.user.id);
  }
  const { data, error } = await query;

  if (error) {
    propertyListEl.innerHTML = '<p class="property-empty">Error al cargar propiedades: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  properties = data || [];
  renderPropertyList();
}

function renderPropertyList() {
  if (!properties.length) {
    propertyListEl.innerHTML = '<p class="property-empty">Aún no hay propiedades. Crea la primera con "+ Nueva propiedad".</p>';
    return;
  }

  const isAdmin = currentProfile && currentProfile.role === 'admin';

  propertyListEl.innerHTML = '';
  properties.forEach((property) => {
    const row = document.createElement('div');
    row.className = 'property-row';
    row.draggable = isAdmin;
    row.dataset.id = property.id;

    // El reordenar por drag&drop reescribe sort_order del subconjunto visible;
    // solo tiene sentido para el admin, que ve la lista completa. Si un agente
    // reordenara su propio subconjunto filtrado, pisaría sort_order de otros.
    const thumb = (property.photos && property.photos[0])
      ? '<img class="property-thumb" src="' + escapeHtml(property.photos[0]) + '" alt="">'
      : '<div class="property-thumb-placeholder">BASTET</div>';

    row.innerHTML =
      (isAdmin ? '<span class="property-drag-handle" title="Arrastra para reordenar">⠿</span>' : '<span style="width:18px;flex-shrink:0;"></span>') +
      thumb +
      '<div class="property-info">' +
        '<p class="property-info-title">' + (property.featured ? '★ ' : '') + escapeHtml(property.title) + '</p>' +
        '<p class="property-info-meta">' + escapeHtml(property.location) + ' · ' + escapeHtml(property.area) + ' · ' + escapeHtml(property.rooms) + '</p>' +
      '</div>' +
      '<span class="property-price">' + escapeHtml(property.price) + '</span>' +
      '<span class="status-badge ' + (property.status === 'sold' ? 'sold' : 'available') + '">' + (property.status === 'sold' ? 'Vendida' : 'Disponible') + '</span>' +
      '<div class="property-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="edit">Editar</button>' +
        '<button class="btn btn-danger btn-sm" data-action="delete">Eliminar</button>' +
      '</div>';

    row.querySelector('[data-action="edit"]').addEventListener('click', () => openPropertyForm(property));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProperty(property));

    row.addEventListener('dragstart', (e) => {
      dragSrcId = property.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (dragSrcId && dragSrcId !== property.id) reorderProperties(dragSrcId, property.id);
    });

    propertyListEl.appendChild(row);
  });
}

let dragSrcId = null;

async function reorderProperties(srcId, targetId) {
  const srcIndex = properties.findIndex((p) => p.id === srcId);
  const targetIndex = properties.findIndex((p) => p.id === targetId);
  if (srcIndex === -1 || targetIndex === -1) return;

  const [moved] = properties.splice(srcIndex, 1);
  properties.splice(targetIndex, 0, moved);
  properties.forEach((p, i) => { p.sort_order = i; });
  renderPropertyList();

  await Promise.all(properties.map((p) =>
    supabaseClient.from('properties').update({ sort_order: p.sort_order }).eq('id', p.id)
  ));
}

async function deleteProperty(property) {
  if (!confirm('¿Eliminar "' + property.title + '"? Esta acción no se puede deshacer.')) return;
  if (property.photos && property.photos.length) {
    await Promise.all(property.photos.map((url) => removePhotoFromStorage(url)));
  }
  const { error } = await supabaseClient.from('properties').delete().eq('id', property.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  loadProperties();
}

/* ── Property form (create/edit) ── */
const formModal = document.getElementById('property-form-modal');
const propertyForm = document.getElementById('property-form');
const formError = document.getElementById('property-form-error');
const photoGrid = document.getElementById('photo-grid');
const photoInput = document.getElementById('photo-input');
const photoDropzone = document.getElementById('photo-dropzone');

let formState = null;
let isNewProperty = true;

function ensureOptionExists(selectEl, value) {
  if (!value) return;
  const exists = Array.from(selectEl.options).some((o) => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value + ' (personalizado)';
    selectEl.appendChild(opt);
  }
}

function openPropertyForm(property) {
  formError.classList.add('hidden');
  if (property) {
    isNewProperty = false;
    formState = { ...property, photos: [...(property.photos || [])] };
    document.getElementById('property-form-title-heading').textContent = 'Editar propiedad';
  } else {
    isNewProperty = true;
    formState = {
      id: crypto.randomUUID(),
      title: '', location: '', price: '', area: '', rooms: '', baths: '',
      description: '', whatsapp: '', photos: [], status: 'available', featured: false,
    };
    document.getElementById('property-form-title-heading').textContent = 'Nueva propiedad';
  }

  const roomsSelect = document.getElementById('field-rooms');
  const bathsSelect = document.getElementById('field-baths');
  ensureOptionExists(roomsSelect, formState.rooms);
  ensureOptionExists(bathsSelect, formState.baths);

  const currentCity = (formState.location || '').split(',')[0].trim();
  ensureOptionExists(citySelectEl, currentCity);

  document.getElementById('field-title').value = formState.title;
  citySelectEl.value = currentCity;
  document.getElementById('field-price').value = formState.price;
  document.getElementById('field-area').value = formState.area;
  roomsSelect.value = formState.rooms;
  bathsSelect.value = formState.baths;
  document.getElementById('field-description').value = formState.description || '';
  document.getElementById('field-whatsapp').value = formState.whatsapp || '';
  document.getElementById('field-status').value = formState.status;
  document.getElementById('field-featured').checked = !!formState.featured;

  renderPhotoGrid();
  setUpLocationPicker(currentCity);
  formModal.classList.remove('hidden');
  setTimeout(() => { if (locationMap) locationMap.invalidateSize(); }, 50);
}

function closePropertyForm() {
  formModal.classList.add('hidden');
  formState = null;
}

document.getElementById('new-property-btn').addEventListener('click', () => openPropertyForm(null));
document.getElementById('property-form-cancel').addEventListener('click', closePropertyForm);
formModal.addEventListener('click', (e) => { if (e.target === formModal) closePropertyForm(); });

function renderPhotoGrid() {
  photoGrid.innerHTML = '';
  formState.photos.forEach((url) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML =
      '<img src="' + escapeHtml(url) + '" alt="">' +
      '<button type="button" class="photo-remove" aria-label="Quitar foto">×</button>';
    thumb.querySelector('.photo-remove').addEventListener('click', () => removePhoto(url));
    photoGrid.appendChild(thumb);
  });
}

function storagePathFromUrl(url) {
  const marker = '/object/public/' + PROPERTY_PHOTOS_BUCKET + '/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function removePhotoFromStorage(url) {
  const path = storagePathFromUrl(url);
  if (!path) return;
  try { await supabaseClient.storage.from(PROPERTY_PHOTOS_BUCKET).remove([path]); } catch (err) { /* best effort */ }
}

function removePhoto(url) {
  formState.photos = formState.photos.filter((p) => p !== url);
  renderPhotoGrid();
  removePhotoFromStorage(url);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function uploadPhotos(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    const placeholder = document.createElement('div');
    placeholder.className = 'photo-thumb is-uploading';
    photoGrid.appendChild(placeholder);

    const path = formState.id + '/' + Date.now() + '-' + sanitizeFilename(file.name);
    const { error: uploadError } = await supabaseClient.storage.from(PROPERTY_PHOTOS_BUCKET).upload(path, file);
    if (uploadError) {
      placeholder.remove();
      alert('Error al subir ' + file.name + ': ' + uploadError.message);
      continue;
    }
    const { data } = supabaseClient.storage.from(PROPERTY_PHOTOS_BUCKET).getPublicUrl(path);
    formState.photos.push(data.publicUrl);
    placeholder.remove();
    renderPhotoGrid();
  }
}

photoDropzone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => { uploadPhotos(photoInput.files); photoInput.value = ''; });
photoDropzone.addEventListener('dragover', (e) => { e.preventDefault(); photoDropzone.classList.add('is-dragover'); });
photoDropzone.addEventListener('dragleave', () => photoDropzone.classList.remove('is-dragover'));
photoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files.length) uploadPhotos(e.dataTransfer.files);
});

propertyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');

  const cityValue = citySelectEl.value.trim();
  const payload = {
    title: document.getElementById('field-title').value.trim(),
    location: cityValue ? cityValue + ', Bolivia' : '',
    price: document.getElementById('field-price').value.trim(),
    area: document.getElementById('field-area').value.trim(),
    rooms: document.getElementById('field-rooms').value.trim(),
    baths: document.getElementById('field-baths').value.trim(),
    description: document.getElementById('field-description').value.trim(),
    whatsapp: document.getElementById('field-whatsapp').value.trim() || null,
    status: document.getElementById('field-status').value,
    featured: document.getElementById('field-featured').checked,
    photos: formState.photos,
  };

  if (!payload.title || !payload.location || !payload.price || !payload.area || !payload.rooms || !payload.baths) {
    formError.textContent = 'Completa todos los campos obligatorios.';
    formError.classList.remove('hidden');
    return;
  }

  const submitBtn = document.getElementById('property-form-submit');
  submitBtn.disabled = true;

  let error;
  if (isNewProperty) {
    const sortOrder = properties.length ? Math.max(...properties.map((p) => p.sort_order)) + 1 : 0;
    ({ error } = await supabaseClient.from('properties').insert({ id: formState.id, ...payload, owner_id: currentSession.user.id, sort_order: sortOrder }));
  } else {
    ({ error } = await supabaseClient.from('properties').update(payload).eq('id', formState.id));
  }

  submitBtn.disabled = false;

  if (error) {
    formError.textContent = 'Error al guardar: ' + error.message;
    formError.classList.remove('hidden');
    return;
  }

  closePropertyForm();
  loadProperties();
});

/* ── Ubicación: mapa OpenStreetMap + búsqueda Nominatim (gratis, sin API key) ── */
let locationMap = null;
let locationMarker = null;
const DEFAULT_MAP_CENTER = [-16.5, -68.15]; // La Paz, Bolivia

function ensureMapInit() {
  if (locationMap || typeof L === 'undefined') return;
  locationMap = L.map('location-map').setView(DEFAULT_MAP_CENTER, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(locationMap);
  locationMap.on('click', (e) => {
    placeMarker(e.latlng.lat, e.latlng.lng);
    reverseGeocode(e.latlng.lat, e.latlng.lng);
  });
}

function placeMarker(lat, lng) {
  if (!locationMap) return;
  if (locationMarker) locationMarker.setLatLng([lat, lng]);
  else locationMarker = L.marker([lat, lng]).addTo(locationMap);
  locationMap.setView([lat, lng], 14);
}

function guessCityFromAddress(address) {
  return address.city || address.town || address.village || address.municipality || address.county || address.state || '';
}

function applyGeocodedCity(address) {
  const hint = document.getElementById('location-map-hint');
  const cityGuess = guessCityFromAddress(address);
  const matched = matchBoliviaCity(cityGuess);
  if (matched) {
    citySelectEl.value = matched;
    hint.textContent = 'Ciudad detectada: ' + matched + '.';
  } else if (cityGuess) {
    hint.textContent = 'No reconocemos "' + cityGuess + '" en la lista de ciudades; selecciónala manualmente arriba.';
  } else {
    hint.textContent = 'No se pudo determinar la ciudad; selecciónala manualmente arriba.';
  }
}

async function searchLocation(query, opts) {
  const updateCity = !opts || opts.updateCity !== false;
  if (!query || !query.trim()) return;
  ensureMapInit();
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=' + encodeURIComponent(query);
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const results = await res.json();
    if (!results.length) {
      if (updateCity) alert('No se encontró esa ubicación. Prueba con otro término de búsqueda, o selecciona la ciudad manualmente.');
      return;
    }
    const r = results[0];
    placeMarker(parseFloat(r.lat), parseFloat(r.lon));
    if (updateCity) applyGeocodedCity(r.address || {});
  } catch (err) {
    if (updateCity) alert('No se pudo buscar la ubicación (revisa tu conexión).');
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=' + lat + '&lon=' + lng;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const r = await res.json();
    applyGeocodedCity(r.address || {});
  } catch (err) {
    document.getElementById('location-map-hint').textContent = 'No se pudo determinar la ciudad; selecciónala manualmente arriba.';
  }
}

function setUpLocationPicker(existingCity) {
  ensureMapInit();
  document.getElementById('location-search').value = '';
  document.getElementById('location-map-hint').textContent = 'Si reconocemos la ciudad en el mapa, la seleccionamos automáticamente arriba.';
  if (locationMarker) { locationMap.removeLayer(locationMarker); locationMarker = null; }
  locationMap.setView(DEFAULT_MAP_CENTER, 12);
  if (existingCity) searchLocation(existingCity + ', Bolivia', { updateCity: false });
}

document.getElementById('location-search-btn').addEventListener('click', () => {
  searchLocation(document.getElementById('location-search').value);
});
document.getElementById('location-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchLocation(document.getElementById('location-search').value); }
});

/* ── Descripción: etiquetas rápidas ── */
document.querySelectorAll('.tag-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset.tag;
    const textarea = document.getElementById('field-description');
    if (textarea.value.includes(tag)) return;
    const current = textarea.value.trim().replace(/\.+$/, '');
    textarea.value = current ? current + '. ' + tag + '.' : tag + '.';
    textarea.focus();
  });
});

/* ── Tabs ── */
document.querySelectorAll('.admin-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== 'tab-panel-' + btn.dataset.tab);
    });
    if (btn.dataset.tab === 'partners') loadPartners();
    if (btn.dataset.tab === 'testimonials') loadTestimonials();
    if (btn.dataset.tab === 'admins') loadUsers();
  });
});

/* ── Marcas (logos de empresas aliadas) ── */
let partners = [];
let partnerDragSrcId = null;
const partnerListEl = document.getElementById('partner-list');
const partnerNameInput = document.getElementById('partner-name-input');
const partnerDropzone = document.getElementById('partner-dropzone');
const partnerPhotoInput = document.getElementById('partner-photo-input');
const partnerAddError = document.getElementById('partner-add-error');
const PARTNER_LOGOS_BUCKET = 'partner-logos';

async function loadPartners() {
  partnerListEl.innerHTML = '<p class="property-empty">Cargando…</p>';
  const { data, error } = await supabaseClient.from('partners').select('*').order('sort_order', { ascending: true });
  if (error) {
    partnerListEl.innerHTML = '<p class="property-empty">Error al cargar: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  partners = data || [];
  renderPartnerList();
}

function renderPartnerList() {
  if (!partners.length) {
    partnerListEl.innerHTML = '<p class="property-empty">Aún no hay logos. Agrega el primero arriba.</p>';
    return;
  }
  partnerListEl.innerHTML = '';
  partners.forEach((partner) => {
    const row = document.createElement('div');
    row.className = 'partner-row';
    row.draggable = true;
    row.dataset.id = partner.id;
    row.innerHTML =
      '<span class="property-drag-handle" title="Arrastra para reordenar">⠿</span>' +
      '<img class="partner-logo-thumb" src="' + escapeHtml(partner.logo_url) + '" alt="">' +
      '<span class="partner-info">' + escapeHtml(partner.name || '(sin nombre)') + '</span>' +
      '<button type="button" class="btn btn-danger btn-sm" data-action="delete">Eliminar</button>';

    row.querySelector('[data-action="delete"]').addEventListener('click', () => deletePartner(partner));

    row.addEventListener('dragstart', (e) => {
      partnerDragSrcId = partner.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (partnerDragSrcId && partnerDragSrcId !== partner.id) reorderPartners(partnerDragSrcId, partner.id);
    });

    partnerListEl.appendChild(row);
  });
}

async function reorderPartners(srcId, targetId) {
  const srcIndex = partners.findIndex((p) => p.id === srcId);
  const targetIndex = partners.findIndex((p) => p.id === targetId);
  if (srcIndex === -1 || targetIndex === -1) return;
  const [moved] = partners.splice(srcIndex, 1);
  partners.splice(targetIndex, 0, moved);
  partners.forEach((p, i) => { p.sort_order = i; });
  renderPartnerList();
  await Promise.all(partners.map((p) => supabaseClient.from('partners').update({ sort_order: p.sort_order }).eq('id', p.id)));
}

function partnerStoragePathFromUrl(url) {
  const marker = '/object/public/' + PARTNER_LOGOS_BUCKET + '/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function deletePartner(partner) {
  if (!confirm('¿Eliminar el logo "' + (partner.name || 'sin nombre') + '"?')) return;
  const path = partnerStoragePathFromUrl(partner.logo_url);
  if (path) { try { await supabaseClient.storage.from(PARTNER_LOGOS_BUCKET).remove([path]); } catch (err) { /* best effort */ } }
  const { error } = await supabaseClient.from('partners').delete().eq('id', partner.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  loadPartners();
}

async function addPartner(file) {
  partnerAddError.classList.add('hidden');
  const name = partnerNameInput.value.trim();
  const id = crypto.randomUUID();
  const path = id + '/' + Date.now() + '-' + sanitizeFilename(file.name);

  const placeholder = document.createElement('div');
  placeholder.className = 'photo-thumb is-uploading';
  partnerDropzone.insertAdjacentElement('afterend', placeholder);

  const { error: uploadError } = await supabaseClient.storage.from(PARTNER_LOGOS_BUCKET).upload(path, file);
  placeholder.remove();
  if (uploadError) {
    partnerAddError.textContent = 'Error al subir el logo: ' + uploadError.message;
    partnerAddError.classList.remove('hidden');
    return;
  }
  const { data } = supabaseClient.storage.from(PARTNER_LOGOS_BUCKET).getPublicUrl(path);
  const sortOrder = partners.length ? Math.max(...partners.map((p) => p.sort_order)) + 1 : 0;
  const { error } = await supabaseClient.from('partners').insert({ id, name, logo_url: data.publicUrl, sort_order: sortOrder });
  if (error) {
    partnerAddError.textContent = 'Error al guardar: ' + error.message;
    partnerAddError.classList.remove('hidden');
    return;
  }
  partnerNameInput.value = '';
  loadPartners();
}

partnerDropzone.addEventListener('click', () => partnerPhotoInput.click());
partnerPhotoInput.addEventListener('change', () => {
  if (partnerPhotoInput.files[0]) addPartner(partnerPhotoInput.files[0]);
  partnerPhotoInput.value = '';
});
partnerDropzone.addEventListener('dragover', (e) => { e.preventDefault(); partnerDropzone.classList.add('is-dragover'); });
partnerDropzone.addEventListener('dragleave', () => partnerDropzone.classList.remove('is-dragover'));
partnerDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  partnerDropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files[0]) addPartner(e.dataTransfer.files[0]);
});

/* ── Testimonios ── */
let testimonials = [];
let testimonialDragSrcId = null;
let testimonialPhotoUrl = null;
const testimonialListEl = document.getElementById('testimonial-list');
const testimonialAddForm = document.getElementById('testimonial-add-form');
const testimonialAddError = document.getElementById('testimonial-add-error');
const testimonialDropzone = document.getElementById('testimonial-dropzone');
const testimonialPhotoInput = document.getElementById('testimonial-photo-input');
const testimonialPhotoPreview = document.getElementById('testimonial-photo-preview');
const TESTIMONIAL_PHOTOS_BUCKET = 'testimonial-photos';

async function loadTestimonials() {
  testimonialListEl.innerHTML = '<p class="property-empty">Cargando…</p>';
  const { data, error } = await supabaseClient.from('testimonials').select('*').order('sort_order', { ascending: true });
  if (error) {
    testimonialListEl.innerHTML = '<p class="property-empty">Error al cargar: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  testimonials = data || [];
  renderTestimonialList();
}

function renderTestimonialList() {
  if (!testimonials.length) {
    testimonialListEl.innerHTML = '<p class="property-empty">Aún no hay testimonios. Agrega el primero arriba.</p>';
    return;
  }
  testimonialListEl.innerHTML = '';
  testimonials.forEach((testimonial) => {
    const row = document.createElement('div');
    row.className = 'partner-row';
    row.draggable = true;
    row.dataset.id = testimonial.id;

    const initial = (testimonial.name || '?').trim().charAt(0).toUpperCase();
    const photo = testimonial.photo_url
      ? '<img class="testimonial-photo-thumb" src="' + escapeHtml(testimonial.photo_url) + '" alt="">'
      : '<div class="testimonial-photo-thumb-placeholder">' + escapeHtml(initial) + '</div>';

    row.innerHTML =
      '<span class="property-drag-handle" title="Arrastra para reordenar">⠿</span>' +
      photo +
      '<div class="testimonial-info">' +
        '<p class="testimonial-info-name">' + escapeHtml(testimonial.name) + '</p>' +
        '<p class="testimonial-info-role">' + escapeHtml(testimonial.role_label) + '</p>' +
        '<p class="testimonial-info-quote">&ldquo;' + escapeHtml(testimonial.quote) + '&rdquo;</p>' +
      '</div>' +
      '<button type="button" class="btn btn-danger btn-sm" data-action="delete">Eliminar</button>';

    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTestimonial(testimonial));

    row.addEventListener('dragstart', (e) => {
      testimonialDragSrcId = testimonial.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (testimonialDragSrcId && testimonialDragSrcId !== testimonial.id) reorderTestimonials(testimonialDragSrcId, testimonial.id);
    });

    testimonialListEl.appendChild(row);
  });
}

async function reorderTestimonials(srcId, targetId) {
  const srcIndex = testimonials.findIndex((t) => t.id === srcId);
  const targetIndex = testimonials.findIndex((t) => t.id === targetId);
  if (srcIndex === -1 || targetIndex === -1) return;
  const [moved] = testimonials.splice(srcIndex, 1);
  testimonials.splice(targetIndex, 0, moved);
  testimonials.forEach((t, i) => { t.sort_order = i; });
  renderTestimonialList();
  await Promise.all(testimonials.map((t) => supabaseClient.from('testimonials').update({ sort_order: t.sort_order }).eq('id', t.id)));
}

function testimonialStoragePathFromUrl(url) {
  const marker = '/object/public/' + TESTIMONIAL_PHOTOS_BUCKET + '/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function deleteTestimonial(testimonial) {
  if (!confirm('¿Eliminar el testimonio de "' + testimonial.name + '"?')) return;
  if (testimonial.photo_url) {
    const path = testimonialStoragePathFromUrl(testimonial.photo_url);
    if (path) { try { await supabaseClient.storage.from(TESTIMONIAL_PHOTOS_BUCKET).remove([path]); } catch (err) { /* best effort */ } }
  }
  const { error } = await supabaseClient.from('testimonials').delete().eq('id', testimonial.id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  loadTestimonials();
}

function renderTestimonialPhotoPreview() {
  testimonialPhotoPreview.innerHTML = '';
  if (!testimonialPhotoUrl) return;
  const thumb = document.createElement('div');
  thumb.className = 'photo-thumb';
  thumb.style.marginTop = '10px';
  thumb.innerHTML =
    '<img src="' + escapeHtml(testimonialPhotoUrl) + '" alt="">' +
    '<button type="button" class="photo-remove" aria-label="Quitar foto">×</button>';
  thumb.querySelector('.photo-remove').addEventListener('click', () => { testimonialPhotoUrl = null; renderTestimonialPhotoPreview(); });
  testimonialPhotoPreview.appendChild(thumb);
}

async function uploadTestimonialPhoto(file) {
  const placeholder = document.createElement('div');
  placeholder.className = 'photo-thumb is-uploading';
  placeholder.style.marginTop = '10px';
  testimonialPhotoPreview.appendChild(placeholder);

  const path = crypto.randomUUID() + '/' + Date.now() + '-' + sanitizeFilename(file.name);
  const { error: uploadError } = await supabaseClient.storage.from(TESTIMONIAL_PHOTOS_BUCKET).upload(path, file);
  placeholder.remove();
  if (uploadError) {
    testimonialAddError.textContent = 'Error al subir la foto: ' + uploadError.message;
    testimonialAddError.classList.remove('hidden');
    return;
  }
  const { data } = supabaseClient.storage.from(TESTIMONIAL_PHOTOS_BUCKET).getPublicUrl(path);
  testimonialPhotoUrl = data.publicUrl;
  renderTestimonialPhotoPreview();
}

testimonialDropzone.addEventListener('click', () => testimonialPhotoInput.click());
testimonialPhotoInput.addEventListener('change', () => {
  if (testimonialPhotoInput.files[0]) uploadTestimonialPhoto(testimonialPhotoInput.files[0]);
  testimonialPhotoInput.value = '';
});
testimonialDropzone.addEventListener('dragover', (e) => { e.preventDefault(); testimonialDropzone.classList.add('is-dragover'); });
testimonialDropzone.addEventListener('dragleave', () => testimonialDropzone.classList.remove('is-dragover'));
testimonialDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  testimonialDropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files[0]) uploadTestimonialPhoto(e.dataTransfer.files[0]);
});

testimonialAddForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  testimonialAddError.classList.add('hidden');

  const name = document.getElementById('testimonial-name-input').value.trim();
  const roleLabel = document.getElementById('testimonial-role-input').value.trim();
  const quote = document.getElementById('testimonial-quote-input').value.trim();
  if (!name || !roleLabel || !quote) {
    testimonialAddError.textContent = 'Completa todos los campos obligatorios.';
    testimonialAddError.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('testimonial-add-submit');
  btn.disabled = true;
  const sortOrder = testimonials.length ? Math.max(...testimonials.map((t) => t.sort_order)) + 1 : 0;
  const { error } = await supabaseClient.from('testimonials').insert({
    name, role_label: roleLabel, quote, photo_url: testimonialPhotoUrl, sort_order: sortOrder,
  });
  btn.disabled = false;

  if (error) {
    testimonialAddError.textContent = 'Error al guardar: ' + error.message;
    testimonialAddError.classList.remove('hidden');
    return;
  }

  testimonialAddForm.reset();
  testimonialPhotoUrl = null;
  renderTestimonialPhotoPreview();
  loadTestimonials();
});

/* ── Administradores: invitar nuevos usuarios (vía Edge Function, ver supabase/functions/invite-admin) ── */
document.getElementById('invite-admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('invite-admin-error');
  const successEl = document.getElementById('invite-admin-success');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const email = document.getElementById('invite-email').value.trim();
  const btn = document.getElementById('invite-admin-submit');
  btn.disabled = true;

  const { data, error } = await supabaseClient.functions.invoke('invite-admin', { body: { email } });

  btn.disabled = false;

  if (error || (data && data.error)) {
    errorEl.textContent = 'Error al invitar: ' + (data && data.error ? data.error : error.message);
    errorEl.classList.remove('hidden');
    return;
  }

  successEl.textContent = 'Invitación enviada a ' + email + '.';
  successEl.classList.remove('hidden');
  document.getElementById('invite-admin-form').reset();
  loadUsers();
});

/* ── Administradores: lista de usuarios (activar/desactivar) ── */
const userListEl = document.getElementById('user-list');

async function loadUsers() {
  userListEl.innerHTML = '<p class="property-empty">Cargando…</p>';
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    userListEl.innerHTML = '<p class="property-empty">Error al cargar usuarios: ' + escapeHtml(error.message) + '</p>';
    return;
  }
  renderUserList(data || []);
}

function renderUserList(users) {
  if (!users.length) {
    userListEl.innerHTML = '<p class="property-empty">No hay usuarios registrados todavía.</p>';
    return;
  }
  userListEl.innerHTML = '';
  users.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'user-row' + (user.is_active ? '' : ' is-inactive');
    const isSelf = currentSession && user.id === currentSession.user.id;

    row.innerHTML =
      '<span class="user-row-email">' + escapeHtml(user.email || user.id) + (isSelf ? ' (tú)' : '') + '</span>' +
      (isSelf
        ? '<span class="role-tag ' + (user.role === 'admin' ? 'admin' : 'agent') + '">' + (user.role === 'admin' ? 'Admin' : 'Agente') + '</span>'
        : '<select class="role-select" data-action="role"><option value="agent"' + (user.role === 'agent' ? ' selected' : '') + '>Agente</option><option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option></select>') +
      '<span class="status-badge ' + (user.is_active ? 'available' : 'sold') + '">' + (user.is_active ? 'Activo' : 'Desactivado') + '</span>' +
      (isSelf ? '' : '<button type="button" class="btn btn-sm ' + (user.is_active ? 'btn-danger' : 'btn-ghost') + '" data-action="toggle">' + (user.is_active ? 'Desactivar' : 'Reactivar') + '</button>');

    const toggleBtn = row.querySelector('[data-action="toggle"]');
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleUserActive(user));

    const roleSelect = row.querySelector('[data-action="role"]');
    if (roleSelect) roleSelect.addEventListener('change', () => changeUserRole(user, roleSelect));

    userListEl.appendChild(row);
  });
}

async function toggleUserActive(user) {
  const nextActive = !user.is_active;
  const verb = nextActive ? 'reactivar' : 'desactivar';
  if (!confirm('¿Seguro que quieres ' + verb + ' a ' + (user.email || user.id) + '?')) return;
  const { error } = await supabaseClient.from('profiles').update({ is_active: nextActive }).eq('id', user.id);
  if (error) { alert('Error: ' + error.message); return; }
  loadUsers();
}

async function changeUserRole(user, selectEl) {
  const nextRole = selectEl.value;
  if (nextRole === user.role) return;
  const label = nextRole === 'admin' ? 'administrador' : 'agente';
  if (!confirm('¿Cambiar a ' + (user.email || user.id) + ' a ' + label + '?')) {
    selectEl.value = user.role;
    return;
  }
  selectEl.disabled = true;
  const { error } = await supabaseClient.from('profiles').update({ role: nextRole }).eq('id', user.id);
  selectEl.disabled = false;
  if (error) { alert('Error: ' + error.message); selectEl.value = user.role; return; }
  loadUsers();
}

/* ── Mi cuenta: cambiar contraseña ── */
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('change-password-error');
  const successEl = document.getElementById('change-password-success');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const password = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('new-password-confirm').value;
  if (password !== confirmPassword) {
    errorEl.textContent = 'Las contraseñas no coinciden.';
    errorEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('change-password-submit');
  btn.disabled = true;
  const { error } = await supabaseClient.auth.updateUser({ password });
  btn.disabled = false;

  if (error) {
    errorEl.textContent = traduceAuthError(error.message);
    errorEl.classList.remove('hidden');
    return;
  }

  successEl.textContent = 'Contraseña actualizada.';
  successEl.classList.remove('hidden');
  document.getElementById('change-password-form').reset();
});

init();
