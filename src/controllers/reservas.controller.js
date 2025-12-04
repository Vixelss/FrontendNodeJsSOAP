// src/controllers/reservas.controller.js
const apiClient = require('../services/apiClientSoap');
const bancoClient = require('../services/bancoClient');

// ===============================
// Helper: arma modelo de montos
// ===============================
function armarModeloReserva(reserva, usuarioSesion) {
  const u = usuarioSesion || {};

  const subtotal = Number(reserva.Total || reserva.total || 0);
  const iva = +(subtotal * 0.12).toFixed(2);
  const totalConIva = +(subtotal + iva).toFixed(2);

  const fIniRaw = reserva.FechaInicio || reserva.fechaInicio;
  const fFinRaw = reserva.FechaFin || reserva.fechaFin;

  let dias = 1;
  if (fIniRaw && fFinRaw) {
    const fIni = new Date(fIniRaw);
    const fFin = new Date(fFinRaw);
    const diffMs = fFin - fIni;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    dias = diffDias > 0 ? Math.round(diffDias) : 1;
  }

  const precioDia =
    dias > 0 ? +(subtotal / dias).toFixed(2) : subtotal;

  const clienteNombre =
    (reserva.NombreUsuario || reserva.nombreUsuario || '').trim() ||
    `${(u.Nombre || u.nombre || '').trim()} ${(u.Apellido || u.apellido || '').trim()}`.trim();

  const clienteCorreo =
    reserva.CorreoUsuario ||
    reserva.UsuarioCorreo ||
    reserva.correoUsuario ||
    u.Email ||
    u.email ||
    u.Correo ||
    u.correo ||
    '';

  return {
    subtotal,
    iva,
    totalConIva,
    precioDia,
    clienteNombre,
    clienteCorreo
  };
}

// ===============================
// GET /reservas
// ===============================
async function listarMisReservas(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const usuario = req.session.usuario;
  const idUsuario =
    usuario.id ||
    usuario.IdUsuario ||
    usuario.idUsuario ||
    usuario.Id;

  try {
    const data = await apiClient.getReservasPorUsuario(idUsuario);

    const reservasRaw = Array.isArray(data?.data)
      ? data.data
      : (Array.isArray(data) ? data : []);

    // infoPagos guarda por sesión la info de pago de cada reserva
    const infoPagos = req.session.infoPagos || {};

    const reservas = reservasRaw.map(r => {
      const id = r.IdReserva || r.idReserva || r.id;
      const pago = infoPagos[String(id)];
      if (pago) {
        return {
          ...r,
          Estado: 'Confirmada',
          estado: 'Confirmada'
        };
      }
      return r;
    });

    // "flash" de mensaje después de pagar
    const mensaje = req.session.mensajeReservas || null;
    req.session.mensajeReservas = null;

    return res.render('reservas/index', {
      titulo: 'Mis reservas',
      reservas,
      usuario,
      error: null,
      mensaje
    });
  } catch (err) {
    console.error(
      'Error al obtener reservas del usuario:',
      err.response?.data || err.message
    );

    return res.render('reservas/index', {
      titulo: 'Mis reservas',
      reservas: [],
      usuario,
      error: 'No se pudieron cargar tus reservas.',
      mensaje: null
    });
  }
}

// ===============================
// GET /reservas/:id
// ===============================
async function verDetalleReserva(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const idReserva = parseInt(req.params.id, 10);
  if (!idReserva || Number.isNaN(idReserva)) {
    return res.redirect('/reservas');
  }

  try {
    const data = await apiClient.getReservaPorId(idReserva);
    const reserva = data?.data || data;

    if (!reserva) {
      return res.redirect('/reservas');
    }

    const modelo = armarModeloReserva(reserva, req.session.usuario);

    const infoPagos = req.session.infoPagos || {};
    const infoPago = infoPagos[String(idReserva)] || null;

    const estadoReserva = infoPago
      ? 'Confirmada'
      : (reserva.Estado || reserva.estado || 'Pendiente');

    if (infoPago) {
      reserva.Estado = 'Confirmada';
      reserva.estado = 'Confirmada';
    }

    return res.render('reservas/detalle', {
      titulo: 'Resumen de tu reserva',
      reserva,
      subtotal: modelo.subtotal,
      iva: modelo.iva,
      totalConIva: modelo.totalConIva,
      precioDia: modelo.precioDia,
      clienteNombre: modelo.clienteNombre,
      clienteCorreo: modelo.clienteCorreo,
      usuario: req.session.usuario,
      estadoReserva,
      infoPago,
      mensajePago: null,
      errorPago: null
    });
  } catch (err) {
    console.error(
      'Error al obtener detalle de reserva:',
      err.response?.data || err.message
    );
    return res.redirect('/reservas');
  }
}

// =======================================
// POST /reservas/:id/pagar
// =======================================
async function pagarReserva(req, res) {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/reservas');
  }

  const idReserva = parseInt(req.params.id, 10);
  const cedula = (req.body.cedula || '').trim(); // cedula de MiBanca

  if (!idReserva || Number.isNaN(idReserva)) {
    return res.redirect('/reservas');
  }

  try {
    // 1) Traer reserva y armar modelo (para totales)
    const data = await apiClient.getReservaPorId(idReserva);
    const reserva = data?.data || data;

    if (!reserva) {
      return res.redirect('/reservas');
    }

    const modelo = armarModeloReserva(reserva, req.session.usuario);

    // Si no enviaron cedula, solo re-pinto el detalle con error
    if (!cedula) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : (reserva.Estado || reserva.estado || 'Pendiente');

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'Ingresa tu número de cédula para realizar el pago.'
      });
    }

    // 2) Buscar cuentas del cliente (cedula termina en 01 en tu ejemplo)
    const cuentasCliente = await bancoClient.obtenerCuentasPorCliente(cedula);
    const listaCliente = Array.isArray(cuentasCliente) ? cuentasCliente : [];

    if (!listaCliente.length) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : (reserva.Estado || reserva.estado || 'Pendiente');

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago:
          'No se encontró ninguna cuenta. Contáctese con el soporte de su banco.'
      });
    }

    // Tomamos la primera cuenta del cliente
    const cuentaCli = listaCliente[0];
    const cuentaOrigen = Number(cuentaCli.cuenta_id); // ¡ojo! cuenta_id, no cedula

    // 3) Buscar la cuenta de la empresa (cedula termina en 02)
    const cuentasEmpresa =
      await bancoClient.obtenerCuentasPorCliente(bancoClient.EMPRESA_CEDULA);
    const listaEmp = Array.isArray(cuentasEmpresa) ? cuentasEmpresa : [];

    if (!listaEmp.length) {
      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : (reserva.Estado || reserva.estado || 'Pendiente');

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'No se encontró la cuenta de la empresa en MiBanca.'
      });
    }

    const cuentaEmp = listaEmp[0];
    const cuentaDestino = Number(cuentaEmp.cuenta_id);

    // 4) Crear transacción en MiBanca
    const transaccion = await bancoClient.crearTransaccion({
      cuentaOrigen,
      cuentaDestino,
      monto: modelo.totalConIva,
      tipoTransaccion: `Pago reserva UrbanDrive #${idReserva}`
    });

    // 5) Guardamos info del pago en la sesión
    if (!req.session.infoPagos) {
      req.session.infoPagos = {};
    }

    req.session.infoPagos[String(idReserva)] = {
      transaccionId: transaccion?.transaccion_id || transaccion?.id || null,
      cuentaOrigen,
      cuentaDestino,
      monto: modelo.totalConIva,
      fecha: transaccion?.fecha_transaccion || new Date().toISOString(),
      cedula
    };

    // Mensaje para la pantalla de "Mis reservas"
    req.session.mensajeReservas = 'Pago realizado correctamente en MiBanca.';

    // 6) Redirigimos a la lista de reservas
    return res.redirect('/reservas');
  } catch (err) {
    console.error(
      'Error al procesar pago en MiBanca:',
      err.response?.data || err.message
    );

    // Intentamos volver a mostrar el detalle con mensaje de error
    try {
      const data = await apiClient.getReservaPorId(idReserva);
      const reserva = data?.data || data;
      const modelo = armarModeloReserva(reserva, req.session.usuario);

      const infoPagos = req.session.infoPagos || {};
      const infoPago = infoPagos[String(idReserva)] || null;
      const estadoReserva = infoPago
        ? 'Confirmada'
        : (reserva.Estado || reserva.estado || 'Pendiente');

      return res.render('reservas/detalle', {
        titulo: 'Resumen de tu reserva',
        reserva,
        precioDia: modelo.precioDia,
        subtotal: modelo.subtotal,
        iva: modelo.iva,
        totalConIva: modelo.totalConIva,
        clienteNombre: modelo.clienteNombre,
        clienteCorreo: modelo.clienteCorreo,
        usuario: req.session.usuario,
        estadoReserva,
        infoPago,
        mensajePago: null,
        errorPago: 'No se pudo completar el pago. Intenta nuevamente.'
      });
    } catch {
      return res.redirect('/reservas');
    }
  }
}

module.exports = {
  listarMisReservas,
  verDetalleReserva,
  pagarReserva
};
