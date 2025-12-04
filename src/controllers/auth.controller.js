// src/controllers/auth.controller.js
const apiClient = require('../services/apiClientSoap');


// =======================
// GET /login
// =======================
const mostrarLogin = (req, res) => {
  const returnUrl = req.query.returnUrl || null;

  const mensajeInfo =
    req.query.from === 'carrito'
      ? 'Inicia sesion para agregar vehiculos al carrito.'
      : null;

  res.render('auth/login', {
    titulo: 'Iniciar sesión',
    error: null,
    mensajeInfo,
    returnUrl
  });
};

// =======================
// POST /login
// =======================
async function procesarLogin(req, res) {
  const { email, password, returnUrl } = req.body;
  const destino = returnUrl && returnUrl !== '' ? returnUrl : '/vehiculos';

  if (!email || !password) {
    return res.status(400).render('auth/login', {
      titulo: 'Iniciar sesión',
      error: 'Debes ingresar correo y contraseña.',
      mensajeInfo: null,
      returnUrl: returnUrl || ''
    });
  }

  try {
    const usuario = await apiClient.loginUsuarioPorListado(email, password);

    if (!usuario) {
      return res.status(401).render('auth/login', {
        titulo: 'Iniciar sesión',
        error: 'Email o contraseña incorrectos.',
        mensajeInfo: null,
        returnUrl: returnUrl || ''
      });
    }

    req.session.usuario = {
      id: usuario.IdUsuario,
      nombres: usuario.Nombre,
      apellidos: usuario.Apellido,
      email: usuario.Email,
      rol: usuario.Rol,
      pais: usuario.Pais
    };

    if (String(usuario.Rol || '').toLowerCase() === 'admin') {
      return res.redirect('/admin');
    }

    return res.redirect(destino);
  } catch (err) {
    console.error('Error en login:', err.response?.data || err.message);
    res.status(500).render('auth/login', {
      titulo: 'Iniciar sesión',
      error: 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.',
      mensajeInfo: null,
      returnUrl: returnUrl || ''
    });
  }
}

// =======================
// GET /registro
// =======================
function mostrarRegistro(req, res) {
  res.render('auth/registro', {
    titulo: 'Crear cuenta',
    errores: [],
    valores: {}
  });
}

// =======================
// POST /registro
// =======================
async function procesarRegistro(req, res) {
  const {
    nombres,
    apellidos,
    email,
    telefono,
    pais,
    edad,
    tipoIdentificacion,
    identificacion,
    direccion,
    password,
    confirmarPassword
  } = req.body;

  const errores = [];
  const valores = {
    nombres,
    apellidos,
    email,
    telefono,
    direccion,
    pais,
    tipoIdentificacion,
    identificacion,
    edad
  };

  // ==========================
  // 1) Campos obligatorios
  // ==========================
  if (
    !nombres ||
    !apellidos ||
    !email ||
    !telefono ||
    !pais ||
    !tipoIdentificacion ||
    !identificacion ||
    !edad ||
    !direccion ||
    !password ||
    !confirmarPassword
  ) {
    errores.push('Todos los campos son obligatorios.');
  }

  // Regex reutilizables
  const soloLetrasRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
  const soloDigitosRegex = /^\d+$/;
  const direccionRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]+$/;

  // ========================================
  // 2) Nombres / Apellidos (solo letras)
  // ========================================
  if (nombres && !soloLetrasRegex.test(nombres)) {
    errores.push('El nombre solo puede contener letras y espacios.');
  }

  if (apellidos && !soloLetrasRegex.test(apellidos)) {
    errores.push('Los apellidos solo pueden contener letras y espacios.');
  }

  // ========================================
  // 3) Teléfono (solo números, 9 a 10 dígitos)
  // ========================================
  if (telefono) {
    if (!soloDigitosRegex.test(telefono)) {
      errores.push('El teléfono solo puede contener números (sin signos).');
    } else if (telefono.length < 9 || telefono.length > 10) {
      errores.push('El teléfono debe tener entre 9 y 10 dígitos.');
    }
  }

  // ========================================
  // 4) Dirección (sin caracteres especiales)
  //    letras + números + espacios
  // ========================================
  if (direccion && !direccionRegex.test(direccion)) {
    errores.push('La dirección solo puede contener letras, números y espacios.');
  }

  // ==========================
  // 5) Email (sin dominios raros tipo .com.es)
  // ==========================
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(com|net|org|ec|es)$/;
  if (email && !emailRegex.test(email)) {
    errores.push('El correo electrónico no tiene un formato válido.');
  }

  // ==========================
  // 6) Edad (solo dígitos, 18–90)
  // ==========================
  let edadNum = null;
  if (!soloDigitosRegex.test(edad || '')) {
    errores.push('La edad debe contener solo números, sin signos.');
  } else {
    edadNum = parseInt(edad, 10);
    if (isNaN(edadNum) || edadNum < 18 || edadNum > 90) {
      errores.push('Debes tener una edad entre 18 y 90 años para registrarte.');
    }
  }

  // ==========================
  // 7) Contraseña segura
  // ==========================
  const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passRegex.test(password || '')) {
    errores.push(
      'La contraseña debe tener mínimo 8 caracteres, con mayúsculas, minúsculas y números.'
    );
  }

  if (password !== confirmarPassword) {
    errores.push('Las contraseñas no coinciden.');
  }

  // ==========================
  // 8) Identificación
  // ==========================
  if (tipoIdentificacion === 'CI') {
    // Cédula ecuatoriana simple: 10 dígitos
    if (!/^\d{10}$/.test(identificacion || '')) {
      errores.push('La cédula debe tener exactamente 10 dígitos numéricos.');
    }
  } else if (tipoIdentificacion === 'PASAPORTE') {
    // Pasaporte: 6-15 alfanuméricos
    if (!/^[A-Za-z0-9]{6,15}$/.test(identificacion || '')) {
      errores.push(
        'El pasaporte debe tener entre 6 y 15 caracteres alfanuméricos.'
      );
    }
  } else if (tipoIdentificacion === 'LICENCIA') {
    // Licencia: 6-20 letras/números/guiones
    if (!/^[A-Za-z0-9-]{6,20}$/.test(identificacion || '')) {
      errores.push(
        'La licencia debe tener entre 6 y 20 caracteres (letras, números o guiones).'
      );
    }
  } else {
    errores.push('Debes seleccionar un tipo de identificación válido.');
  }

  // ==========================
  // 9) Si hay errores → re-render
  // ==========================
  if (errores.length > 0) {
    return res.status(400).render('auth/registro', {
      titulo: 'Crear cuenta',
      errores,
      valores
    });
  }

  // ==========================
  // 10) Llamada a la API
  // ==========================
  const payload = {
    Nombre: nombres,
    Apellido: apellidos,
    Email: email,
    Contrasena: password,
    Direccion: direccion,
    Pais: pais,
    Edad: edadNum,
    TipoIdentificacion: tipoIdentificacion,
    Identificacion: identificacion,
    Rol: 'Cliente',
    UsuarioCorreo: null
  };

  try {
    const nuevoUsuario = await apiClient.registrarUsuario(payload);

    if (!nuevoUsuario) {
      return res.status(500).render('auth/registro', {
        titulo: 'Crear cuenta',
        errores: ['No se pudo crear el usuario en el servidor.'],
        valores
      });
    }

    // iniciar sesión directo después de registrarse
    req.session.usuario = {
      id: nuevoUsuario.IdUsuario,
      nombres: nuevoUsuario.Nombre,
      apellidos: nuevoUsuario.Apellido,
      email: nuevoUsuario.Email,
      rol: nuevoUsuario.Rol,
      pais: nuevoUsuario.Pais
    };

    res.redirect('/vehiculos');
  } catch (err) {
    console.error(
      'Error registrando usuario:',
      err.response?.data || err.message
    );
    res.status(500).render('auth/registro', {
      titulo: 'Crear cuenta',
      errores: ['Ocurrió un error al registrar el usuario.'],
      valores
    });
  }
}

// =======================
// POST /logout
// =======================
function cerrarSesion(req, res) {
  req.session.destroy(() => {
    res.redirect('/');
  });
}

module.exports = {
  mostrarLogin,
  procesarLogin,
  mostrarRegistro,
  procesarRegistro,
  cerrarSesion
};
