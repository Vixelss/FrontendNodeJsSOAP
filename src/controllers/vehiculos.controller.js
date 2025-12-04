// src/controllers/vehiculos.controller.js

const apiClient = require('../services/apiClientSoap');


const listarVehiculos = async (req, res) => {
  try {
    const categoriaSeleccionada = req.query.categoria || 'todas';

    const transmisionesSeleccionadas = req.query.transmision
      ? (Array.isArray(req.query.transmision)
          ? req.query.transmision
          : [req.query.transmision])
      : [];

    const precioMin = req.query.precioMin ? parseFloat(req.query.precioMin) : null;
    const precioMax = req.query.precioMax ? parseFloat(req.query.precioMax) : null;

    // OJO: SOLO vehiculos + transmisiones, NADA de categoriasvehiculo
    const [vehiculosApi, transmisiones] = await Promise.all([
      apiClient.getVehiculos(),
      apiClient.getTransmisiones()
    ]);

    let vehiculos = vehiculosApi || [];

    vehiculos = vehiculos.map(v => {
      const precio =
        v.precioDia || v.precio_dia || v.PrecioDia || v.precio || 0;

      const categoriaId =
        v.id_categoria || v.idCategoria || v.IdCategoria || v.idCategoriaVehiculo;

      const categoriaNombre =
        v.categoriaNombre || v.CategoriaNombre || v.categoria || v.Categoria || null;

      // ID de transmision desde la BD
      const transmisionId =
        v.id_transmision || v.idTransmision || v.IdTransmision;

      // Codigo de transmision desde la columna texto (MT / AT / CVT)
      let transmisionCodigo =
        (v.transmision || v.Transmision || '').toString().toUpperCase();

      // Si por alguna razon viniera vacio, mapeamos desde el id
      if (!transmisionCodigo && transmisionId != null) {
        const idNum = Number(transmisionId);
        if (idNum === 1) transmisionCodigo = 'MT';
        else if (idNum === 2) transmisionCodigo = 'AT';
        else if (idNum === 3) transmisionCodigo = 'CVT';
      }

      // Extra: por si alguna vez llega texto tipo "Transmision manual"
      const textoTrans = transmisionCodigo.toLowerCase();
      if (textoTrans.includes('man')) transmisionCodigo = 'MT';
      else if (textoTrans.includes('aut')) transmisionCodigo = 'AT';
      else if (textoTrans.includes('cvt')) transmisionCodigo = 'CVT';

      return {
        ...v,
        _precioDia: Number(precio) || 0,
        _categoriaId: categoriaId,
        _categoriaNombre: categoriaNombre,
        _transmisionId: transmisionId,
        _transmisionCodigo: transmisionCodigo   // ESTE es el que se usa para filtrar
      };
    });

    // Construir categorias unicas desde los vehiculos
    const mapaCategorias = new Map();
    vehiculos.forEach(v => {
      if (v._categoriaId == null) return;
      const id = v._categoriaId;
      const nombre = v._categoriaNombre || ('Categoria ' + id);
      if (!mapaCategorias.has(id)) {
        mapaCategorias.set(id, { id, nombre });
      }
    });
    const categorias = Array.from(mapaCategorias.values());

    // Filtro por categoria
    if (categoriaSeleccionada && categoriaSeleccionada !== 'todas') {
      vehiculos = vehiculos.filter(v =>
        String(v._categoriaId) === String(categoriaSeleccionada)
      );
    }

    // Filtro por transmisiones
    if (transmisionesSeleccionadas.length > 0) {
      const setTrans = transmisionesSeleccionadas.map(t => t.toUpperCase());
      vehiculos = vehiculos.filter(v =>
        setTrans.includes(v._transmisionCodigo)
      );
    }

    // Filtro por rango de precios
    if (precioMin != null) {
      vehiculos = vehiculos.filter(v => v._precioDia >= precioMin);
    }
    if (precioMax != null) {
      vehiculos = vehiculos.filter(v => v._precioDia <= precioMax);
    }

    res.render('vehiculos/index', {
      titulo: 'Vehículos disponibles',
      vehiculos,
      categorias,        // viene de los mismos vehiculos
      transmisiones,     // viene de la API de transmisiones
      filtros: {
        categoriaSeleccionada,
        transmisionesSeleccionadas,
        precioMin,
        precioMax
      }
    });
  } catch (error) {
    console.error('Error en listarVehiculos:', error.message);
    res.status(500).send('Error al cargar los vehículos.');
  }
};

const detalleVehiculo = async (req, res) => {
  try {
    const id = req.params.id;
    const vehiculo = await apiClient.getVehiculoPorId(id);

    if (!vehiculo) {
      return res.status(404).send('Vehículo no encontrado');
    }

    res.render('vehiculos/detalle', {
      titulo: 'Detalle del vehículo',
      vehiculo: vehiculo,
    });
  } catch (error) {
    console.error('Error en detalleVehiculo:', error.message);
    res.status(500).send('Error al cargar el vehículo.');
  }
};

module.exports = {
  listarVehiculos,
  detalleVehiculo,
};
