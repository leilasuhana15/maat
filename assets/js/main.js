const WHATSAPP_PHONE = '59170613687';
const WHATSAPP_GENERIC_MESSAGE = 'Hola MAAT Firma Legal, quiero solicitar una evaluación gratuita para vender mi inmueble, esta es la ubicación del mismo ⬇️';

function normalizePhone(phone) {
  return (phone || '').replace(/[^0-9]/g, '');
}

function whatsappUrl(message, phone) {
  return 'https://api.whatsapp.com/send?phone=' + (normalizePhone(phone) || WHATSAPP_PHONE) + '&text=' + encodeURIComponent(message);
}

document.querySelectorAll('[data-whatsapp-generic]').forEach((el) => {
  el.href = whatsappUrl(WHATSAPP_GENERIC_MESSAGE);
});

/* ── Nav ── */
const navbar = document.querySelector('.navbar');
const burger = document.querySelector('.navbar-burger');
const mobilePanel = document.querySelector('.navbar-mobile-panel');

function setMenuOpen(open) {
  mobilePanel.classList.toggle('is-open', open);
  navbar.classList.toggle('is-menu-open', open);
}
burger.addEventListener('click', () => setMenuOpen(!mobilePanel.classList.contains('is-open')));
mobilePanel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenuOpen(false)));

window.addEventListener('scroll', () => {
  navbar.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive: true });

/* ── Reveal on scroll ── */
const revealObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 })
  : null;
document.querySelectorAll('.reveal').forEach((el) => {
  if (revealObserver) revealObserver.observe(el);
  else el.classList.add('is-visible');
});

/* ── Propiedades: fetch + city filter + ring carousel + modal ── */
const RING_SIZE = 12;
const RING_RADIUS = 520;
const RING_STEP = 360 / RING_SIZE;
const RING_CULL_ANGLE = 50;
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ringStage = document.getElementById('ring-stage');
const cityFiltersEl = document.getElementById('city-filters');
const modalBackdrop = document.getElementById('property-modal-backdrop');
const modal = document.getElementById('property-modal');

let allProperties = [];
let cityFilter = 'Todas';
let ringCards = [];
let ringPhase = -2;
let ringLast = null;
let ringRafId = null;
let ringDragging = false;
let ringMoved = false;
let ringDragStartX = 0;
let ringDragStartPhase = 0;
let ringPauseUntil = 0;

let selectedProperty = null;
let selectedPhotoIndex = 0;

function placeholderImgHtml(title) {
  return '<div class="ring-card-img-placeholder">' + escapeHtml(title || 'MAAT') + '</div>';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadProperties() {
  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')
    .eq('status', 'available')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error cargando propiedades:', error);
    allProperties = [];
  } else {
    allProperties = data || [];
  }

  buildCityFilters();
  renderRing();
}

function buildCityFilters() {
  const presentCities = new Set(allProperties.map((p) => (p.location || '').split(',')[0].trim()));
  const cities = ['Todas'].concat(BOLIVIA_CITIES.filter((c) => presentCities.has(c)));

  cityFiltersEl.innerHTML = '';
  if (cities.length <= 1) return;

  cities.forEach((city) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'city-pill' + (city === cityFilter ? ' is-active' : '');
    btn.textContent = city;
    btn.addEventListener('click', () => {
      cityFilter = city;
      buildCityFilters();
      renderRing();
    });
    cityFiltersEl.appendChild(btn);
  });
}

function filteredProperties() {
  if (cityFilter === 'Todas') return allProperties;
  const filtered = allProperties.filter((p) => (p.location || '').startsWith(cityFilter));
  return filtered.length ? filtered : allProperties;
}

function renderRing() {
  stopRingAnimation();
  ringStage.innerHTML = '';
  ringCards = [];

  const list = filteredProperties();
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'ring-empty';
    empty.textContent = 'Pronto publicaremos nuevas propiedades disponibles.';
    ringStage.appendChild(empty);
    return;
  }

  for (let i = 0; i < RING_SIZE; i++) {
    const property = list[i % list.length];
    const card = document.createElement('div');
    card.className = 'ring-card';

    const firstPhoto = (property.photos && property.photos[0]) || null;
    card.innerHTML = firstPhoto
      ? '<img class="ring-card-img" src="' + escapeHtml(firstPhoto) + '" alt="' + escapeHtml(property.title) + '" loading="lazy">'
      : placeholderImgHtml(property.title);
    card.innerHTML +=
      '<div class="ring-card-overlay"></div>' +
      '<div class="ring-card-label"><span>' + escapeHtml(property.title) + '</span></div>';

    card.addEventListener('click', () => {
      if (ringMoved) { ringMoved = false; return; }
      openProperty(property);
    });

    ringStage.appendChild(card);
    ringCards.push(card);
  }

  updateRing();
  startRingAnimation();
}

function updateRing() {
  for (let i = 0; i < ringCards.length; i++) {
    const el = ringCards[i];
    if (!el) continue;
    let a = ((i * RING_STEP + ringPhase) % 360 + 540) % 360 - 180;
    if (Math.abs(a) > RING_CULL_ANGLE) { el.style.visibility = 'hidden'; continue; }
    el.style.visibility = 'visible';
    const r = (a * Math.PI) / 180, c = Math.cos(r);
    el.style.transform = 'translate3d(' + (RING_RADIUS * Math.sin(r)).toFixed(1) + 'px,0,' + (RING_RADIUS * (1 - c)).toFixed(1) + 'px) rotateY(' + (-a).toFixed(1) + 'deg)';
    el.style.filter = 'brightness(' + (0.72 + 0.5 * (1 / c - 1)).toFixed(3) + ')';
    el.style.zIndex = String(Math.round(1000 - Math.abs(a)));
  }
}

function startRingAnimation() {
  if (reducedMotion || typeof requestAnimationFrame === 'undefined') return;
  ringLast = null;
  const tick = (t) => {
    if (ringLast == null) ringLast = t;
    const dt = Math.min((t - ringLast) / 1000, 0.1);
    ringLast = t;
    const now = performance.now();
    if (!ringDragging && !(ringPauseUntil && now < ringPauseUntil)) {
      ringPhase -= 5 * dt;
    }
    updateRing();
    ringRafId = requestAnimationFrame(tick);
  };
  ringRafId = requestAnimationFrame(tick);
}

function stopRingAnimation() {
  if (ringRafId) cancelAnimationFrame(ringRafId);
  ringRafId = null;
}

ringStage.addEventListener('pointerdown', (e) => {
  ringDragging = true;
  ringMoved = false;
  ringDragStartX = e.clientX;
  ringDragStartPhase = ringPhase;
  if (ringStage.setPointerCapture) { try { ringStage.setPointerCapture(e.pointerId); } catch (err) {} }
});
ringStage.addEventListener('pointermove', (e) => {
  if (!ringDragging) return;
  const dx = e.clientX - ringDragStartX;
  if (Math.abs(dx) > 6) ringMoved = true;
  ringPhase = ringDragStartPhase + dx * 0.18;
  updateRing();
});
function endRingDrag() {
  if (!ringDragging) return;
  ringDragging = false;
  ringLast = null;
  ringPauseUntil = performance.now() + 1600;
}
ringStage.addEventListener('pointerup', endRingDrag);
ringStage.addEventListener('pointercancel', endRingDrag);
ringStage.addEventListener('pointerleave', endRingDrag);

/* ── Modal ── */
function openProperty(property) {
  selectedProperty = property;
  selectedPhotoIndex = 0;
  renderModal();
  modalBackdrop.classList.remove('hidden');
}

function closeProperty() {
  selectedProperty = null;
  modalBackdrop.classList.add('hidden');
}

function renderModal() {
  if (!selectedProperty) return;
  const p = selectedProperty;
  const photos = (p.photos && p.photos.length) ? p.photos : [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[selectedPhotoIndex] : null;

  const message = 'Hola MAAT Firma Legal, me interesa la propiedad: ' + p.title + ' (' + p.location + '). ¿Podrían brindarme más información?';

  modal.innerHTML =
    '<button class="property-modal-close" aria-label="Cerrar" id="property-modal-close">×</button>' +
    '<div class="property-modal-gallery">' +
      (currentPhoto
        ? '<img class="property-modal-img" src="' + escapeHtml(currentPhoto) + '" alt="' + escapeHtml(p.title) + '">'
        : '<div class="ring-card-img-placeholder" style="height:100%;">' + escapeHtml(p.title) + '</div>') +
      (photos.length > 1
        ? '<button class="property-modal-nav property-modal-nav--prev" id="modal-prev" aria-label="Foto anterior">‹</button>' +
          '<button class="property-modal-nav property-modal-nav--next" id="modal-next" aria-label="Foto siguiente">›</button>' +
          '<div class="property-modal-dots">' +
            photos.map((_, i) => '<span class="property-modal-dot' + (i === selectedPhotoIndex ? ' is-active' : '') + '"></span>').join('') +
          '</div>'
        : '') +
    '</div>' +
    '<div class="property-modal-body">' +
      '<div>' +
        '<p class="property-modal-location">' + escapeHtml(p.location) + '</p>' +
        '<h3 class="property-modal-title">' + escapeHtml(p.title) + '</h3>' +
        '<p class="property-modal-price">' + escapeHtml(p.price) + '</p>' +
      '</div>' +
      '<div class="property-modal-specs">' +
        '<div><p class="property-modal-spec-label">Área</p><p class="property-modal-spec-value">' + escapeHtml(p.area) + '</p></div>' +
        '<div><p class="property-modal-spec-label">Ambientes</p><p class="property-modal-spec-value">' + escapeHtml(p.rooms) + '</p></div>' +
        '<div><p class="property-modal-spec-label">Baños</p><p class="property-modal-spec-value">' + escapeHtml(p.baths) + '</p></div>' +
      '</div>' +
      '<p class="property-modal-desc">' + escapeHtml(p.description) + '</p>' +
      '<a class="cta-button cta-button--block" style="margin-top:8px;" href="' + whatsappUrl(message, p.whatsapp) + '" target="_blank" rel="noopener"><span>Consultar por WhatsApp</span></a>' +
    '</div>';

  document.getElementById('property-modal-close').addEventListener('click', closeProperty);
  const prevBtn = document.getElementById('modal-prev');
  const nextBtn = document.getElementById('modal-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { selectedPhotoIndex = (selectedPhotoIndex - 1 + photos.length) % photos.length; renderModal(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { selectedPhotoIndex = (selectedPhotoIndex + 1) % photos.length; renderModal(); });
}

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeProperty();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeProperty();
});

loadProperties();
