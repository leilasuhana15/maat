const WHATSAPP_PHONE = '59177666205';
const WHATSAPP_GENERIC_MESSAGE = 'Hola Bastet, quiero solicitar una evaluación gratuita para vender mi inmueble, esta es la ubicación del mismo ⬇️';

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPriceUSD(price) {
  const digits = (price || '').toString().replace(/[^0-9]/g, '');
  if (!digits) return escapeHtml(price || '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' USD';
}

const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Carrusel 3D en anillo, genérico (lo usan Propiedades y Testimonios) ──
   Reproduce la misma física: rotación automática + arrastre, con la tarjeta
   resuelta en pointerdown (no en el evento "click") para que no falle si el
   anillo se movió entre el down y el up. */
function createRingCarousel({ stage, radius, size = 12, cull = 50, speed = 5, buildCard, onSelect, emptyText = 'Próximamente.', brightCenter = false }) {
  const step = 360 / size;
  let cards = [];
  let phase = -2;
  let last = null;
  let rafId = null;
  let dragging = false;
  let moved = false;
  let dragStartX = 0;
  let dragStartPhase = 0;
  let pauseUntil = 0;
  let downItem = null;

  function update() {
    for (let i = 0; i < cards.length; i++) {
      const el = cards[i];
      if (!el) continue;
      let a = ((i * step + phase) % 360 + 540) % 360 - 180;
      if (Math.abs(a) > cull) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      const r = (a * Math.PI) / 180, c = Math.cos(r);
      el.style.transform = 'translate3d(' + (radius * Math.sin(r)).toFixed(1) + 'px,0,' + (radius * (1 - c)).toFixed(1) + 'px) rotateY(' + (-a).toFixed(1) + 'deg)';
      const brightness = brightCenter ? (1 - 0.8 * (1 / c - 1)) : (0.72 + 0.5 * (1 / c - 1));
      el.style.filter = 'brightness(' + brightness.toFixed(3) + ')';
      el.style.zIndex = String(Math.round(1000 - Math.abs(a)));
    }
  }

  function startAnim() {
    if (reducedMotion || typeof requestAnimationFrame === 'undefined') return;
    last = null;
    const tick = (t) => {
      if (last == null) last = t;
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const now = performance.now();
      if (!dragging && !(pauseUntil && now < pauseUntil)) phase -= speed * dt;
      update();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopAnim() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function render(items) {
    stopAnim();
    stage.innerHTML = '';
    cards = [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ring-empty';
      empty.textContent = emptyText;
      stage.appendChild(empty);
      return;
    }
    for (let i = 0; i < size; i++) {
      const item = items[i % items.length];
      const card = buildCard(item);
      card.__item = item;
      stage.appendChild(card);
      cards.push(card);
    }
    update();
    startAnim();
  }

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    dragStartX = e.clientX;
    dragStartPhase = phase;
    const cardEl = e.target.closest ? e.target.closest('[data-ring-card]') : null;
    downItem = cardEl ? cardEl.__item : null;
    if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) moved = true;
    phase = dragStartPhase + dx * 0.18;
    update();
  });
  function end(shouldSelect) {
    if (!dragging) return;
    dragging = false;
    last = null;
    pauseUntil = performance.now() + 1600;
    if (shouldSelect && !moved && downItem && onSelect) onSelect(downItem);
    downItem = null;
  }
  stage.addEventListener('pointerup', () => end(true));
  stage.addEventListener('pointercancel', () => end(false));
  stage.addEventListener('pointerleave', () => end(false));

  return { render };
}

/* ── Propiedades: fetch + city filter + carrusel + modal ── */
const RING_SIZE = 12;
const RING_RADIUS = 520;

const ringStage = document.getElementById('ring-stage');
const cityFiltersEl = document.getElementById('city-filters');
const modalBackdrop = document.getElementById('property-modal-backdrop');
const modal = document.getElementById('property-modal');

let allProperties = [];
let cityFilter = 'Todas';
let selectedProperty = null;
let selectedPhotoIndex = 0;

function placeholderImgHtml(title) {
  return '<div class="ring-card-img-placeholder">' + escapeHtml(title || 'BASTET') + '</div>';
}

function buildPropertyCard(property) {
  const card = document.createElement('div');
  card.className = 'ring-card' + (property.featured ? ' ring-card--featured' : '');
  card.setAttribute('data-ring-card', '');
  const firstPhoto = (property.photos && property.photos[0]) || null;
  card.innerHTML = firstPhoto
    ? '<img class="ring-card-img" src="' + escapeHtml(firstPhoto) + '" alt="' + escapeHtml(property.title) + '" loading="lazy">'
    : placeholderImgHtml(property.title);
  const priceLine = property.price
    ? '<span class="ring-card-price">' + formatPriceUSD(property.price) + (property.exchange_rate ? ' · ' + escapeHtml(property.exchange_rate) : '') + '</span>'
    : '';
  const featuredIcon = property.featured
    ? '<img class="ring-card-featured-icon" src="assets/img/bastet-icon-gold.png" alt="Destacada">'
    : '';
  card.innerHTML +=
    '<div class="ring-card-overlay"></div>' +
    '<div class="ring-card-label">' +
      '<span class="ring-card-title-row">' + featuredIcon + '<span class="ring-card-title-text">' + escapeHtml(property.title) + '</span></span>' +
      priceLine +
    '</div>' +
    buildAgentBadgeHtml(property.agent);
  return card;
}

// Solo avatar + nombre (sin redes: las redes se ven en el modal al abrir la propiedad).
function buildAgentBadgeHtml(agent) {
  if (!agent || (!agent.display_name && !agent.avatar_url)) return '';
  const initial = (agent.display_name || '?').trim().charAt(0).toUpperCase();
  const avatar = agent.avatar_url
    ? '<img class="ring-card-agent-avatar" src="' + escapeHtml(agent.avatar_url) + '" alt="">'
    : '<span class="ring-card-agent-avatar ring-card-agent-avatar-placeholder">' + escapeHtml(initial) + '</span>';
  return (
    '<div class="ring-card-agent">' +
      avatar +
      '<span class="ring-card-agent-name">' + escapeHtml(agent.display_name || '') + '</span>' +
    '</div>'
  );
}

// Ícono de red social como badge circular con el logo real (assets/img/social-*.svg).
function socialIconLink(url, kind, label) {
  if (!url) return '';
  return '<a class="property-modal-social-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" aria-label="' + label + '">' +
    '<img src="assets/img/social-' + kind + '.svg" alt="' + label + '">' +
  '</a>';
}

const propertyRing = createRingCarousel({
  stage: ringStage,
  radius: RING_RADIUS,
  size: RING_SIZE,
  buildCard: buildPropertyCard,
  onSelect: (property) => openProperty(property),
  emptyText: 'Pronto publicaremos nuevas propiedades disponibles.',
});

// Columnas públicas explícitas (sin owner_whatsapp: es el teléfono privado del
// propietario del inmueble, nunca debe llegar al landing público).
const PUBLIC_PROPERTY_COLUMNS = 'id,title,location,address,price,exchange_rate,area,rooms,baths,description,photos,whatsapp,owner_id,featured,sort_order,status,created_at';
// Columnas públicas del agente (nunca email/role/is_active: ver política RLS "public can read active agent public info").
const PUBLIC_AGENT_COLUMNS = 'id,display_name,avatar_url,facebook_url,instagram_url,tiktok_url';

async function loadProperties() {
  const { data, error } = await supabaseClient
    .from('properties')
    .select(PUBLIC_PROPERTY_COLUMNS)
    .eq('status', 'available')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error cargando propiedades:', error);
    allProperties = [];
  } else {
    allProperties = data || [];
    await attachAgentInfo(allProperties);
  }

  buildCityFilters();
  renderPropertyRing();
}

async function attachAgentInfo(properties) {
  const ownerIds = [...new Set(properties.map((p) => p.owner_id).filter(Boolean))];
  if (!ownerIds.length) return;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select(PUBLIC_AGENT_COLUMNS)
    .in('id', ownerIds);
  if (error || !data) return;
  const agentById = {};
  data.forEach((a) => { agentById[a.id] = a; });
  properties.forEach((p) => { p.agent = p.owner_id ? agentById[p.owner_id] || null : null; });
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
      renderPropertyRing();
    });
    cityFiltersEl.appendChild(btn);
  });
}

function filteredProperties() {
  if (cityFilter === 'Todas') return allProperties;
  const filtered = allProperties.filter((p) => (p.location || '').startsWith(cityFilter));
  return filtered.length ? filtered : allProperties;
}

const FEATURED_WEIGHT = 3; // una propiedad destacada aparece ~3x más seguido en el carrusel

function buildRingPool(list) {
  const pool = [];
  list.forEach((p) => {
    const copies = p.featured ? FEATURED_WEIGHT : 1;
    for (let i = 0; i < copies; i++) pool.push(p);
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function renderPropertyRing() {
  propertyRing.render(buildRingPool(filteredProperties()));
}

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

function buildAgentSectionHtml(agent) {
  if (!agent || (!agent.display_name && !agent.avatar_url)) return '';
  const initial = (agent.display_name || '?').trim().charAt(0).toUpperCase();
  const avatar = agent.avatar_url
    ? '<img class="property-modal-agent-avatar" src="' + escapeHtml(agent.avatar_url) + '" alt="">'
    : '<span class="property-modal-agent-avatar property-modal-agent-avatar-placeholder">' + escapeHtml(initial) + '</span>';
  const socials =
    socialIconLink(agent.facebook_url, 'facebook', 'Facebook') +
    socialIconLink(agent.instagram_url, 'instagram', 'Instagram') +
    socialIconLink(agent.tiktok_url, 'tiktok', 'TikTok');
  return (
    '<div class="property-modal-agent">' +
      avatar +
      '<div class="property-modal-agent-info">' +
        '<p class="property-modal-agent-label">Publicado por</p>' +
        '<p class="property-modal-agent-name">' + escapeHtml(agent.display_name || '') + '</p>' +
      '</div>' +
      (socials ? '<span class="property-modal-agent-social">' + socials + '</span>' : '') +
    '</div>'
  );
}

function renderModal() {
  if (!selectedProperty) return;
  const p = selectedProperty;
  const photos = (p.photos && p.photos.length) ? p.photos : [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[selectedPhotoIndex] : null;

  const message = 'Hola Bastet, me interesa la propiedad: ' + p.title + ' (' + p.location + '). ¿Podrían brindarme más información?';

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
        '<p class="property-modal-price">' + formatPriceUSD(p.price) + '</p>' +
        (p.exchange_rate ? '<p class="property-modal-rate">Tipo de cambio aceptado: ' + escapeHtml(p.exchange_rate) + '</p>' : '') +
      '</div>' +
      '<div class="property-modal-specs">' +
        '<div><p class="property-modal-spec-label">Área</p><p class="property-modal-spec-value">' + escapeHtml(p.area) + '</p></div>' +
        '<div><p class="property-modal-spec-label">Ambientes</p><p class="property-modal-spec-value">' + escapeHtml(p.rooms) + '</p></div>' +
        '<div><p class="property-modal-spec-label">Baños</p><p class="property-modal-spec-value">' + escapeHtml(p.baths) + '</p></div>' +
      '</div>' +
      '<p class="property-modal-desc">' + escapeHtml(p.description) + '</p>' +
      buildAgentSectionHtml(p.agent) +
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

/* ── Testimonios: fetch + carrusel (mismo efecto de anillo que Propiedades) ── */
const TESTI_RING_SIZE = 10;
const TESTI_RING_RADIUS = 640;
const testiRingStage = document.getElementById('testi-ring-stage');

function buildTestimonialCard(t) {
  const card = document.createElement('div');
  card.className = 'testi-ring-card';
  card.setAttribute('data-ring-card', '');
  const initial = (t.name || '?').trim().charAt(0).toUpperCase();
  const photo = t.photo_url
    ? '<img class="testi-ring-photo" src="' + escapeHtml(t.photo_url) + '" alt="' + escapeHtml(t.name) + '" loading="lazy">'
    : '<div class="testi-ring-photo testi-ring-photo-placeholder">' + escapeHtml(initial) + '</div>';
  card.innerHTML =
    '<div class="testi-ring-header">' +
      photo +
      '<div class="testi-ring-who"><p class="testi-ring-name">' + escapeHtml(t.name) + '</p><p class="testi-ring-role">' + escapeHtml(t.role_label) + '</p></div>' +
    '</div>' +
    '<p class="testi-ring-quote">&ldquo;' + escapeHtml(t.quote) + '&rdquo;</p>';
  return card;
}

const testimonialRing = testiRingStage ? createRingCarousel({
  stage: testiRingStage,
  radius: TESTI_RING_RADIUS,
  size: TESTI_RING_SIZE,
  buildCard: buildTestimonialCard,
  emptyText: 'Pronto compartiremos las experiencias de nuestros clientes.',
  brightCenter: true,
}) : null;

async function loadTestimonials() {
  if (!testimonialRing) return;
  const { data, error } = await supabaseClient
    .from('testimonials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error cargando testimonios:', error);
    testimonialRing.render([]);
    return;
  }
  testimonialRing.render(data || []);
}

loadTestimonials();

/* ── Franja de logos de empresas aliadas ── */
async function loadPartners() {
  const track = document.getElementById('partners-track');
  const { data, error } = await supabaseClient
    .from('partners')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data || !data.length) {
    document.querySelector('.partners-strip')?.remove();
    return;
  }

  const logosHtml = data.map((p) => {
    const img = '<img src="' + escapeHtml(p.logo_url) + '" alt="' + escapeHtml(p.name || 'Empresa aliada') + '" loading="lazy">';
    return p.url
      ? '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" aria-label="' + escapeHtml(p.name || 'Empresa aliada') + '">' + img + '</a>'
      : img;
  }).join('');
  // El track se duplica una vez para que la animación de scroll sea continua (sin salto visible).
  track.innerHTML = logosHtml + logosHtml;
}

loadPartners();

/* ── Video del hero: reproduce y luego retrocede en cámara lenta (ping-pong), en vez de cortar y reiniciar ── */
(function setupHeroVideo() {
  const video = document.getElementById('hero-video');
  if (!video) return;
  if (reducedMotion) { video.pause(); return; }

  let reversing = false;
  let rafId = null;

  function stepReverse() {
    if (!reversing) return;
    video.currentTime = Math.max(0, video.currentTime - 0.033);
    if (video.currentTime <= 0.03) {
      reversing = false;
      video.currentTime = 0;
      video.play().catch(() => {});
      return;
    }
    rafId = requestAnimationFrame(stepReverse);
  }

  video.addEventListener('timeupdate', () => {
    if (!reversing && video.duration && video.currentTime >= video.duration - 0.08) {
      reversing = true;
      video.pause();
      rafId = requestAnimationFrame(stepReverse);
    }
  });

  video.play().catch(() => {});
})();
