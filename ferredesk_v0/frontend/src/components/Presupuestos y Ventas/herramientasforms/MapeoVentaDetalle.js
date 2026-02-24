// MapeoVentaDetalle.js
// Utilidad para mapear los datos crudos de la vista calculada de venta/presupuesto a un objeto listo para usar en la UI

export function mapearVentaDetalle({
  ventaCalculada,
  itemsCalculados = [],
  ivaDiscriminado = [],
  clientes = [],
  vendedores = [],
  plazos = [],
  sucursales = [],
  puntosVenta = [],
  localidades = [],
  provincias = []
}) {
  if (!ventaCalculada) return null;

  // Helper para estado
  const mapearEstado = (ven_estado) => {
    if (ven_estado === 'AB') return 'Abierto';
    if (ven_estado === 'CE') return 'Cerrado';
    return ven_estado || '-';
  };

  // Helper para número formateado
  const armarNumeroFormateado = (letra, punto, numero) => {
    if (letra && punto != null && numero != null) {
      return `${letra} ${String(punto).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
    }
    if (punto != null && numero != null) {
      return `${String(punto).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
    }
    return '-';
  };

  // Mapear comprobante
  let comprobante = ventaCalculada.comprobante;
  if (!comprobante || typeof comprobante !== 'object') {
    comprobante = {
      id: ventaCalculada.comprobante_id,
      nombre: ventaCalculada.comprobante_nombre,
      letra: ventaCalculada.comprobante_letra,
      tipo: ventaCalculada.comprobante_tipo,
      codigo_afip: ventaCalculada.comprobante_codigo_afip,
      descripcion: ventaCalculada.comprobante_descripcion,
      activo: ventaCalculada.comprobante_activo,
    };
  }

  // Buscar cliente completo
  const clienteCompleto = clientes.find(c => c.id === ventaCalculada.ven_idcli);

  // Helpers para obtener nombres legibles de localidad y provincia evitando mostrar IDs
  const obtenerNombreLocalidad = (valorLocalidad) => {
    // Si viene un objeto con nombre
    if (valorLocalidad && typeof valorLocalidad === 'object') {
      return valorLocalidad.nombre || valorLocalidad.LOC_DENO || valorLocalidad.deno || '';
    }
    // Si viene una cadena ya legible
    if (typeof valorLocalidad === 'string') {
      return valorLocalidad;
    }
    // Si viene un ID numérico, buscar en catálogo
    if (typeof valorLocalidad === 'number') {
      const encontrado = localidades.find(l => l.id === valorLocalidad);
      return encontrado?.nombre || '';
    }
    return '';
  };

  const obtenerNombreProvincia = (valorProvincia) => {
    if (valorProvincia && typeof valorProvincia === 'object') {
      return valorProvincia.nombre || valorProvincia.PRV_DENO || valorProvincia.deno || '';
    }
    if (typeof valorProvincia === 'string') {
      return valorProvincia;
    }
    if (typeof valorProvincia === 'number') {
      const encontrado = provincias.find(p => p.id === valorProvincia);
      return encontrado?.nombre || '';
    }
    return '';
  };

  // Mapear campos de cabecera
  const datos = {
    ...ventaCalculada,
    comprobante,
    numero_formateado: ventaCalculada.numero_formateado || armarNumeroFormateado(
      comprobante.letra,
      ventaCalculada.ven_punto,
      ventaCalculada.ven_numero
    ),
    estado: mapearEstado(ventaCalculada.ven_estado),
    fecha: ventaCalculada.ven_fecha,
    hora_creacion: ventaCalculada.hora_creacion,
    cliente: clienteCompleto?.razon || ventaCalculada.ven_idcli || '-',
    vendedor: vendedores.find(v => v.id === ventaCalculada.ven_idvdo)?.nombre || ventaCalculada.ven_idvdo || '-',
    sucursal: sucursales.find(s => s.id === ventaCalculada.ven_sucursal)?.nombre || ventaCalculada.ven_sucursal || '-',
    puntoVenta: puntosVenta.find(pv => pv.id === ventaCalculada.ven_punto)?.nombre || ventaCalculada.ven_punto || '-',
    plazo: plazos.find(p => p.id === ventaCalculada.ven_idpla)?.nombre || ventaCalculada.ven_idpla || '-',
    domicilio: clienteCompleto?.domicilio || ventaCalculada.ven_domicilio || '',
    localidad: obtenerNombreLocalidad(clienteCompleto?.localidad),
    provincia: obtenerNombreProvincia(clienteCompleto?.provincia),
    cuit: ventaCalculada.ven_cuit || clienteCompleto?.cuit || '',
    condicion_iva_cliente: clienteCompleto?.condicion_iva || ventaCalculada.cliente_condicion_iva || '',
    telefono_cliente: clienteCompleto?.telefono || '',
    items: itemsCalculados || [],
    iva_discriminado: ivaDiscriminado || [],
    pagos_detalle: ventaCalculada.pagos_detalle || [],
  };

  return datos;
} 