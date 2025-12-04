// src/controllers/carrito.controller.js

const apiClient = require('../services/apiClientSoap');

// =======================
// Helpers para la sesión
// =======================
function getIdUsuarioFromSession(req) {
  const u = req.session.usuario || {};
  return (
    u.id ||
    u.IdUsuario ||
    u.idUsuario ||
    u.Id ||
    null
  );
}

function getIdCarritoFromSession(req) {
  const u = req.session.usuario || {};
  return (
    req.session.carritoId ||
    u.IdCarrito ||
    u.idCarrito ||
    null
  );
}

// =======================
// Ver carrito
// =======================
const verCarrito = async (req, res) => {
  if (!req.session.usuario) {
    return res.render('auth/login', {
      titulo: 'Iniciar sesion',
      error: null,
      mensajeInfo: 'Inicia sesion para ver tu carrito.',
      returnUrl: '/carrito'
    });
  }

  const usuario = req.session.usuario;
  const idUsuario = getIdUsuarioFromSession(req);

  try {
    // Pedimos el carrito directamente por usuario al WS SOAP
    const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);

    let items = [];
    let subtotal = 0;

    if (dataCarrito) {
      // Guardar IdCarrito en sesion para otras operaciones (reservas, etc.)
      req.session.carritoId =
        dataCarrito.IdCarrito || dataCarrito.idCarrito || null;

      const nodeItems = dataCarrito.Items || [];
      items = Array.isArray(nodeItems) ? nodeItems : [nodeItems];

      subtotal = items.reduce((acc, it) => {
        const sub = it.Subtotal ?? it.subtotal ?? it.totalItem ?? 0;
        return acc + Number(sub);
      }, 0);
    }

    const iva = +(subtotal * 0.12).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);

    return res.render('carrito/index', {
      titulo: 'Tu carrito',
      items,
      subtotal,
      iva,
      total,
      error: null,
      usuario
    });
  } catch (err) {
    console.error('Error al ver carrito:', err);
    return res.status(500).render('carrito/index', {
      titulo: 'Tu carrito',
      items: [],
      subtotal: 0,
      iva: 0,
      total: 0,
      error: 'No se pudo cargar el carrito.',
      usuario
    });
  }
};

// =======================
// Agregar item al carrito
// =======================
const agregarItem = async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Inicia sesion para agregar vehiculos al carrito.',
      redirectTo: '/login?from=carrito&returnUrl=/vehiculos'
    });
  }

  let { idVehiculo, fechaInicio, fechaFin } = req.body;

  if (!idVehiculo || !fechaInicio || !fechaFin) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Faltan datos obligatorios (vehiculo y fechas).'
    });
  }

  const idVehiculoNum = parseInt(idVehiculo, 10);
  fechaInicio = String(fechaInicio).substring(0, 10); // YYYY-MM-DD
  fechaFin = String(fechaFin).substring(0, 10);       // YYYY-MM-DD

  const idUsuario = getIdUsuarioFromSession(req);

  try {
    // 1) Llamar al WS SOAP para agregar el item
    const resultado = await apiClient.agregarItemCarrito({
      IdUsuario: idUsuario,
      IdVehiculo: idVehiculoNum,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin
    });

    // 2) Volver a leer el carrito por usuario para actualizar idCarrito e items
    const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);

    let carritoId = null;
    if (dataCarrito) {
      carritoId = dataCarrito.IdCarrito || dataCarrito.idCarrito || null;
      if (carritoId) {
        req.session.carritoId = carritoId;
      }
    }

    return res.json({
      ok: true,
      mensaje: resultado?.mensaje || 'Vehiculo agregado al carrito correctamente.',
      carritoId: carritoId
    });
  } catch (err) {
    console.error('Error al agregar al carrito:', err);

    let mensaje =
      'No se pudo agregar el vehiculo al carrito. Intentalo nuevamente.';

    const texto = (err.message || err.toString() || '').toLowerCase();

    if (texto.includes('no esta disponible') || texto.includes('no está disponible')) {
      mensaje =
        'Ese vehiculo no esta disponible en las fechas seleccionadas. Prueba con otras fechas.';
    } else if (texto.includes('mantenimiento')) {
      mensaje =
        'Ese vehiculo esta en mantenimiento para esas fechas.';
    } else if (
      texto.includes('datos invalidos') ||
      texto.includes('datos inválidos') ||
      texto.includes('modelo invalido')
    ) {
      mensaje =
        'Los datos de la reserva no son validos. Revisa las fechas seleccionadas.';
    }

    return res.status(400).json({
      ok: false,
      mensaje
    });
  }
};

// =======================
// Eliminar item del carrito
// =======================
const eliminarItem = async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/carrito');
  }

  const rawId = req.params.id || req.params.itemId || req.params.idItem;
  const idItem = parseInt(rawId, 10);

  if (!idItem || Number.isNaN(idItem)) {
    console.warn('eliminarItem: id de item no valido:', rawId);
    return res.redirect('/carrito');
  }

  try {
    await apiClient.eliminarItemCarrito(idItem);
  } catch (err) {
    console.error(
      'Error al eliminar item del carrito:',
      err.message || err
    );
  }

  return res.redirect('/carrito');
};

// =======================
// Generar reserva(s) desde el carrito
// =======================
const generarReserva = async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect('/login?returnUrl=/carrito');
  }

  const usuario = req.session.usuario;
  const idUsuario = getIdUsuarioFromSession(req);

  const nombreUsuario = (
    (usuario.nombre || usuario.Nombre || usuario.nombres || usuario.Nombres || '') +
    ' ' +
    (usuario.apellido || usuario.Apellido || usuario.apellidos || usuario.Apellidos || '')
  ).trim();

  const correoUsuario =
    usuario.email ||
    usuario.Email ||
    usuario.correo ||
    usuario.Correo ||
    null;

  try {
    // Traemos el carrito completo POR USUARIO (ya incluye IdCarrito e Items)
    const dataCarrito = await apiClient.getCarritoPorUsuario(idUsuario);

    const items = dataCarrito?.Items || [];
    const listaItems = Array.isArray(items) ? items : [items];

    if (!listaItems.length) {
      return res.render('carrito/index', {
        titulo: 'Tu carrito',
        items: [],
        subtotal: 0,
        iva: 0,
        total: 0,
        error: 'Tu carrito esta vacio.',
        usuario
      });
    }

    const reservasCreadas = [];

    for (const it of listaItems) {
      const idVehiculo =
        it.IdVehiculo ||
        it.idVehiculo ||
        it.vehiculoId ||
        it.id_vehiculo;

      const fechaInicio = (
        it.FechaInicio ||
        it.fechaInicio ||
        it.fecha_inicio ||
        ''
      ).toString();

      const fechaFin = (
        it.FechaFin ||
        it.fechaFin ||
        it.fecha_fin ||
        ''
      ).toString();

      const subtotal = it.Subtotal ?? it.subtotal ?? 0;

      const reservaDto = {
        IdUsuario: idUsuario,
        NombreUsuario: nombreUsuario || null,
        CorreoUsuario: correoUsuario || null,
        UsuarioCorreo: correoUsuario || null,
        IdVehiculo: idVehiculo,
        VehiculoNombre: it.VehiculoNombre || it.vehiculoNombre || it.Modelo || null,
        FechaInicio: fechaInicio,
        FechaFin: fechaFin,
        Total: subtotal,
        Estado: 'Pendiente',
        FechaReserva: new Date().toISOString()
      };

      try {
        // Esto asume que en apiClientSoap.js tienes implementado crearReserva → WS_Reserva.CrearReserva
        const rawReserva = await apiClient.crearReserva(reservaDto);

        const reservaCreada =
          rawReserva?.data ||
          rawReserva?.reserva ||
          rawReserva?.Reserva ||
          rawReserva;

        reservasCreadas.push(reservaCreada);
      } catch (e) {
        console.error(
          'Error creando reserva para item del carrito:',
          e.message || e
        );
      }

      const idItem =
        it.IdItem ||
        it.idItem ||
        it.id ||
        it.ID_ITEM;

      if (idItem) {
        try {
          await apiClient.eliminarItemCarrito(idItem);
        } catch (e) {
          console.error(
            'Error borrando item del carrito:',
            e.message || e
          );
        }
      }
    }

    // Limpiar carrito en sesion
    req.session.carritoId = null;

    // Por ahora redirigimos a la lista de reservas
    return res.redirect('/reservas');
  } catch (err) {
    console.error(
      'Error al generar reservas desde el carrito:',
      err.message || err
    );

    return res.status(500).render('carrito/index', {
      titulo: 'Tu carrito',
      items: [],
      subtotal: 0,
      iva: 0,
      total: 0,
      error: 'No se pudo generar la reserva.',
      usuario
    });
  }
};

module.exports = {
  verCarrito,
  agregarItem,
  eliminarItem,
  generarReserva
};
