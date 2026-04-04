/* ═══════════════════════════════════
   LUCKY LUCKY WORLD — JS PÚBLICO
═══════════════════════════════════ */

// Estado del carrito por sorteo
const carritos = {};
let sorteoActivo = null;
let precioBoletoActivo = 0;
let monedaActiva = 'MXN';

// ── CARGAR BOLETOS AL INICIAR ──
document.querySelectorAll('.pub-boletos-section').forEach(async (section) => {
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

    // Actualizar barra de progreso
    const total = parseInt(stats.total) || 1;
    const vendidos = parseInt(stats.vendidos) || 0;
    const pct = Math.round((vendidos / total) * 100);

    const fill = document.getElementById(`fill-${sorteoId}`);
    const pctEl = document.getElementById(`pct-${sorteoId}`);
    const vendidosEl = document.getElementById(`vendidos-${sorteoId}`);
    const dispEl = document.getElementById(`disponibles-${sorteoId}`);

    if (fill) fill.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (vendidosEl) vendidosEl.textContent = `${vendidos} vendidos`;
    if (dispEl) dispEl.textContent = `${stats.disponibles} disponibles`;

    const cuadricula = document.getElementById(`cuadricula-${sorteoId}`);
    const buscador   = document.getElementById(`buscador-${sorteoId}`);

    if (modo === 'cuadricula') {
      // Mostrar cuadrícula
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
      // Mostrar buscador
      cuadricula.innerHTML = '<p style="color:#aaa; font-size:0.85rem; padding:1rem 0;">Escribe un número para buscarlo o usa el botón de número aleatorio.</p>';
      if (buscador) buscador.style.display = 'flex';
    }

  } catch (err) {
    console.error('Error cargando boletos:', err);
  }
}

// ── TOGGLE BOLETO EN CUADRÍCULA ──
function toggleBoleto(sorteoId, numero, el) {
  const carrito = carritos[sorteoId];
  const maxCarrito = 20;

  if (carrito.includes(numero)) {
    // Quitar del carrito
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

    // Marcar en cuadrícula si existe
    const el = document.getElementById(`boleto-${sorteoId}-${numero}`);
    if (el) {
      el.classList.remove('disponible');
      el.classList.add('seleccionado');
    }

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
        alert('Este boleto ya está en tu carrito');
        return;
      }
      if (carritos[sorteoId].length >= 20) {
        alert('Máximo 20 boletos por transacción');
        return;
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

  // Actualizar total — precio viene del botón data
  const btnPagarEl = document.getElementById(`btn-pagar-${sorteoId}`);
  if (btnPagarEl) {
    const precio = parseFloat(btnPagarEl.getAttribute('onclick').split(',')[1].trim()) || 0;
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
  sorteoActivo      = sorteoId;
  precioBoletoActivo = precio;
  monedaActiva      = moneda;

  // Mostrar resumen en el modal
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
  btn.textContent = 'Procesando...';
  btn.disabled = true;

  try {
    // 1. Crear reserva
    const resReserva = await fetch(`/api/sorteos/${sorteoActivo}/boletos/reservar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numeros:  carritos[sorteoActivo],
        nombre, email, telefono
      })
    });
    const reserva = await resReserva.json();

    if (!reserva.ok) {
      alert('❌ ' + (reserva.error || 'Error creando reserva'));
      btn.textContent = '🔒 Confirmar y pagar';
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
      btn.textContent = '🔒 Confirmar y pagar';
      btn.disabled = false;
      return;
    }

    // 3. Confirmar con Stripe
    const { error } = await stripe.confirmCardPayment(pago.client_secret, {
      payment_method: {
        card: { token: 'tok_visa' }, // En producción usar Stripe Elements
        billing_details: { name: nombre, email }
      }
    });

    if (error) {
      alert('❌ Error en el pago: ' + error.message);
      btn.textContent = '🔒 Confirmar y pagar';
      btn.disabled = false;
    } else {
      cerrarModalPago();
      limpiarCarrito(sorteoActivo);
      await cargarBoletos(sorteoActivo);
      alert('🎉 ¡Pago exitoso! Revisa tu correo para ver tu(s) PIN(s)');
    }

  } catch (err) {
    console.error(err);
    alert('Error de conexión. Intenta de nuevo.');
    btn.textContent = '🔒 Confirmar y pagar';
    btn.disabled = false;
  }
}