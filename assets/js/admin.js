function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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
function handleSession(session) {
  const wasSignedIn = !!currentSession;
  currentSession = session;
  if (session) {
    document.getElementById('admin-user-email').textContent = session.user.email;
    showView('dashboard');
    if (!wasSignedIn) loadProperties();
  } else {
    showView('login');
  }
}

/* ── Property list ── */
let properties = [];
const propertyListEl = document.getElementById('property-list');

async function loadProperties() {
  propertyListEl.innerHTML = '<p class="property-empty">Cargando propiedades…</p>';
  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')
    .order('sort_order', { ascending: true });

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

  propertyListEl.innerHTML = '';
  properties.forEach((property) => {
    const row = document.createElement('div');
    row.className = 'property-row';
    row.draggable = true;
    row.dataset.id = property.id;

    const thumb = (property.photos && property.photos[0])
      ? '<img class="property-thumb" src="' + escapeHtml(property.photos[0]) + '" alt="">'
      : '<div class="property-thumb-placeholder">MAAT</div>';

    row.innerHTML =
      '<span class="property-drag-handle" title="Arrastra para reordenar">⠿</span>' +
      thumb +
      '<div class="property-info">' +
        '<p class="property-info-title">' + escapeHtml(property.title) + '</p>' +
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
      description: '', whatsapp: '', photos: [], status: 'available',
    };
    document.getElementById('property-form-title-heading').textContent = 'Nueva propiedad';
  }

  document.getElementById('field-title').value = formState.title;
  document.getElementById('field-location').value = formState.location;
  document.getElementById('field-price').value = formState.price;
  document.getElementById('field-area').value = formState.area;
  document.getElementById('field-rooms').value = formState.rooms;
  document.getElementById('field-baths').value = formState.baths;
  document.getElementById('field-description').value = formState.description || '';
  document.getElementById('field-whatsapp').value = formState.whatsapp || '';
  document.getElementById('field-status').value = formState.status;

  renderPhotoGrid();
  formModal.classList.remove('hidden');
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

  const payload = {
    title: document.getElementById('field-title').value.trim(),
    location: document.getElementById('field-location').value.trim(),
    price: document.getElementById('field-price').value.trim(),
    area: document.getElementById('field-area').value.trim(),
    rooms: document.getElementById('field-rooms').value.trim(),
    baths: document.getElementById('field-baths').value.trim(),
    description: document.getElementById('field-description').value.trim(),
    whatsapp: document.getElementById('field-whatsapp').value.trim() || null,
    status: document.getElementById('field-status').value,
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
    ({ error } = await supabaseClient.from('properties').insert({ id: formState.id, ...payload, sort_order: sortOrder }));
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

init();
