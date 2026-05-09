const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const EmailService = {

  enviarConfirmacion: async ({ nombre, email, boletos, pin, sorteo_id, monto }) => {
    const boletosHtml = boletos.map(b => `
    <tr>
      <td style="padding:8px 12px; border-bottom:1px solid #eee; text-align:center;">
        <strong>${b}</strong>
      </td>
    </tr>
  `).join('');

    const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family:Arial,sans-serif; background:#f5f5f5; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden;">

      <div style="background:#1B4332; padding:30px; text-align:center;">
        <h1 style="color:#C9A84C; margin:0;">¡Compra Confirmada!</h1>
        <p style="color:#fff; margin:8px 0 0;">Tus boletos están registrados</p>
      </div>

      <div style="padding:30px;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Tu compra ha sido procesada exitosamente. Guarda bien tu PIN — lo necesitarás para reclamar tu premio si resultas ganador.</p>

        <!-- PIN DESTACADO -->
        <div style="text-align:center; margin:25px 0;">
          <p style="font-size:0.85rem; color:#666; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.1em;">Tu PIN de verificación</p>
          <div style="background:#1B4332; border-radius:12px; padding:20px; display:inline-block; min-width:200px;">
            <span style="font-size:1.4rem; font-weight:700; letter-spacing:0.2em; color:#C9A84C; word-break:break-all;">
              ${pin}
            </span>
          </div>
          <p style="font-size:0.78rem; color:#aaa; margin-top:8px;">
            Este PIN aplica para todos tus boletos de esta compra
          </p>
        </div>

        <!-- BOLETOS -->
        <p style="font-weight:600; color:#1B4332; margin-bottom:8px;">Tus boletos:</p>
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
          <thead>
            <tr style="background:#1B4332;">
              <th style="padding:10px 12px; color:#fff; text-align:center;">Número de Boleto</th>
            </tr>
          </thead>
          <tbody>${boletosHtml}</tbody>
        </table>

        <div style="background:#FFF8E1; border-left:4px solid #C9A84C; padding:15px; margin:20px 0;">
          <strong>⚠️ Importante:</strong> Guarda este correo y tu PIN. 
          Es tu único comprobante válido para reclamar el premio.
        </div>

        <p><strong>Monto pagado:</strong> $${monto} MXN</p>
        <p><strong>Para reclamar tu premio necesitas:</strong></p>
        <ul>
          <li>Tu PIN: <strong>${pin}</strong></li>
          <li>Identificación oficial vigente</li>
          <li>Este correo de confirmación</li>
        </ul>
      </div>

      <div style="background:#1B4332; padding:20px; text-align:center;">
        <p style="color:rgba(255,255,255,0.5); margin:0; font-size:12px;">
          Lucky Lucky World — Sorteos en línea seguros y transparentes
        </p>
      </div>

    </div>
  </body>
  </html>`;

    await transporter.sendMail({
      from: `"Lucky Lucky World" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `✅ Confirmación — ${boletos.length} boleto(s) | PIN: ${pin}`,
      html
    });
  },

  enviarNotificacionGanador: async ({ nombre, email, boleto, pin, premio }) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif; background:#f5f5f5; padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden;">

        <div style="background:#0D1B3E; padding:30px; text-align:center;">
          <h1 style="color:#C9A84C; margin:0;">🎉 ¡Felicidades, Ganaste!</h1>
        </div>

        <div style="padding:30px;">
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>¡Tu boleto <strong style="color:#C9A84C;">${boleto}</strong> resultó ganador!</p>

          <div style="background:#E8F5E9; border-left:4px solid #1B5E20; padding:15px; margin:20px 0;">
            <strong>Premio:</strong> ${premio}<br>
            <strong>Tu PIN de verificación:</strong>
            <span style="font-size:24px; color:#C9A84C; font-weight:bold;"> ${pin}</span>
          </div>

          <p><strong>Para reclamar tu premio presenta:</strong></p>
          <ul>
            <li>Tu PIN: <strong>${pin}</strong></li>
            <li>Identificación oficial vigente</li>
            <li>Este correo</li>
          </ul>
        </div>

        <div style="background:#0D1B3E; padding:20px; text-align:center;">
          <p style="color:rgba(255,255,255,0.5); margin:0; font-size:12px;">
            Sorteos IMAR — Permiso SEGOB vigente
          </p>
        </div>

      </div>
    </body>
    </html>`;

    await transporter.sendMail({
      from: `"Sorteos IMAR" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `🎉 ¡Ganaste! Tu boleto ${boleto} es el ganador`,
      html
    });
  },

  enviarCodigoRecuperacion: async ({ email, nombre, codigo }) => {
    const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family:Arial,sans-serif; background:#f5f5f5; padding:20px;">
    <div style="max-width:500px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden;">

      <div style="background:#0D1B3E; padding:30px; text-align:center;">
        <h1 style="color:#C9A84C; margin:0;">🔐 Recuperar acceso</h1>
        <p style="color:#fff; margin:8px 0 0;">Lucky Lucky World</p>
      </div>

      <div style="padding:30px;">
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>

        <div style="text-align:center; margin:30px 0;">
          <div style="background:#f0f4f8; border-radius:12px; padding:20px; display:inline-block;">
            <span style="font-size:2.5rem; font-weight:700; letter-spacing:0.5rem; color:#0D1B3E;">
              ${codigo}
            </span>
          </div>
          <p style="color:#aaa; font-size:0.82rem; margin-top:10px;">
            ⏱️ Este código expira en <strong>15 minutos</strong>
          </p>
        </div>

        <div style="background:#FDECEA; border-left:4px solid #C00000; padding:15px; margin:20px 0;">
          <strong>⚠️ Importante:</strong> Si no solicitaste este código,
          ignora este correo. Tu contraseña no será modificada.
        </div>
      </div>

      <div style="background:#0D1B3E; padding:20px; text-align:center;">
        <p style="color:rgba(255,255,255,0.5); margin:0; font-size:12px;">
          Este es un correo automático, no respondas a este mensaje.
        </p>
      </div>

    </div>
  </body>
  </html>`;

    await transporter.sendMail({
      from: `"Lucky Lucky World" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `🔐 Tu código de recuperación: ${codigo}`,
      html
    });
  }
};

module.exports = EmailService;