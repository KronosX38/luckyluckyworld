/* ═══════════════════════════════════
   PANEL ADMIN — JS
═══════════════════════════════════ */

// ── TOKEN ──
const getToken = () => localStorage.getItem('admin_token');

// ── API HELPER ──
const api = async (url, options = {}) => {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  return res.json();
};

// ── ALERTAS ──
const showAlert = (msg, type = 'success', container = '.content-body') => {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = msg;
  const cont = document.querySelector(container);
  if (cont) {
    cont.insertAdjacentElement('afterbegin', alert);
    setTimeout(() => alert.remove(), 4000);
  }
};

// ── MODALES ──
const openModal = (id) => {
  document.getElementById(id)?.classList.add('open');
};
const closeModal = (id) => {
  document.getElementById(id)?.classList.remove('open');
};
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay')?.classList.remove('open');
  });
});

// ── CONFIRMAR ACCIÓN ──
const confirmar = (msg) => window.confirm(msg);

// ── FORMATEAR MONEDA ──
const formatMoney = (amount, currency = 'MXN') => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency
  }).format(amount);
};

// ── SIDEBAR MÓVIL ──
const sidebar        = document.querySelector('.sidebar');
const hamburgerBtn   = document.getElementById('hamburgerBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (hamburgerBtn) {
  hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  });
}

// Cerrar sidebar al navegar en móvil
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  });
});