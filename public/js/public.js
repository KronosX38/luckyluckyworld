/* ═══════════════════════════════════
   LUCKY LUCKY WORLD — JS PÚBLICO
═══════════════════════════════════ */

// Estado del carrito por sorteo
const carritos = {};
let sorteoActivo      = null;
let precioBoletoActivo = 0;
let monedaActiva      = 'MXN';

// Stripe Elements
let stripeCard = null;

// Inicializar Stripe Elements cuando abre el modal
function initStripeElements() {
  if (stripeCard) return; // Ya inicializado
  const elements = stripe.elements();
  stripeCard = elements.create('card', {
    style: {
      base: {
        fontFamily: "'Poppins', sans-serif",
        fontSize: '15px',
        color: '#0D1B3E',
        '::placeholder': { color: '#aab0c0' }
      },
      invalid: { color: '#C00000' }
    },
    hidePostalCode: true
  });
  stripeCard.mount('#stripe-card-element');
  stripeCard.on('change', (e) => {
    const errEl = document.getElementById('stripe-card-errors');
    errEl.textContent = e.error ? e.error.message : '';
  });
}

// Toggle entre tarjeta y OXXO
function toggleMetodoPago() {
  const metodo = document.getElementById('pago-metodo').value;
  const cardSection = document.getElementById('stripe-card-section');
  const oxxoSection = document.getElementById('oxxo-section');
  if (metodo === 'tarjeta') {
    cardSection.style.display = 'block';
    oxxoSection.style.display = 'none';
  } else {
    cardSection.style.display = 'none';
    oxxoSection.style.display = 'block';
  }
}

// ── CARGAR BOLETOS AL INICIAR ──
document.querySelectorAll('.pub-boletos-section, .pub-boletos-wrap').forEach(async (section) => {
  const sorteoId = section.dataset.sorteo;
  carritos[sorteoId] = [];
  await cargarBoletos(sorteoId);
});

async function cargarBoletos(sorteoId) {
  try {
    const res  = await fetch(`/api/sorteos/${sorteoId}/boletos`);
    const data = await res.json();
    if (!data.ok) return;

    const { modo, stats, boletos } = data;

    // Barra de progreso
    const total    = parseInt(stats.total) || 1;
    const vendidos = parseInt(stats.vendidos) || 0;
    const pct      = Math.round((vendidos / total) * 100);

    const fill      = document.getElementById(`fill-${sorteoId}`);
    const pctEl     = document.getElementById(`pct-${sorteoId}`);
    const vendEl    = document.getElementById(`vendidos-${sorteoId}`);
    const dispEl    = document.getElementById(`disponibles-${sorteoId}`);

    if (fill)   fill.style.width    = `${pct}%`;
    if (pctEl)  pctEl.textContent   = `${pct}%`;
    if (vendEl) vendEl.textContent  = `${vendidos} vendidos`;
    if (dispEl) dispEl.textContent  = `${stats.disponibles} disponibles`;

    const cuadricula = document.getElementById(`cuadricula-${sorteoId}`);
    const buscador   = document.getElementById(`buscador-${sorteoId}`);

    if (modo === 'cuadricula') {
      cuadricula.innerHTML = '';
      boletos.forEach(b => {
        const el = document.createElement('div');
        el.className = `pub-boleto ${b.estado}`;
        el.textContent = b.numero;
        el.id = `boleto-${sorteoId}-${b.numero}`;
        if (b.estado === 'disponible') {
          el.addEventListener('click', () => toggleBoleto(sorteoId, b.numero, el));
        }
        cuadricula.appendChild(el);
      });
    } else {
      cuadricula.innerHTML = '<p style="color:#aaa; font-size:0.85rem; padding:1rem 0;">Escribe un número para buscarlo o usa el botón de número aleatorio.</p>';
      if (buscador) buscador.style.display = 'flex';
    }

  } catch (err) {
    console.error('Error cargando boletos:', err);
  }
}

// ── TOGGLE BOLETO ──
function toggleBoleto(sorteoId, numero, el) {
  const carrito   = carritos[sorteoId];
  const maxCarrito = 20;

  if (carrito.includes(numero)) {
    carritos[sorteoId] = carrito.filter(n => n !== numero);
    el.classList.remove('seleccionado');
    el.classList.add('disponible');
  } else {
    if (carrito.length >= maxCarrito) {
      alert(`Máximo ${maxCarrito} boletos por transacción`);
      return;
    }
    carritos[sorteoId].push(numero);
    el.classList.remove('disponible');
    el.classList.add('seleccionado');
  }
  actualizarCarrito(sorteoId);
}

// ── NÚMERO ALEATORIO ──
async function agregarAleatorio(sorteoId) {
  try {
    const res  = await fetch(`/api/sorteos/${sorteoId}/boletos/aleatorio`);
    const data = await res.json();
    if (!data.ok) { alert('No hay boletos disponibles'); return; }

    const numero = data.numero;
    if (carritos[sorteoId].includes(numero)) {
      alert('Ese número ya está en tu carrito, intenta de nuevo');
      return;
    }
    if (carritos[sorteoId].length >= 20) {
      alert('Máximo 20 boletos por transacción');
      return;
    }
    carritos[sorteoId].push(numero);
    const el = document.getElementById(`boleto-${sorteoId}-${numero}`);
    if (el) { el.classList.remove('disponible'); el.classList.add('seleccionado'); }
    actualizarCarrito(sorteoId);
  } catch (err) {
    console.error(err);
  }
}

// ── BUSCAR BOLETO ──
async function buscarBoleto(sorteoId) {
  const input  = document.getElementById(`buscar-input-${sorteoId}`);
  const numero = input.value.trim();
  if (!numero) return;

  try {
    const res  = await fetch(`/api/sorteos/${sorteoId}/boletos/buscar/${numero}`);
    const data = await res.json();

    if (!data.ok) { alert('Número no encontrado en este sorteo'); return; }

    const b = data.boleto;
    if (b.estado === 'vendido') {
      alert(`El boleto ${b.numero} ya fue vendido`);
    } else if (b.estado === 'reservado') {
      alert(`El boleto ${b.numero} está siendo comprado por otra persona`);
    } else {
      if (carritos[sorteoId].includes(b.numero)) {
        alert('Este boleto ya está en tu carrito'); return;
      }
      if (carritos[sorteoId].length >= 20) {
        alert('Máximo 20 boletos por transacción'); return;
      }
      carritos[sorteoId].push(b.numero);
      actualizarCarrito(sorteoId);
      input.value = '';
      alert(`✅ Boleto ${b.numero} agregado al carrito`);
    }
  } catch (err) {
    console.error(err);
  }
}

// ── ACTUALIZAR CARRITO ──
function actualizarCarrito(sorteoId) {
  const carrito    = carritos[sorteoId];
  const contenedor = document.getElementById(`carrito-boletos-${sorteoId}`);
  const totalEl    = document.getElementById(`carrito-total-${sorteoId}`);
  const btnPagar   = document.getElementById(`btn-pagar-${sorteoId}`);

  if (!contenedor) return;

  if (carrito.length === 0) {
    contenedor.innerHTML = '<p class="pub-carrito-empty">No has seleccionado ningún boleto</p>';
    if (btnPagar) btnPagar.disabled = true;
  } else {
    contenedor.innerHTML = carrito.map(n => `
      <div class="pub-tag-boleto">
        ${n}
        <button onclick="quitarDelCarrito('${sorteoId}', '${n}')">✕</button>
      </div>
    `).join('');
    if (btnPagar) btnPagar.disabled = false;
  }

  const btnEl = document.getElementById(`btn-pagar-${sorteoId}`);
  if (btnEl) {
    const precio = parseFloat(btnEl.getAttribute('onclick').split(',')[1].trim()) || 0;
    const total  = (carrito.length * precio).toFixed(2);
    if (totalEl) totalEl.textContent = `$${Number(total).toLocaleString('es-MX', {minimumFractionDigits:2})}`;
  }
}

// ── QUITAR DEL CARRITO ──
function quitarDelCarrito(sorteoId, numero) {
  carritos[sorteoId] = carritos[sorteoId].filter(n => n !== numero);
  const el = document.getElementById(`boleto-${sorteoId}-${numero}`);
  if (el) { el.classList.remove('seleccionado'); el.classList.add('disponible'); }
  actualizarCarrito(sorteoId);
}

// ── LIMPIAR CARRITO ──
function limpiarCarrito(sorteoId) {
  carritos[sorteoId].forEach(numero => {
    const el = document.getElementById(`boleto-${sorteoId}-${numero}`);
    if (el) { el.classList.remove('seleccionado'); el.classList.add('disponible'); }
  });
  carritos[sorteoId] = [];
  actualizarCarrito(sorteoId);
}

// ── PROCEDER AL PAGO ──
function procederPago(sorteoId, precio, moneda) {
  if (!carritos[sorteoId] || carritos[sorteoId].length === 0) {
    alert('Selecciona al menos un boleto');
    return;
  }
  sorteoActivo       = sorteoId;
  precioBoletoActivo = precio;
  monedaActiva       = moneda;

  const total = (carritos[sorteoId].length * precio).toFixed(2);
  document.getElementById('pago-resumen').innerHTML = `
    <div style="background:#f9fafb; border-radius:8px; padding:1rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <span style="color:#aaa; font-size:0.85rem;">Boletos seleccionados</span>
        <strong>${carritos[sorteoId].length}</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#aaa; font-size:0.85rem;">Total a pagar</span>
        <strong style="color:#0D1B3E; font-size:1.1rem;">
          $${Number(total).toLocaleString('es-MX', {minimumFractionDigits:2})} ${moneda}
        </strong>
      </div>
    </div>
  `;

  document.getElementById('modalPago').classList.add('open');

  // Inicializar Stripe Elements al abrir el modal
  setTimeout(() => initStripeElements(), 100);
}

function cerrarModalPago() {
  document.getElementById('modalPago').classList.remove('open');
}

// ── CONFIRMAR PAGO ──
async function confirmarPago() {
  const nombre   = document.getElementById('pago-nombre').value.trim();
  const email    = document.getElementById('pago-email').value.trim();
  const telefono = document.getElementById('pago-telefono').value.trim();
  const metodo   = document.getElementById('pago-metodo').value;

  if (!nombre || !email) {
    alert('Por favor completa tu nombre y correo electrónico');
    return;
  }

  const btn = document.querySelector('.pub-btn-confirmar');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
  btn.disabled = true;

  try {
    // 1. Crear reserva
    const resReserva = await fetch(`/api/sorteos/${sorteoActivo}/boletos/reservar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numeros: carritos[sorteoActivo],
        nombre, email, telefono
      })
    });
    const reserva = await resReserva.json();

    if (!reserva.ok) {
      alert('❌ ' + (reserva.error || 'Error creando reserva'));
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar y pagar';
      btn.disabled = false;
      return;
    }

    // 2. Crear Payment Intent
    const resPago = await fetch('/api/stripe/crear-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reserva_id:  reserva.reserva_id,
        nombre, email, telefono,
        metodo_pago: metodo
      })
    });
    const pago = await resPago.json();

    if (!pago.ok) {
      alert('❌ ' + (pago.error || 'Error procesando pago'));
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar y pagar';
      btn.disabled = false;
      return;
    }

    // 3. Confirmar pago con Stripe
    if (metodo === 'tarjeta') {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        pago.client_secret,
        {
          payment_method: {
            card: stripeCard,
            billing_details: { name: nombre, email }
          }
        }
      );

      if (error) {
        document.getElementById('stripe-card-errors').textContent = error.message;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar y pagar';
        btn.disabled = false;
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        pagoExitoso();
      }

    } else {
      // OXXO — mostrar voucher
      const { error, paymentIntent } = await stripe.confirmOxxoPayment(
        pago.client_secret,
        {
          payment_method: {
            billing_details: { name: nombre, email }
          }
        },
        { handleActions: false }
      );

      if (error) {
        alert('❌ Error: ' + error.message);
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar y pagar';
        btn.disabled = false;
        return;
      }

      // Mostrar instrucciones OXXO
      cerrarModalPago();
      alert('🏪 Revisa tu correo para ver el voucher de pago OXXO. Tienes 24 horas para pagar.');
      limpiarCarrito(sorteoActivo);
    }

  } catch (err) {
    console.error(err);
    alert('Error de conexión. Intenta de nuevo.');
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar y pagar';
    btn.disabled = false;
  }
}

function pagoExitoso() {
  cerrarModalPago();
  limpiarCarrito(sorteoActivo);
  cargarBoletos(sorteoActivo);

  // Mostrar mensaje de éxito
  const exito = document.createElement('div');
  exito.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:white; padding:2rem 3rem; border-radius:16px;
    box-shadow:0 20px 60px rgba(0,0,0,0.2); text-align:center; z-index:999;
  `;
  exito.innerHTML = `
    <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
    <h3 style="color:#0D1B3E; margin-bottom:0.5rem;">¡Pago exitoso!</h3>
    <p style="color:#aaa; font-size:0.88rem;">
      Revisa tu correo electrónico.<br>
      Ahí encontrarás tu(s) PIN(s) de verificación.
    </p>
    <button onclick="this.parentElement.remove()" style="
      margin-top:1.5rem; background:#3ecf8e; color:white;
      border:none; padding:0.7rem 2rem; border-radius:8px;
      font-family:'Poppins',sans-serif; font-size:0.9rem; cursor:pointer;
    ">Cerrar</button>
  `;
  document.body.appendChild(exito);
}

// ── PROTECCIÓN BÁSICA ──
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && e.key === 'I') ||
    (e.ctrlKey && e.shiftKey && e.key === 'J') ||
    (e.ctrlKey && e.key === 'U')
  ) {
    e.preventDefault();
  }
});

// ── ACTUALIZACIÓN AUTOMÁTICA cada 30 segundos ──
setInterval(async () => {
  document.querySelectorAll('.pub-boletos-section, .pub-boletos-wrap').forEach(async (section) => {
    const sorteoId = section.dataset.sorteo;
    if (!sorteoId) return;

    // Solo actualizar si no hay boletos seleccionados en el carrito
    if (carritos[sorteoId] && carritos[sorteoId].length === 0) {
      await cargarBoletos(sorteoId);
    }
  });
}, 30000); // cada 30 segundos