// src/controllers/admin.controller.js
const apiClient = require('../services/apiClientSoap');

// =======================
// Middleware: solo admins
// =======================
function requireAdmin(req, res, next) {
    const user = req.session.usuario;

    if (!user) {
        return res.redirect('/login?returnUrl=/admin');
    }

    const rol = String(user.rol || user.Rol || '').toLowerCase();
    if (rol !== 'admin') {
        return res.status(403).send('Acceso no autorizado');
    }

    next();
}

// =======================
// GET /admin  → dashboard
// =======================
async function dashboard(req, res) {
    res.render('admin/index', {
        titulo: 'Panel de administración',
        usuario: req.session.usuario
    });
}

// =====================================================
// Helpers para VEHICULOS (mapear y validar datos)
// =====================================================
function mapVehiculoFromBody(body, idDesdeRuta) {
    const parseIntOrNull = (v) => {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
    };

    const parseFloatOrZero = (v) => {
        const n = parseFloat(v);
        return Number.isNaN(n) ? 0 : n;
    };

    const precioDiaValor =
        body.PrecioDia ??
        body.precioDia ??
        body.precio_dia ??
        body.precio;

    const precioDia = parseFloatOrZero(precioDiaValor);

    return {
        IdVehiculo: idDesdeRuta ?? (body.IdVehiculo ? parseInt(body.IdVehiculo, 10) : undefined),
        Marca: (body.Marca || body.marca || '').trim(),
        Modelo: (body.Modelo || body.modelo || '').trim(),
        Anio: parseIntOrNull(body.Anio || body.anio),
        IdCategoria: parseIntOrNull(body.IdCategoria || body.idCategoria),
        IdTransmision: parseIntOrNull(body.IdTransmision || body.idTransmision),
        Capacidad: parseIntOrNull(body.Capacidad || body.capacidad),
        PrecioDia: precioDia,
        PrecioNormal: precioDia,
        PrecioActual: precioDia,
        Matricula: body.Matricula || body.matricula || null,
        IdPromocion: body.IdPromocion ? parseInt(body.IdPromocion, 10) : null,
        Estado: (body.Estado || body.estado || '').trim() || 'Disponible',
        Descripcion: (body.Descripcion || body.descripcion || '').trim(),
        IdSucursal: parseIntOrNull(body.IdSucursal || body.idSucursal),
        UrlImagen: (body.UrlImagen || body.urlImagen || body.imagenUrl || body.ImagenUrl || '').trim() || null
    };
}

function mapReservaFromBody(body, idDesdeRuta) {
  const parseIntOrNull = (v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  const parseFloatOrZero = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const idReserva = idDesdeRuta
    ? parseIntOrNull(idDesdeRuta)
    : parseIntOrNull(body.idReserva || body.IdReserva);

  const fechaInicio = body.fechaInicio || body.FechaInicio || '';
  const fechaFin = body.fechaFin || body.FechaFin || '';

  // fecha de la reserva (no se muestra en el front)
  const ahoraISO = new Date().toISOString();
  const fechaReserva =
    body.fechaReserva || body.FechaReserva || ahoraISO;

  // Normalizar estado a "Pendiente / Confirmada / Cancelada"
  const estadoRaw = body.estado || body.Estado || 'Pendiente';
  let estadoNorm = estadoRaw.toString().trim();
  if (!estadoNorm) estadoNorm = 'Pendiente';

  const up = estadoNorm.toUpperCase();
  if (up === 'PENDIENTE') estadoNorm = 'Pendiente';
  else if (up === 'CONFIRMADA') estadoNorm = 'Confirmada';
  else if (up === 'CANCELADA') estadoNorm = 'Cancelada';

  const total = parseFloatOrZero(body.total || body.Total);

  return {
    IdReserva: idReserva || 0,
    IdUsuario: parseIntOrNull(body.idUsuario || body.IdUsuario),
    IdVehiculo: parseIntOrNull(body.idVehiculo || body.IdVehiculo),
    NombreUsuario: body.nombreUsuario || body.NombreUsuario || '',
    CorreoUsuario: body.correoUsuario || body.CorreoUsuario || '',
    VehiculoNombre: body.vehiculoNombre || body.VehiculoNombre || '',
    VehiculoMatricula: body.vehiculoMatricula || body.VehiculoMatricula || '',
    CategoriaNombre: body.categoriaNombre || body.CategoriaNombre || '',
    TransmisionNombre: body.transmisionNombre || body.TransmisionNombre || '',
    FechaInicio: fechaInicio,
    FechaFin: fechaFin,
    FechaReserva: fechaReserva,   // ← se manda al back sin mostrarse
    Total: total,
    Estado: estadoNorm,
    Observaciones: body.observaciones || body.Observaciones || ''
  };
}


function validarReservaModelo(reserva) {
  const errores = [];

  if (!reserva.IdUsuario || reserva.IdUsuario <= 0) {
    errores.push('El IdUsuario es obligatorio.');
  }
  if (!reserva.IdVehiculo || reserva.IdVehiculo <= 0) {
    errores.push('El IdVehiculo es obligatorio.');
  }
  if (!reserva.FechaInicio) {
    errores.push('La fecha de inicio es obligatoria.');
  }
  if (!reserva.FechaFin) {
    errores.push('La fecha de fin es obligatoria.');
  }
  if (reserva.FechaInicio && reserva.FechaFin && reserva.FechaFin < reserva.FechaInicio) {
    errores.push('La fecha de fin no puede ser menor que la fecha de inicio.');
  }

  if (!reserva.Total || reserva.Total <= 0) {
    errores.push('El total debe ser mayor que 0.');
  }

  const estadosValidos = ['Pendiente', 'Confirmada', 'Cancelada'];
  if (!reserva.Estado || !estadosValidos.includes(reserva.Estado)) {
    errores.push('El estado debe ser Pendiente, Confirmada o Cancelada.');
  }

  return errores;
}


function mapFacturaFromBody(body, idDesdeRuta) {
  const parseIntOrNull = (v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  const parseFloatOrZero = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const idFactura = idDesdeRuta
    ? parseIntOrNull(idDesdeRuta)
    : parseIntOrNull(body.idFactura || body.IdFactura);

  const valorTotal = parseFloatOrZero(body.valorTotal || body.ValorTotal);

  // Fecha de emisión: se maneja por detrás con la fecha actual
  const ahoraISO = new Date().toISOString();
  const fechaEmision = body.fechaEmision || body.FechaEmision || ahoraISO;

  return {
    IdFactura: idFactura || 0,
    IdReserva: parseIntOrNull(body.idReserva || body.IdReserva),
    UriFactura: body.uriFactura || body.UriFactura || '',
    FechaEmision: fechaEmision,
    ValorTotal: valorTotal
  };
}


function validarFacturaModelo(factura) {
  const errores = [];

  if (!factura.IdReserva || factura.IdReserva <= 0) {
    errores.push('La reserva asociada es obligatoria.');
  }
  if (!factura.UriFactura) {
    errores.push('El enlace de la factura es obligatorio.');
  }
  if (!factura.FechaEmision) {
    errores.push('La fecha de emisión es obligatoria.');
  }
  if (!factura.ValorTotal || factura.ValorTotal <= 0) {
    errores.push('El valor total debe ser mayor que cero.');
  }

  return errores;
}


function validarVehiculo(dto) {
    const errores = [];
    const anioActual = new Date().getFullYear();

    // Marca / modelo
    if (!dto.Marca) errores.push('La marca es obligatoria.');
    if (!dto.Modelo) errores.push('El modelo es obligatorio.');

    // Año
    if (!Number.isInteger(dto.Anio)) {
        errores.push('El año es obligatorio.');
    } else {
        if (dto.Anio < 1990) errores.push('El año no puede ser menor a 1990.');
        if (dto.Anio > anioActual) errores.push('El año no puede ser mayor al año actual.');
    }

    // Capacidad
    if (!Number.isInteger(dto.Capacidad) || dto.Capacidad <= 0) {
        errores.push('La capacidad debe ser mayor a 0.');
    } else if (dto.Capacidad > 9) {
        errores.push('La capacidad máxima permitida es 9 personas.');
    }

    // Precio
    if (dto.PrecioDia <= 0) {
        errores.push('El precio por día debe ser mayor a 0.');
    }

    // IDs básicos
    if (!Number.isInteger(dto.IdCategoria) || dto.IdCategoria <= 0) {
        errores.push('La categoría es obligatoria.');
    }

    if (!Number.isInteger(dto.IdSucursal) || dto.IdSucursal <= 0) {
        errores.push('La sucursal es obligatoria.');
    }

    // Transmisión (1..3)
    if (!Number.isInteger(dto.IdTransmision) || dto.IdTransmision < 1 || dto.IdTransmision > 3) {
        errores.push('El ID de transmisión debe estar entre 1 y 3.');
    }

    // URL imagen
    if (dto.UrlImagen && !/^https?:\/\//i.test(dto.UrlImagen)) {
        errores.push('La URL de la imagen debe empezar con http:// o https://');
    }

    // Estado
    const estadosValidos = ['Disponible', 'Mantenimiento', 'Inactivo'];
    if (!dto.Estado || !estadosValidos.includes(dto.Estado)) {
        errores.push('El estado seleccionado no es válido.');
    }

    return errores;
}

// =====================================================
// Helpers para USUARIOS
// =====================================================
function mapUsuarioFromBody(body, idDesdeRuta) {
    const limpiar = (v) => (v || '').toString().trim();
    const parseEdad = (v) => {
        const soloDigitos = (v || '').toString().replace(/\D/g, '');
        if (!soloDigitos) return null;
        const n = parseInt(soloDigitos, 10);
        return Number.isNaN(n) ? null : n;
    };

    return {
        IdUsuario: idDesdeRuta ?? (body.IdUsuario ? parseInt(body.IdUsuario, 10) : undefined),
        Nombre: limpiar(body.Nombre || body.nombre || body.Nombres || body.nombres),
        Apellido: limpiar(body.Apellido || body.apellido || body.Apellidos || body.apellidos),
        Email: limpiar(body.Email || body.email),
        Contrasena: limpiar(body.Contrasena || body.contrasena),
        Direccion: limpiar(body.Direccion || body.direccion),
        Pais: limpiar(body.Pais || body.pais),
        Edad: parseEdad(body.Edad || body.edad),
        TipoIdentificacion: limpiar(body.TipoIdentificacion || body.tipoIdentificacion),
        Identificacion: limpiar(body.Identificacion || body.identificacion),
        Rol: limpiar(body.Rol || body.rol) || 'Cliente'
    };
}

function validarUsuario(dto) {
    const errores = [];

    if (!dto.Nombre) errores.push('El nombre es obligatorio.');
    if (!dto.Apellido) errores.push('El apellido es obligatorio.');

    if (!dto.Email) {
        errores.push('El correo electrónico es obligatorio.');
    } else {
        // Dominio solo letras y un TLD válido, sin cosas como "gma1l.com.es"
        const regexEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z]{3,15}\.(com|net|org|ec|es)$/i;
        if (!regexEmail.test(dto.Email)) {
            errores.push('El correo electrónico no tiene un formato válido (ej: usuario@gmail.com).');
        }
    }

    if (!dto.Contrasena) {
        errores.push('La contraseña es obligatoria.');
    }

    if (!dto.Direccion) {
        errores.push('La dirección es obligatoria.');
    }

    if (!dto.Pais) {
        errores.push('El país es obligatorio.');
    }

    if (dto.Edad == null || Number.isNaN(dto.Edad)) {
        errores.push('La edad es obligatoria.');
    } else if (dto.Edad < 18 || dto.Edad > 90) {
        errores.push('La edad debe estar entre 18 y 90 años.');
    }

    if (!dto.TipoIdentificacion) {
        errores.push('El tipo de identificación es obligatorio.');
    }

    if (!dto.Identificacion) {
        errores.push('La identificación es obligatoria.');
    }

    if (dto.TipoIdentificacion && dto.Identificacion) {
        const tipo = dto.TipoIdentificacion.toUpperCase();
        const id = dto.Identificacion;

        if (tipo === 'CI' && !/^\d{10}$/.test(id)) {
            errores.push('La cédula ecuatoriana debe tener exactamente 10 dígitos numéricos.');
        } else if (tipo === 'PASAPORTE' && !/^[A-Za-z0-9]{6,15}$/.test(id)) {
            errores.push('El pasaporte debe tener entre 6 y 15 caracteres alfanuméricos.');
        } else if (tipo === 'LICENCIA' && !/^[A-Za-z0-9-]{6,20}$/.test(id)) {
            errores.push('La licencia debe tener entre 6 y 20 caracteres; se permiten letras, números y guiones.');
        }
    }

    const rolesPermitidos = ['Cliente', 'Admin', 'cliente', 'admin'];
    if (!dto.Rol || !rolesPermitidos.includes(dto.Rol)) {
        errores.push('El rol debe ser Cliente o Admin.');
    }

    return errores;
}

// =======================
// CRUD VEHICULOS
// =======================

async function listaVehiculos(req, res) {
    try {
        const vehiculos = await apiClient.getVehiculos();

        res.render('admin/vehiculos/index', {
            titulo: 'Gestión de vehículos',
            vehiculos,
            error: null,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error al cargar vehiculos para admin:', err.message);

        res.render('admin/vehiculos/index', {
            titulo: 'Gestión de vehículos',
            vehiculos: [],
            error: 'No se pudieron cargar los vehículos.',
            usuario: req.session.usuario
        });
    }
}

// GET /admin/vehiculos/nuevo
async function formNuevoVehiculo(req, res) {
    try {
        const [categorias, transmisiones, sucursales] = await Promise.all([
            apiClient.getCategoriasVehiculo(),
            apiClient.getTransmisiones(),
            apiClient.getSucursales()
        ]);

        res.render('admin/vehiculos/form', {
            titulo: 'Crear vehículo',
            modo: 'crear',
            vehiculo: {},
            errores: [],
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando listas para nuevo vehículo:', err);
        res.status(500).send('Error al cargar el formulario de vehículo');
    }
}

// POST /admin/vehiculos/nuevo
async function crearVehiculo(req, res) {
    const dto = mapVehiculoFromBody(req.body);
    const errores = validarVehiculo(dto);

    if (errores.length) {
        try {
            const [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);

            return res.status(400).render('admin/vehiculos/form', {
                titulo: 'Crear vehículo',
                modo: 'crear',
                vehiculo: dto,
                errores,
                categorias,
                transmisiones,
                sucursales,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error recargando listas para crear vehiculo:', err);
            return res.status(500).send('Error al validar los datos del vehículo');
        }
    }

    try {
        await apiClient.crearVehiculo(dto);
        return res.redirect('/admin/vehiculos');
    } catch (err) {
        console.error('Error al crear vehiculo:', err.response?.data || err.message);

        let categorias = [], transmisiones = [], sucursales = [];
        try {
            [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);
        } catch (e) {
            console.error('Error recargando listas tras fallo de API (crear):', e);
        }

        const erroresApi = ['Ocurrió un error al crear el vehículo en la API.'];
        return res.status(500).render('admin/vehiculos/form', {
            titulo: 'Crear vehículo',
            modo: 'crear',
            vehiculo: dto,
            errores: erroresApi,
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    }
}

// GET /admin/vehiculos/:id/editar
async function formEditarVehiculo(req, res) {
    try {
        const id = req.params.id;
        const vehiculo = await apiClient.getVehiculoPorId(id);

        const [categorias, transmisiones, sucursales] = await Promise.all([
            apiClient.getCategoriasVehiculo(),
            apiClient.getTransmisiones(),
            apiClient.getSucursales()
        ]);

        res.render('admin/vehiculos/form', {
            titulo: 'Editar vehículo',
            modo: 'editar',
            vehiculo,
            errores: [],
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando edición:', err);
        res.status(500).send('Error al cargar el vehículo');
    }
}

// POST /admin/vehiculos/:id/editar
async function actualizarVehiculo(req, res) {
    const idRuta = parseInt(req.params.id, 10);
    const dto = mapVehiculoFromBody(req.body, idRuta);
    const errores = validarVehiculo(dto);

    if (errores.length) {
        try {
            const [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);

            return res.status(400).render('admin/vehiculos/form', {
                titulo: 'Editar vehículo',
                modo: 'editar',
                vehiculo: dto,
                errores,
                categorias,
                transmisiones,
                sucursales,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Error recargando listas para editar vehiculo:', err);
            return res.status(500).send('Error al validar los datos del vehículo');
        }
    }

    try {
        await apiClient.actualizarVehiculo(dto.IdVehiculo, dto);
        res.redirect('/admin/vehiculos');
    } catch (err) {
        console.error('Error al actualizar vehículo:', err.response?.data || err.message);

        let categorias = [], transmisiones = [], sucursales = [];
        try {
            [categorias, transmisiones, sucursales] = await Promise.all([
                apiClient.getCategoriasVehiculo(),
                apiClient.getTransmisiones(),
                apiClient.getSucursales()
            ]);
        } catch (e) {
            console.error('Error recargando listas tras fallo de API (editar):', e);
        }

        const erroresApi = ['Ocurrió un error al actualizar el vehículo en la API.'];
        return res.status(500).render('admin/vehiculos/form', {
            titulo: 'Editar vehículo',
            modo: 'editar',
            vehiculo: dto,
            errores: erroresApi,
            categorias,
            transmisiones,
            sucursales,
            usuario: req.session.usuario
        });
    }
}

// POST /admin/vehiculos/:id/eliminar
async function eliminarVehiculo(req, res) {
    const id = parseInt(req.params.id, 10);

    try {
        await apiClient.eliminarVehiculo(id);
    } catch (err) {
        console.error('Error al eliminar vehiculo:', err.message);
    }

    return res.redirect('/admin/vehiculos');
}

// =======================
// CRUD USUARIOS
// =======================

async function listaUsuarios(req, res) {
    try {
        const usuarios = await apiClient.getUsuarios();

        res.render('admin/usuarios/index', {
            titulo: 'Gestión de usuarios',
            usuarios,
            error: null,
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error al cargar usuarios para admin:', err.message || err);
        res.render('admin/usuarios/index', {
            titulo: 'Gestión de usuarios',
            usuarios: [],
            error: 'No se pudieron cargar los usuarios.',
            usuario: req.session.usuario
        });
    }
}

// GET /admin/usuarios/nuevo
async function formNuevoUsuario(req, res) {
    res.render('admin/usuarios/form', {
        titulo: 'Crear usuario',
        modo: 'crear',
        usuarioForm: {},
        errores: [],
        usuario: req.session.usuario
    });
}

// POST /admin/usuarios/nuevo
async function crearUsuario(req, res) {
    const dto = mapUsuarioFromBody(req.body);
    const errores = validarUsuario(dto);

    if (errores.length) {
        return res.status(400).render('admin/usuarios/form', {
            titulo: 'Crear usuario',
            modo: 'crear',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }

    try {
        await apiClient.crearUsuario(dto);
        return res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('Error al crear usuario:', err.response?.data || err.message);
        errores.push('Ocurrió un error al crear el usuario en la API.');
        return res.status(500).render('admin/usuarios/form', {
            titulo: 'Crear usuario',
            modo: 'crear',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }
}

// GET /admin/usuarios/:id/editar
async function formEditarUsuario(req, res) {
    try {
        const id = req.params.id;
        const usuarioApi = await apiClient.getUsuarioPorId(id);

        res.render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: usuarioApi,
            errores: [],
            usuario: req.session.usuario
        });
    } catch (err) {
        console.error('Error cargando usuario para edición:', err);
        res.status(500).send('Error al cargar el usuario');
    }
}

// POST /admin/usuarios/:id/editar
async function actualizarUsuario(req, res) {
    const id = parseInt(req.params.id, 10);
    const dto = mapUsuarioFromBody(req.body, id);
    const errores = validarUsuario(dto);

    if (errores.length) {
        return res.status(400).render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }

    try {
        await apiClient.actualizarUsuario(id, dto);
        return res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('Error al actualizar usuario:', err.response?.data || err.message);
        errores.push('Ocurrió un error al actualizar el usuario en la API.');
        return res.status(500).render('admin/usuarios/form', {
            titulo: 'Editar usuario',
            modo: 'editar',
            usuarioForm: dto,
            errores,
            usuario: req.session.usuario
        });
    }
}

// POST /admin/usuarios/:id/eliminar
async function eliminarUsuario(req, res) {
    const id = parseInt(req.params.id, 10);

    try {
        await apiClient.eliminarUsuario(id);
    } catch (err) {
        console.error('Error al eliminar usuario:', err.message || err);
    }

    return res.redirect('/admin/usuarios');
}

// =======================
// CRUD RESERVAS (ADMIN)
// =======================

async function listaReservas(req, res) {
  try {
    const reservas = await apiClient.getReservasAdmin();

    const lista = Array.isArray(reservas) ? reservas : [];

    res.render('admin/reservas/index', {
      titulo: 'Reservas',
      usuario: req.session.usuario,
      reservas: lista
    });
  } catch (err) {
    console.error('Error al obtener reservas:', err.message);
    res.status(500).render('admin/reservas/index', {
      titulo: 'Reservas',
      usuario: req.session.usuario,
      reservas: [],
      error: 'No se pudo cargar la lista de reservas.'
    });
  }
}

async function formNuevaReserva(req, res) {
  try {
    const [usuarios, vehiculos] = await Promise.all([
      apiClient.getUsuarios(),
      apiClient.getVehiculos()
    ]);

    res.render('admin/reservas/form', {
      titulo: 'Crear reserva',
      usuario: req.session.usuario,
      reserva: {},
      errores: [],
      usuarios,
      vehiculos
    });
  } catch (err) {
    console.error('Error cargando datos para nueva reserva:', err.message);
    res.status(500).send('Error al cargar el formulario de reserva');
  }
}


async function crearReserva(req, res) {
  try {
    const modelo = mapReservaFromBody(req.body);
    const errores = validarReservaModelo(modelo);

    if (errores.length > 0) {
      const [usuarios, vehiculos] = await Promise.all([
        apiClient.getUsuarios(),
        apiClient.getVehiculos()
      ]);

      return res.status(400).render('admin/reservas/form', {
        titulo: 'Crear reserva',
        usuario: req.session.usuario,
        reserva: req.body,
        errores,
        usuarios,
        vehiculos
      });
    }

    await apiClient.crearReservaAdmin(modelo);
    res.redirect('/admin/reservas');
  } catch (err) {
    console.error('Error al crear reserva:', err.message);

    let usuarios = [], vehiculos = [];
    try {
      [usuarios, vehiculos] = await Promise.all([
        apiClient.getUsuarios(),
        apiClient.getVehiculos()
      ]);
    } catch (_) {}

    res.status(500).render('admin/reservas/form', {
      titulo: 'Crear reserva',
      usuario: req.session.usuario,
      reserva: req.body,
      errores: ['Ocurrió un error al crear la reserva.'],
      usuarios,
      vehiculos
    });
  }
}

async function formEditarReserva(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/reservas');
  }

  try {
    const [reserva, usuarios, vehiculos] = await Promise.all([
      apiClient.getReservaPorId(id),
      apiClient.getUsuarios(),
      apiClient.getVehiculos()
    ]);

    if (!reserva) {
      return res.redirect('/admin/reservas');
    }

    res.render('admin/reservas/form', {
      titulo: 'Editar reserva',
      usuario: req.session.usuario,
      reserva,
      errores: [],
      usuarios,
      vehiculos
    });
  } catch (err) {
    console.error('Error al cargar reserva:', err.message);
    res.redirect('/admin/reservas');
  }
}

async function actualizarReserva(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/reservas');
  }

  try {
    const modelo = mapReservaFromBody(req.body, id);
    const errores = validarReservaModelo(modelo);

    const [usuarios, vehiculos] = await Promise.all([
      apiClient.getUsuarios(),
      apiClient.getVehiculos()
    ]);

    if (errores.length > 0) {
      return res.status(400).render('admin/reservas/form', {
        titulo: 'Editar reserva',
        usuario: req.session.usuario,
        reserva: { ...req.body, IdReserva: id },
        errores,
        usuarios,
        vehiculos
      });
    }

    await apiClient.actualizarReservaAdmin(id, modelo);
    res.redirect('/admin/reservas');
  } catch (err) {
    console.error('Error al actualizar reserva:', err.message);

    let usuarios = [], vehiculos = [];
    try {
      [usuarios, vehiculos] = await Promise.all([
        apiClient.getUsuarios(),
        apiClient.getVehiculos()
      ]);
    } catch (_) {}

    res.status(500).render('admin/reservas/form', {
      titulo: 'Editar reserva',
      usuario: req.session.usuario,
      reserva: { ...req.body, IdReserva: id },
      errores: ['Ocurrió un error al actualizar la reserva.'],
      usuarios,
      vehiculos
    });
  }
}

async function eliminarReserva(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/reservas');
  }

  try {
    await apiClient.eliminarReservaAdmin(id);
    res.redirect('/admin/reservas');
  } catch (err) {
    console.error('Error al eliminar reserva:', err.message);
    res.redirect('/admin/reservas');
  }
}

async function cambiarEstadoReservaController(req, res) {
  const id = parseInt(req.params.id, 10);
  const { nuevoEstado } = req.body;

  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/reservas');
  }

  try {
    await apiClient.cambiarEstadoReserva(id, nuevoEstado);
    res.redirect('/admin/reservas');
  } catch (err) {
    console.error('Error al cambiar estado de reserva:', err.message);
    res.redirect('/admin/reservas');
  }
}

// =======================
// CRUD FACTURAS (ADMIN)
// =======================

// =======================
// CRUD FACTURAS (ADMIN)
// =======================
async function listaFacturas(req, res) {
  try {
    const [facturasRaw, reservas] = await Promise.all([
      apiClient.getFacturasAdmin(),   // <- ANTES: getFacturas()
      apiClient.getReservasAdmin()    // <- ANTES: getReservas()
    ]);

    const mapReservas = {};
    (reservas || []).forEach(r => {
      const idR = r.IdReserva || r.idReserva;
      if (!idR) return;

      const nombre   = r.NombreUsuario  || r.nombreUsuario  || '';
      const vehiculo = r.VehiculoNombre || r.vehiculoNombre || '';
      const fechaIniRaw = r.FechaInicio || r.fechaInicio || '';
      const fechaIni = (fechaIniRaw + '').slice(0, 10);

      let txt = `#${idR}`;
      const partes = [];
      if (nombre)   partes.push(nombre);
      if (vehiculo) partes.push(vehiculo);
      if (fechaIni) partes.push(`(${fechaIni})`);
      if (partes.length) txt += ' - ' + partes.join(' - ');

      mapReservas[idR] = txt;
    });

    const facturas = (facturasRaw || []).map(f => {
      const idR = f.IdReserva || f.id_reserva || f.idReserva;
      const textoReserva = mapReservas[idR] || (idR ? `#${idR}` : '-');
      return {
        ...f,
        TextoReserva: textoReserva,
        textoReserva
      };
    });

    res.render('admin/facturas/index', {
      titulo: 'Gestión de facturas',
      facturas,
      error: null
    });
  } catch (err) {
    console.error('Error al obtener facturas:', err);
    res.render('admin/facturas/index', {
      titulo: 'Gestión de facturas',
      facturas: [],
      error: 'No se pudieron cargar las facturas.'
    });
  }
}



async function formNuevaFactura(req, res) {
  const idReservaQuery = req.query.idReserva || '';

  try {
    const reservas = await apiClient.getReservasAdmin();

    res.render('admin/facturas/form', {
      titulo: 'Crear factura',
      usuario: req.session.usuario,
      factura: { IdReserva: idReservaQuery },
      reservas,
      errores: []
    });
  } catch (err) {
    console.error('Error cargando reservas para nueva factura:', err.message);
    res.status(500).send('Error al cargar el formulario de factura');
  }
}


async function crearFactura(req, res) {
  try {
    const modelo  = mapFacturaFromBody(req.body);
    const errores = validarFacturaModelo(modelo);

    const reservas = await apiClient.getReservasAdmin();

    if (errores.length > 0) {
      return res.status(400).render('admin/facturas/form', {
        titulo: 'Crear factura',
        usuario: req.session.usuario,
        factura: req.body,
        reservas,
        errores
      });
    }

    await apiClient.crearFacturaAdmin(modelo);
    res.redirect('/admin/facturas');
  } catch (err) {
    console.error('Error al crear factura:', err.response?.data || err.message);

    let reservas = [];
    try {
      reservas = await apiClient.getReservasAdmin();
    } catch (_) {}

    // Mensaje de la API (Swagger muestra Message + ExceptionMessage)
    let msgApi =
      err.response?.data?.ExceptionMessage ||
      err.response?.data?.Message ||
      err.message;

    // Lo dejamos más clarito para el admin
    if (msgApi && msgApi.includes('No se ha registrado ningún pago')) {
      msgApi = 'No se ha registrado ningún pago para esta reserva. ' +
               'Primero registra el pago y luego genera la factura.';
    }

    return res.status(500).render('admin/facturas/form', {
      titulo: 'Crear factura',
      usuario: req.session.usuario,
      factura: req.body,
      reservas,
      errores: [msgApi]
    });
  }
}


async function formEditarFactura(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/facturas');
  }

  try {
    const [factura, reservas] = await Promise.all([
      apiClient.getFacturaPorId(id),
      apiClient.getReservasAdmin()
    ]);

    if (!factura) {
      return res.redirect('/admin/facturas');
    }

    res.render('admin/facturas/form', {
      titulo: 'Editar factura',
      usuario: req.session.usuario,
      factura,
      reservas,
      errores: []
    });
  } catch (err) {
    console.error('Error al cargar factura:', err.message);
    res.redirect('/admin/facturas');
  }
}


async function actualizarFactura(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/facturas');
  }

  try {
    const modelo = mapFacturaFromBody(req.body, id);
    const errores = validarFacturaModelo(modelo);
    const reservas = await apiClient.getReservasAdmin();

    if (errores.length > 0) {
      return res.status(400).render('admin/facturas/form', {
        titulo: 'Editar factura',
        usuario: req.session.usuario,
        factura: { ...req.body, IdFactura: id },
        reservas,
        errores
      });
    }

    await apiClient.actualizarFacturaAdmin(id, modelo);
    res.redirect('/admin/facturas');
  } catch (err) {
    console.error('Error al actualizar factura:', err.message);

    let reservas = [];
    try {
      reservas = await apiClient.getReservasAdmin();
    } catch (_) {}

    res.status(500).render('admin/facturas/form', {
      titulo: 'Editar factura',
      usuario: req.session.usuario,
      factura: { ...req.body, IdFactura: id },
      reservas,
      errores: ['Ocurrió un error al actualizar la factura.']
    });
  }
}

async function eliminarFactura(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || Number.isNaN(id)) {
    return res.redirect('/admin/facturas');
  }

  try {
    await apiClient.eliminarFacturaAdmin(id);
    res.redirect('/admin/facturas');
  } catch (err) {
    console.error('Error al eliminar factura:', err.message);
    res.redirect('/admin/facturas');
  }
}

module.exports = {
    requireAdmin,
    dashboard,
    // VEHICULOS
    listaVehiculos,
    formNuevoVehiculo,
    crearVehiculo,
    formEditarVehiculo,
    actualizarVehiculo,
    eliminarVehiculo,
    // USUARIOS
    listaUsuarios,
    formNuevoUsuario,
    crearUsuario,
    formEditarUsuario,
    actualizarUsuario,
    eliminarUsuario,

    listaReservas,
  formNuevaReserva,
  crearReserva,
  formEditarReserva,
  actualizarReserva,
  eliminarReserva,
  cambiarEstadoReservaController,

  // facturas admin
  listaFacturas,
  formNuevaFactura,
  crearFactura,
  formEditarFactura,
  actualizarFactura,
  eliminarFactura
};
