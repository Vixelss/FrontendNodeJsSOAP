// src/services/apiClientSoap.js
const soap = require('soap');

const SOAP_BASE_URL = 'http://urbandrivegestionsoap.runasp.net';

// =======================================
// Helper: crear cliente SOAP
// =======================================
async function createClient(wsName) {
  const wsdlUrl = `${SOAP_BASE_URL}/${wsName}.asmx?wsdl`;
  return soap.createClientAsync(wsdlUrl);
}

// Normalizar arrays
function toArray(maybeArray, innerKey) {
  if (!maybeArray) return [];
  if (Array.isArray(maybeArray)) return maybeArray;

  if (innerKey && maybeArray[innerKey] != null) {
    const v = maybeArray[innerKey];
    return Array.isArray(v) ? v : [v];
  }

  return [maybeArray];
}

// =======================================
// Vehiculos (público)
// =======================================
async function getVehiculos() {
  try {
    const client = await createClient('WS_Vehiculo');
    const [result] = await client.obtenerVehiculosAsync({});

    const nodo = result?.obtenerVehiculosResult;
    const lista = nodo?.VehiculoDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getVehiculos:', err.message || err);
    throw err;
  }
}

async function getVehiculoPorId(idVehiculo) {
  try {
    const client = await createClient('WS_Vehiculo');
    const [result] = await client.obtenerVehiculoPorIdAsync({ idVehiculo });

    return result?.obtenerVehiculoPorIdResult || null;
  } catch (err) {
    console.error('Error SOAP getVehiculoPorId:', err.message || err);
    throw err;
  }
}

// =======================================
// Transmisiones (lista local)
// =======================================
async function getTransmisiones() {
  return [
    { codigo: 'MT', nombre: 'Manual' },
    { codigo: 'AT', nombre: 'Automatica' },
    { codigo: 'CVT', nombre: 'CVT' }
  ];
}

// =======================================
// Usuarios (login / registro público)
// =======================================
async function loginUsuarioPorListado(email, contrasena) {
  try {
    const client = await createClient('WS_Usuarios');

    try {
      const [result] = await client.LoginAsync({ email, contrasena });
      return result?.LoginResult || null;
    } catch (errInv) {
      const msg = String(errInv.message || '');
      if (msg.includes('Credenciales incorrectas')) {
        return null;
      }
      console.error('Error SOAP loginUsuarioPorListado:', errInv);
      throw errInv;
    }
  } catch (err) {
    console.error('Error creando cliente SOAP (Login):', err.message || err);
    throw err;
  }
}

async function registrarUsuario(payload) {
  const argsCrear = {
    nombre: payload.Nombre,
    apellido: payload.Apellido,
    email: payload.Email,
    contrasena: payload.Contrasena,
    direccion: payload.Direccion,
    pais: payload.Pais,
    edad: payload.Edad,
    tipoIdentificacion: payload.TipoIdentificacion,
    identificacion: payload.Identificacion,
    rol: payload.Rol || 'Cliente'
  };

  try {
    const client = await createClient('WS_Usuarios');

    const [respCrear] = await client.CrearUsuarioAsync(argsCrear);
    const idNuevo = respCrear?.CrearUsuarioResult || null;
    if (!idNuevo) return null;

    const [respObtener] = await client.ObtenerUsuarioPorIdAsync({ id: idNuevo });
    return respObtener?.ObtenerUsuarioPorIdResult || null;
  } catch (err) {
    console.error('Error SOAP registrarUsuario:', err.message || err);
    throw err;
  }
}

// =======================================
// Carrito (WS_CarritoDetalle)
// =======================================
async function obtenerDetalleCarrito(idCarrito) {
  try {
    const client = await createClient('WS_CarritoDetalle');
    const [result] = await client.ObtenerCarritoAsync({ idCarrito });

    const nodo = result?.ObtenerCarritoResult;
    if (!nodo) return [];

    const items = nodo.Items?.CarritoItemDto || [];
    return Array.isArray(items) ? items : [items];
  } catch (err) {
    console.error('Error SOAP obtenerDetalleCarrito:', err.message || err);
    throw err;
  }
}

async function agregarItemCarrito({ IdUsuario, IdVehiculo, FechaInicio, FechaFin }) {
  try {
    const client = await createClient('WS_CarritoDetalle');

    const args = {
      idUsuario: Number(IdUsuario),
      idVehiculo: Number(IdVehiculo),
      fechaInicio: new Date(FechaInicio + 'T00:00:00Z').toISOString(),
      fechaFin: new Date(FechaFin + 'T00:00:00Z').toISOString()
    };

    const [resp] = await client.AgregarVehiculoAsync(args);
    const mensaje = resp?.AgregarVehiculoResult || '';
    console.log('👉 SOAP respuesta AgregarVehiculo:', mensaje);

    return { ok: true, mensaje };
  } catch (err) {
    console.error('❌ Error SOAP agregarItemCarrito:', err.message || err);
    throw err;
  }
}

async function actualizarItemCarrito({ IdItem, FechaInicio, FechaFin }) {
  try {
    const client = await createClient('WS_CarritoDetalle');
    const args = {
      idItem: IdItem,
      fechaInicio: new Date(FechaInicio).toISOString(),
      fechaFin: new Date(FechaFin).toISOString()
    };

    const [resp] = await client.ActualizarItemAsync(args);
    const mensaje = resp?.ActualizarItemResult || '';
    return { ok: mensaje.toLowerCase().includes('exito'), mensaje };
  } catch (err) {
    console.error('Error SOAP actualizarItemCarrito:', err.message || err);
    throw err;
  }
}

async function eliminarItemCarrito(idItem) {
  try {
    const client = await createClient('WS_CarritoDetalle');
    const [resp] = await client.DeleteItemAsync({ idItem });

    const mensaje = resp?.DeleteItemResult || '';
    return { ok: mensaje.toLowerCase().includes('exito'), mensaje };
  } catch (err) {
    console.error('Error SOAP eliminarItemCarrito:', err.message || err);
    throw err;
  }
}

async function getCarritoPorUsuario(idUsuario) {
  try {
    const client = await createClient('WS_CarritoDetalle');

    const [resp] = await client.ObtenerCarritoPorUsuarioAsync({
      idUsuario: Number(idUsuario)
    });

    const data = resp?.ObtenerCarritoPorUsuarioResult;
    if (!data) return null;

    const itemsNode = data.Items?.CarritoItemDto || data.Items || [];
    const items = Array.isArray(itemsNode)
      ? itemsNode
      : (itemsNode ? [itemsNode] : []);

    return {
      IdCarrito: data.IdCarrito,
      IdUsuario: data.IdUsuario,
      FechaCreacion: data.FechaCreacion,
      Items: items
    };
  } catch (err) {
    console.error('Error SOAP getCarritoPorUsuario:', err.message || err);
    throw err;
  }
}

// =======================================
// Reservas (WS_Reserva)
// =======================================
async function getReservasPorUsuario(idUsuario) {
  try {
    const client = await createClient('WS_Reserva');
    const [result] = await client.ObtenerReservasPorUsuarioAsync({ idUsuario });

    const nodo = result?.ObtenerReservasPorUsuarioResult;
    const lista = nodo?.ReservaDto || nodo;

    if (!lista) return [];
    return Array.isArray(lista) ? lista : [lista];
  } catch (err) {
    console.error('Error SOAP getReservasPorUsuario:', err.message || err);
    throw err;
  }
}

async function getReservaPorId(idReserva) {
  try {
    const client = await createClient('WS_Reserva');
    const [result] = await client.ObtenerReservaPorIdAsync({ idReserva });
    return result?.ObtenerReservaPorIdResult || null;
  } catch (err) {
    console.error('Error SOAP getReservaPorId:', err.message || err);
    throw err;
  }
}

async function crearReserva(reservaDto) {
  try {
    const client = await createClient('WS_Reserva');

    const reservaPayload = {
      IdUsuario: Number(reservaDto.IdUsuario),
      IdVehiculo: Number(reservaDto.IdVehiculo),
      NombreUsuario: reservaDto.NombreUsuario || null,
      CorreoUsuario: reservaDto.CorreoUsuario || reservaDto.UsuarioCorreo || null,
      VehiculoNombre: reservaDto.VehiculoNombre || reservaDto.vehiculoNombre || null,
      FechaInicio: new Date(reservaDto.FechaInicio).toISOString(),
      FechaFin: new Date(reservaDto.FechaFin).toISOString(),
      Total: Number(reservaDto.Total),
      Estado: reservaDto.Estado || 'Pendiente',
      FechaReserva: new Date(reservaDto.FechaReserva || new Date()).toISOString()
    };

    const [resp] = await client.CrearReservaAsync({ reserva: reservaPayload });
    const data = resp?.CrearReservaResult || resp?.Reserva || resp;

    console.log('👉 SOAP respuesta CrearReserva:', data);
    return data;
  } catch (err) {
    console.error('Error SOAP crearReserva:', err.message || err);
    throw err;
  }
}

// ===== ADMIN Reservas (mismos nombres que REST) =====
async function getReservas() {
  const client = await createClient('WS_Reserva');
  const [resp] = await client.ObtenerReservasAsync({});
  const nodo = resp?.ObtenerReservasResult;
  const lista = nodo?.ReservaDto || nodo;
  return toArray(lista);
}

async function actualizarReserva(idReserva, reservaDto) {
  const client = await createClient('WS_Reserva');
  const payload = { ...reservaDto, IdReserva: idReserva };
  const [resp] = await client.ActualizarReservaAsync({ reserva: payload });
  return !!resp?.ActualizarReservaResult;
}

async function eliminarReserva(idReserva) {
  const client = await createClient('WS_Reserva');
  const [resp] = await client.EliminarReservaAsync({ idReserva });
  return !!resp?.EliminarReservaResult;
}

async function getReservasAdmin() {
  return getReservas();
}

async function crearReservaAdmin(reserva) {
  return crearReserva(reserva);
}

async function actualizarReservaAdmin(idReserva, reserva) {
  return actualizarReserva(idReserva, reserva);
}

async function eliminarReservaAdmin(idReserva) {
  return eliminarReserva(idReserva);
}

async function cambiarEstadoReserva(idReserva, nuevoEstado) {
  const client = await createClient('WS_Reserva');
  const [resp] = await client.CambiarEstadoReservaAsync({ idReserva, nuevoEstado });
  return !!resp?.CambiarEstadoReservaResult;
}


// =======================================
// Pagos (WS_Pagos) con timeout y logs
// =======================================
async function registrarPagoReserva(pago) {
  const client = await createClient('WS_Pagos');

  const body = {
    IdReserva: Number(pago.IdReserva),
    CuentaCliente: Number(pago.CuentaCliente),
    CuentaComercio: Number(pago.CuentaComercio),
    Monto: Number(pago.Monto)
  };

  console.log('[WS_Pagos] Request CrearPago:', body);

  // Promise.race para evitar que se quede colgado infinito
  const timeoutMs = 15000; // 15 segundos
  const promSoap = (async () => {
    let respArr;

    if (typeof client.CrearPagoAsync === 'function') {
      respArr = await client.CrearPagoAsync({ body });
    } else if (typeof client.crearPagoAsync === 'function') {
      respArr = await client.crearPagoAsync({ body });
    } else if (typeof client.CrearPago === 'function') {
      // versión sin Async
      respArr = [await client.CrearPago({ body })];
    } else {
      throw new Error('Método SOAP CrearPago no encontrado en WS_Pagos');
    }

    const resp = respArr[0];
    console.log('[WS_Pagos] Raw response:', resp);

    const result =
      resp?.CrearPagoResult ||
      resp?.crearPagoResult ||
      resp;

    return {
      mensaje: result?.Mensaje || '',
      aprobado: !!result?.Aprobado,
      respuestaBanco: result?.RespuestaBanco || '',
      idPago: Number(result?.IdPago || 0)
    };
  })();

  const promTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout WS_Pagos.CrearPago')), timeoutMs)
  );

  return Promise.race([promSoap, promTimeout]);
}

// =======================================
// PAGOS (WS_Pagos) – leer pagos por reserva
// =======================================
async function getPagosPorReserva(idReserva) {
  try {
    const client = await createClient('WS_Pagos');
    const [resp] = await client.ListarPagosPorReservaAsync({ idReserva });

    const nodo = resp?.ListarPagosPorReservaResult;
    const lista = nodo?.PagoDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getPagosPorReserva:', err.message || err);
    return [];
  }
}

// =======================================
// RESERVAS – actualizar estado (wrapper)
// =======================================

// Reutilizamos la función que ya tienes definida arriba
async function actualizarEstadoReserva(idReserva, nuevoEstado) {
  return cambiarEstadoReserva(idReserva, nuevoEstado);
}

// =======================================
// ADMIN – Vehiculos (CRUD)
// =======================================
async function crearVehiculo(data) {
  const client = await createClient('WS_Vehiculo');

  const vehiculoDto = {
    Marca: data.Marca,
    Modelo: data.Modelo,
    Anio: Number(data.Anio),
    Placa: data.Placa || data.Matricula || '',
    Capacidad: Number(data.Capacidad),
    PrecioDia: Number(data.PrecioDia || data.PrecioPorDia || data.Precio),
    IdCategoria: Number(data.IdCategoria),
    IdSucursal: Number(data.IdSucursal),
    IdTransmision: Number(
      data.IdTransmision ?? data.idTransmision ?? data.Transmision
    ),
    UrlImagen: data.UrlImagen || data.UrlImagenVehiculo || data.Imagen || '',
    Estado: data.Estado,
    Descripcion: data.Descripcion || '',
    IdPromocion:
      data.IdPromocion != null && data.IdPromocion !== ''
        ? Number(data.IdPromocion)
        : null
  };

  const [resp] = await client.crearVehiculoAsync({ vehiculo: vehiculoDto });
  return resp?.crearVehiculoResult || resp?.CrearVehiculoResult || 0;
}


async function actualizarVehiculo(idVehiculo, data) {
  const client = await createClient('WS_Vehiculo');

  // OJO: respetamos la misma estructura que enviabas al REST
  const vehiculoDto = {
    IdVehiculo: Number(idVehiculo),
    Marca: data.Marca,
    Modelo: data.Modelo,
    Anio: Number(data.Anio),
    Placa: data.Placa || data.Matricula || '',
    Capacidad: Number(data.Capacidad),
    PrecioDia: Number(data.PrecioDia || data.PrecioPorDia || data.Precio),

    // Estos son los FKs importantes
    IdCategoria: Number(data.IdCategoria),
    IdSucursal: Number(data.IdSucursal),

    // 🔴 ESTE ES EL QUE ESTABA FALTANDO
    IdTransmision: Number(
      data.IdTransmision ?? data.idTransmision ?? data.Transmision
    ),

    UrlImagen: data.UrlImagen || data.UrlImagenVehiculo || data.Imagen || '',
    Estado: data.Estado,
    Descripcion: data.Descripcion || '',
    IdPromocion:
      data.IdPromocion != null && data.IdPromocion !== ''
        ? Number(data.IdPromocion)
        : null
  };

  // El WS espera (idVehiculo, vehiculo)
  const [resp] = await client.actualizarVehiculoAsync({
    idVehiculo: Number(idVehiculo),
    vehiculo: vehiculoDto
  });

  const ok = resp?.actualizarVehiculoResult ?? resp?.ActualizarVehiculoResult;
  return !!ok;
}

async function eliminarVehiculo(idVehiculo) {
  const client = await createClient('WS_Vehiculo');
  const [resp] = await client.eliminarVehiculoAsync({ idVehiculo });
  return !!(resp?.eliminarVehiculoResult ?? resp?.EliminarVehiculoResult);
}

// Categorias de vehiculo (CORREGIDO: obtenerCategoriasVehiculo)
async function getCategoriasVehiculo() {
  try {
    const client = await createClient('WS_CategoriaVehiculo');
    const [resp] = await client.obtenerCategoriasVehiculoAsync({});
    const nodo = resp?.obtenerCategoriasVehiculoResult;
    const lista = nodo?.CategoriaVehiculoDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getCategoriasVehiculo:', err.message || err);

    // fallback: intentar armar desde los vehiculos
    try {
      const vehiculos = await getVehiculos();
      const mapa = new Map();
      vehiculos.forEach((v) => {
        const id =
          v.IdCategoria ||
          v.idCategoria ||
          v.idCategoriaVehiculo ||
          v.id_categoria;

        const nombre =
          v.NombreCategoria ||
          v.nombreCategoria ||
          v.Categoria ||
          v.categoria;

        if (id != null && nombre && !mapa.has(id)) {
          mapa.set(id, { IdCategoria: id, Nombre: nombre });
        }
      });
      return Array.from(mapa.values());
    } catch (e2) {
      console.error('Error generando categorias fallback:', e2);
      return [];
    }
  }
}

// Sucursales (CORREGIDO: obtenerSucursales)
async function getSucursales() {
  try {
    const client = await createClient('WS_Sucursales');
    const [resp] = await client.obtenerSucursalesAsync({});
    const nodo = resp?.obtenerSucursalesResult;
    const lista = nodo?.SucursalDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getSucursales:', err.message || err);
    return [];
  }
}

// Promociones (WS_Promocion)
async function getPromociones() {
  try {
    const client = await createClient('WS_Promocion');
    const [resp] = await client.ObtenerPromocionesAsync({});
    const nodo = resp?.ObtenerPromocionesResult;
    const lista = nodo?.PromocionDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getPromociones:', err.message || err);
    return [];
  }
}

// =======================================
// ADMIN – Usuarios (CRUD)
// =======================================
async function obtenerUsuarios() {
  const client = await createClient('WS_Usuarios');
  const [resp] = await client.ListarUsuariosAsync({});
  const nodo = resp?.ListarUsuariosResult;
  const lista = nodo?.UsuarioDto || nodo;
  return toArray(lista);
}

async function getUsuarios() {
  return obtenerUsuarios();
}

async function getUsuarioPorId(id) {
  const client = await createClient('WS_Usuarios');
  const [resp] = await client.ObtenerUsuarioPorIdAsync({ id });
  return resp?.ObtenerUsuarioPorIdResult || null;
}

async function crearUsuario(dto) {
  const client = await createClient('WS_Usuarios');
  const [resp] = await client.CrearUsuarioAsync({
    nombre: dto.Nombre,
    apellido: dto.Apellido,
    email: dto.Email,
    contrasena: dto.Contrasena,
    direccion: dto.Direccion,
    pais: dto.Pais,
    edad: dto.Edad,
    tipoIdentificacion: dto.TipoIdentificacion,
    identificacion: dto.Identificacion,
    rol: dto.Rol
  });
  return resp?.CrearUsuarioResult || 0;
}

async function actualizarUsuario(id, dto) {
  const client = await createClient('WS_Usuarios');

  const args = {
    idUsuario: Number(id),
    nombre: dto.Nombre,
    apellido: dto.Apellido,
    email: dto.Email,
    contrasena: dto.Contrasena,
    direccion: dto.Direccion,
    pais: dto.Pais,
    edad: Number(dto.Edad),
    tipoIdentificacion: dto.TipoIdentificacion,
    identificacion: dto.Identificacion,
    rol: dto.Rol
  };

  // El WS NO recibe un DTO, recibe los campos planos
  const [resp] = await client.ActualizarUsuarioAsync(args);

  const ok = resp?.ActualizarUsuarioResult;
  return !!ok;
}

async function eliminarUsuario(id) {
  const client = await createClient('WS_Usuarios');
  const [resp] = await client.EliminarUsuarioAsync({ id });
  return !!resp?.EliminarUsuarioResult;
}

// =======================================
// ADMIN – Facturas (WS_Factura)  ✅ CORREGIDO
// =======================================
async function getFacturasAdmin() {
  try {
    const client = await createClient('WS_Factura');
    const [resp] = await client.obtenerFacturasAsync({});
    const nodo = resp?.obtenerFacturasResult;
    const lista = nodo?.FacturaDto || nodo;
    return toArray(lista);
  } catch (err) {
    console.error('Error SOAP getFacturasAdmin:', err.message || err);
    throw err;
  }
}

async function getFacturaPorId(idFactura) {
  const client = await createClient('WS_Factura');
  const [resp] = await client.obtenerFacturaPorIdAsync({ idFactura });
  return resp?.obtenerFacturaPorIdResult || null;
}

async function crearFacturaAdmin(factura) {
  const client = await createClient('WS_Factura');
  const [resp] = await client.crearFacturaAsync({ factura });
  return resp?.crearFacturaResult || 0;
}

// Crear factura desde el flujo de pago (usuario)
// Alias semántico de crearFacturaAdmin.
async function crearFacturaDesdeReserva(factura) {
  return crearFacturaAdmin(factura);
}

async function actualizarFacturaAdmin(idFactura, factura) {
  const client = await createClient('WS_Factura');
  const payload = { ...factura, IdFactura: idFactura };
  const [resp] = await client.actualizarFacturaAsync({ factura: payload });
  return !!resp?.actualizarFacturaResult;
}

async function eliminarFacturaAdmin(idFactura) {
  const client = await createClient('WS_Factura');
  const [resp] = await client.eliminarFacturaAsync({ idFactura });
  return !!resp?.eliminarFacturaResult;
}

// =======================================
// Exportar TODO (mismos nombres que apiClientRest)
// =======================================
module.exports = {
  // vehículos (público + admin)
  getVehiculos,
  getVehiculoPorId,
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
  getCategoriasVehiculo,
  getSucursales,
  getPromociones,

  // usuarios (login / registro público)
  obtenerUsuarios,
  loginUsuarioPorListado,
  registrarUsuario,

  // usuarios (CRUD admin)
  getUsuarios,
  getUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,

  // categorías / transmisiones
  getTransmisiones,

  // carrito
  agregarItemCarrito,
  obtenerDetalleCarrito,
  getCarritoPorUsuario,
  eliminarItemCarrito,

  // reservas (público + admin)
  crearReserva,
  getReservasPorUsuario,
  getReservaPorId,
  getReservas,
  actualizarReserva,
  eliminarReserva,

  // reservas / facturas admin
  getReservasAdmin,
  crearReservaAdmin,
  actualizarReservaAdmin,
  eliminarReservaAdmin,
  cambiarEstadoReserva,
  getFacturasAdmin,
  getFacturaPorId,
  crearFacturaAdmin,
  crearFacturaDesdeReserva,
  actualizarFacturaAdmin,
  eliminarFacturaAdmin,
  registrarPagoReserva,
  actualizarEstadoReserva,
    // pagos
  getPagosPorReserva,

};
