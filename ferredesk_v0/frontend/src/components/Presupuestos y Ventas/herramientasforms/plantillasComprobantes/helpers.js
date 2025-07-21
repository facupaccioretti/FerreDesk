// helpers.js
// Funciones visuales y utilidades compartidas entre plantillas de comprobantes
import React from 'react';
import { View, Text, Page, Image } from '@react-pdf/renderer';

// Constantes compartidas
export const ALICUOTAS_IVA = [
  { porcentaje: 0, nombre: "0%" },
  { porcentaje: 10.5, nombre: "10.5%" },
  { porcentaje: 21, nombre: "21%" },
  { porcentaje: 27, nombre: "27%" }
];

// Constante para cantidad máxima de items en la tabla
export const CANTIDAD_MAXIMA_ITEMS = 25;

/**
 * Formatea la columna de descuentos visualmente como "5+10+20".
 * @param {number} bonificacion - Bonificación particular del ítem
 * @param {number} descu1 - Descuento 1 general
 * @param {number} descu2 - Descuento 2 general
 * @param {number} descu3 - Descuento 3 general
 * @returns {string} Descuento visual
 */
export const formatearDescuentosVisual = (bonificacionItem = 0, descu1 = 0, descu2 = 0, descu3 = 0) => {
  const partes = [];
  const b = parseFloat(bonificacionItem);
  const d1 = parseFloat(descu1);
  const d2 = parseFloat(descu2);
  const d3 = parseFloat(descu3);
  if (!isNaN(b) && b > 0) partes.push(b % 1 === 0 ? b.toFixed(0) : b.toFixed(2));
  if (!isNaN(d1) && d1 > 0) partes.push(d1 % 1 === 0 ? d1.toFixed(0) : d1.toFixed(2));
  if (!isNaN(d2) && d2 > 0) partes.push(d2 % 1 === 0 ? d2.toFixed(0) : d2.toFixed(2));
  if (!isNaN(d3) && d3 > 0) partes.push(d3 % 1 === 0 ? d3.toFixed(0) : d3.toFixed(2));
  return partes.length ? partes.join('+') : '0';
};

/**
 * Formatea un número como moneda con separadores de miles y dos decimales
 * @param {number|string} valor
 * @returns {string}
 */
export const formatearMoneda = (valor) => {
  if (!valor || valor === 0) return "0.00"
  return Number.parseFloat(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};

/**
 * Formatea una hora eliminando microsegundos para mostrar solo HH:MM:SS
 * @param {string|Date} hora
 * @returns {string}
 */
export const formatearHora = (hora) => {
  if (!hora) return "";
  // Si es un string, extraer solo HH:MM:SS
  if (typeof hora === 'string') {
    return hora.split('.')[0]; // Eliminar microsegundos
  }
  // Si es un objeto Date o similar, formatear manualmente
  return hora.toString().split('.')[0];
};

/**
 * Mapea códigos de situación fiscal a texto legible
 * @param {string} situacion
 * @returns {string}
 */
export const mapearSituacionFiscal = (situacion) => {
  const mapeo = {
    'RI': 'Responsable Inscripto',
  };
  return mapeo[situacion] || situacion;
};

/**
 * Crea un componente de texto que siempre muestra el label, incluso si el valor está vacío
 * @param {any} valor
 * @param {string} label
 * @param {object} styles - Estilos para labelBold y labelNormal
 * @returns {JSX.Element} Componente de texto
 */
export const crearComponenteMostrarSiempre = (valor, label, styles) => {
  const datoMostrar = (!valor || valor === "" || valor === 0) ? "" : valor;
  return (
    <Text style={styles.labelCliente}>
      <Text style={styles.labelBold}>{label}: </Text>
      <Text style={styles.labelNormal}>{datoMostrar}</Text>
    </Text>
  );
};

/**
 * Divide un array de items en páginas según la cantidad máxima permitida
 * @param {Array} items - Array de items a dividir
 * @param {number} itemsPorPagina - Cantidad máxima de items por página
 * @returns {Array} Array de arrays, cada uno representando una página
 */
export const dividirItemsEnPaginas = (items, itemsPorPagina = CANTIDAD_MAXIMA_ITEMS) => {
  if (!items || items.length === 0) return [];
  
  const paginas = [];
  for (let i = 0; i < items.length; i += itemsPorPagina) {
    paginas.push(items.slice(i, i + itemsPorPagina));
  }
  
  return paginas;
};

/**
 * Genera el header común para todas las plantillas de comprobantes
 * @param {Object} data - Datos del comprobante
 * @param {Object} ferreteriaConfig - Configuración de la empresa
 * @param {Object} styles - Estilos del componente
 * @param {Function} mostrarSiempre - Función para mostrar campos con label
 * @param {Function} formatearHora - Función para formatear hora
 * @param {Function} mapearSituacionFiscal - Función para mapear situación fiscal
 * @returns {JSX.Element} Componente del header
 */
export const generarHeaderComun = (data, ferreteriaConfig, styles, mostrarSiempre, formatearHora, mapearSituacionFiscal) => {
  // Debug: Verificar URL del logo
  console.log('🔍 DEBUG LOGO URL:', {
    logo_empresa: ferreteriaConfig?.logo_empresa,
    tieneLogo: !!ferreteriaConfig?.logo_empresa,
    urlCompleta: ferreteriaConfig?.logo_empresa ? `${window.location.origin}${ferreteriaConfig.logo_empresa}` : null
  });

  return (
  <View style={styles.header}>
    {/* SECCIÓN IZQUIERDA */}
    <View style={styles.seccionIzquierda}>
      {/* Información principal centrada */}
      <View style={styles.infoEmpresaCentrada}>
        {ferreteriaConfig.logo_empresa && (
          <View style={styles.logoEmpresa}>
            <Image 
              src="http://localhost:8000/api/productos/servir-logo-empresa/"
              style={styles.logoImagen}
            />
          </View>
        )}
        <Text style={styles.empresaNombre}>
          {ferreteriaConfig.nombre || ""}
        </Text>
        <Text style={styles.empresaInfo}>
          {ferreteriaConfig.direccion || ""}
        </Text>
        <Text style={styles.empresaInfo}>
          {ferreteriaConfig.telefono || ""}
        </Text>
      </View>
      
      {/* Situación fiscal en el piso */}
      <Text style={styles.situacionFiscal}>
        {ferreteriaConfig.situacion_iva ? mapearSituacionFiscal(ferreteriaConfig.situacion_iva) : ""}
      </Text>
    </View>

    {/* LÍNEA DIVISORIA CENTRAL */}
    <View style={styles.lineaDivisoriaCentral} />

    {/* RECUADRO DE LETRA FLOTANTE */}
    <View style={styles.recuadroLetraFlotante}>
      {data.comprobante?.letra && (
        <Text style={styles.letraGrande}>{data.comprobante.letra}</Text>
      )}
      {data.comprobante?.codigo_afip && (
         <Text style={styles.codigoOriginal}>CÓD. {data.comprobante.codigo_afip}</Text>
      )}
       <Text style={styles.codigoOriginal}>ORIGINAL</Text>
    </View>

    {/* SECCIÓN DERECHA */}
    <View style={styles.seccionDerecha}>
      <View style={styles.facturaInfoTop}>
        <Text style={styles.facturaTitle}>FACTURA</Text>
        {data.numero_formateado && (
          <Text style={styles.numeroComprobante}>{data.numero_formateado}</Text>
        )}
        {data.fecha && (
          <Text style={styles.fechaEmision}>Fecha de Emisión: {data.fecha}</Text>
        )}
        {data.hora_creacion && (
          <Text style={styles.fechaEmision}>Hora: {formatearHora(data.hora_creacion)}</Text>
        )}
        {!data.hora_creacion && (
          <Text style={styles.fechaEmision}>Hora: No disponible</Text>
        )}
      </View>
      <View style={styles.facturaInfoBottom}>
        {mostrarSiempre(ferreteriaConfig.cuit_cuil, "CUIT", styles)}
        {mostrarSiempre(ferreteriaConfig.ingresos_brutos, "Ingresos Brutos", styles)}
        {mostrarSiempre(ferreteriaConfig.inicio_actividad, "Inicio de Actividades", styles)}
      </View>
    </View>
  </View>
  );
};

/**
 * Genera la información del cliente común para todas las plantillas
 * @param {Object} data - Datos del comprobante
 * @param {Object} styles - Estilos del componente
 * @param {Function} mostrarSiempre - Función para mostrar campos con label
 * @returns {JSX.Element} Componente de información del cliente
 */
export const generarInfoClienteComun = (data, styles, mostrarSiempre) => (
  <View style={styles.infoCliente}>
    <View style={styles.clienteIzquierda}>
      {mostrarSiempre(data.cliente, "Razón Social", styles)}
      {mostrarSiempre(data.domicilio, "Domicilio", styles)}
      {mostrarSiempre(data.condicion_iva_cliente, "Cond. IVA", styles)}
      <Text style={styles.labelCliente}>
        <Text style={styles.labelBold}>Cond. Venta: </Text>
        <Text style={styles.labelNormal}>Contado</Text>
      </Text>
    </View>
    <View style={styles.clienteDerecha}>
      {mostrarSiempre(data.cuit, "CUIT", styles)}
      {mostrarSiempre(data.localidad, "Localidad", styles)}
      {mostrarSiempre(data.provincia, "Provincia", styles)}
      {mostrarSiempre(data.telefono_cliente, "Teléfono", styles)}
    </View>
  </View>
);

/**
 * Genera la tabla de items común para todas las plantillas
 * @param {Array} itemsPagina - Items a mostrar en esta página
 * @param {Object} styles - Estilos del componente
 * @param {Function} formatearMoneda - Función para formatear moneda
 * @param {Function} formatearDescuentosVisual - Función para formatear descuentos
 * @param {number} netoTraspasado - Neto traspasado de página anterior (opcional)
 * @param {number} netoPagina - Neto de la página actual para traspaso (opcional)
 * @param {boolean} mostrarTraspasoSiguiente - Si debe mostrar traspaso a página siguiente
 * @returns {JSX.Element} Tabla de items con traspasos
 */
export const generarTablaItemsComun = (
  itemsPagina, 
  styles, 
  formatearMoneda, 
  formatearDescuentosVisual,
  netoTraspasado = null,
  netoPagina = null,
  mostrarTraspasoSiguiente = false
) => (
  <View style={styles.itemsContainer}>
    {/* Encabezados con 9 columnas */}
    <View style={styles.itemsHeader}>
      <Text style={styles.headerCodigo}>Código</Text>
      <Text style={styles.headerDescripcion}>Descripción</Text>
      <Text style={styles.headerCantidad}>Cantidad</Text>
      <Text style={styles.headerPrecio}>P. Unitario</Text>
      <Text style={styles.headerDescuento}>Desc. %</Text>
      <Text style={styles.headerPrecioBonificado}>P. Unit. Bonif.</Text>
      <Text style={styles.headerAlicuota}>Alicuota</Text>
      <Text style={styles.headerIVA}>IVA</Text>
      <Text style={styles.headerImporte}>Importe</Text>
    </View>

    {/* Fila de traspasado de página anterior (si existe) */}
    {netoTraspasado !== null && generarFilaTraspaso(netoTraspasado, styles, formatearMoneda, true)}

    {/* Datos con 9 columnas */}
    {itemsPagina && itemsPagina.length > 0 ? (
      itemsPagina.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={styles.colCodigo}>{item.codigo || ""}</Text>
          <Text style={styles.colDescripcion}>{item.vdi_detalle1 || ""}</Text>
          <Text style={styles.colCantidad}>{item.vdi_cantidad || ""}</Text>
          <Text style={styles.colPrecio}>{formatearMoneda(item.precio_unitario_sin_iva)}</Text>
          <Text style={styles.colDescuento}>
            {formatearDescuentosVisual(item.vdi_bonifica, item.ven_descu1, item.ven_descu2)}
          </Text>
          <Text style={styles.colPrecioBonificado}>{formatearMoneda(item.precio_unitario_bonif_desc_sin_iva)}</Text>
          <Text style={styles.colAlicuota}>{item.ali_porce ? `${item.ali_porce}%` : "0%"}</Text>
          <Text style={styles.colIVA}>{formatearMoneda(item.iva_monto)}</Text>
          <Text style={styles.colImporte}>{formatearMoneda(item.total_item)}</Text>
        </View>
      ))
    ) : null}

    {/* Fila de traspaso a página siguiente (si corresponde) */}
    {mostrarTraspasoSiguiente && netoPagina !== null && generarFilaTraspaso(netoPagina, styles, formatearMoneda, false)}
  </View>
);

/**
 * Genera el pie fiscal común para todas las plantillas
 * @param {Object} data - Datos del comprobante
 * @param {Object} styles - Estilos del componente
 * @returns {JSX.Element} Componente del pie fiscal
 */
export const generarPieFiscalComun = (data, styles) => (
  <View style={styles.pieFiscal}>
    {/* UNA SOLA FILA HORIZONTAL: QR (60x60) + Logo ARCA + Disclaimer AFIP + CAE */}
    <View style={styles.pieFilaHorizontal}>
      {/* QR Placeholder (60x60) */}
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrTexto}>[QR CODE]</Text>
      </View>
      
      {/* Logo ARCA */}
      <View style={styles.arcaPlaceholder}>
        <Image 
          src="http://localhost:8000/api/productos/servir-logo-arca/"
          style={{
            width: 60,
            height: 50,
            objectFit: "contain",
            resizeMode: "contain"
          }}
        />
      </View>
      
      {/* Disclaimer AFIP */}
      <View style={styles.textosAfipContainer}>
        <Text style={styles.arcaAutorizado}>Comprobante Autorizado</Text>
        <Text style={styles.leyendaAfip}>
          Esta Administración Federal no se responsabiliza por los datos ingresados en detalle de la operación
        </Text>
      </View>
      
      {/* CAE y CAE Vencimiento (a la derecha del todo) */}
      <View style={styles.pieDerecha}>
        <View style={styles.campoAfip}>
          <Text style={styles.labelAfip}>CAE:</Text>
          <Text style={styles.valorAfip}>{data.ven_cae || ''}</Text>
        </View>
        <View style={styles.campoAfip}>
          <Text style={styles.labelAfip}>CAE Vencimiento:</Text>
          <Text style={styles.valorAfip}>{data.ven_caevencimiento || ''}</Text>
        </View>
      </View>
    </View>
  </View>
);

/**
 * Genera una página completa de comprobante con configuración flexible
 * @param {Object} config - Configuración específica del tipo de comprobante
 * @param {Object} data - Datos del comprobante
 * @param {Object} ferreteriaConfig - Configuración de la empresa
 * @param {Array} itemsPagina - Items a mostrar en esta página
 * @param {Object} styles - Estilos del componente
 * @param {boolean} mostrarTotales - Si debe mostrar los totales (solo en la última página)
 * @param {number} netoTraspasado - Neto traspasado de página anterior (opcional)
 * @param {number} netoPagina - Neto de la página actual para traspaso (opcional)
 * @param {boolean} mostrarTraspasoSiguiente - Si debe mostrar traspaso a página siguiente
 * @param {string} tipoComprobante - Tipo de comprobante ('A', 'B', 'C')
 * @returns {JSX.Element} Página completa del comprobante
 */
export const generarPaginaComprobante = (
  config,
  data, 
  ferreteriaConfig, 
  itemsPagina, 
  styles, 
  mostrarTotales = false,
  netoTraspasado = null,
  netoPagina = null,
  mostrarTraspasoSiguiente = false,
  tipoComprobante = 'A'
) => {
  // Funciones auxiliares que pueden ser sobrescritas por config
  const {
    mostrarSiempre = crearComponenteMostrarSiempre,
    formatearHoraFn = formatearHora,
    mapearSituacionFiscalFn = mapearSituacionFiscal,
    formatearMonedaFn = formatearMoneda,
    formatearDescuentosVisualFn = formatearDescuentosVisual,
    generarTablaItems = generarTablaItemsComun,
    generarTotales = null,
    generarHeader = generarHeaderComun,
    generarInfoCliente = generarInfoClienteComun,
    generarPieFiscal = generarPieFiscalComun
  } = config;

  return (
    <Page size="A4" style={styles.page}>
      {generarHeader(data, ferreteriaConfig, styles, mostrarSiempre, formatearHoraFn, mapearSituacionFiscalFn)}
      {generarInfoCliente(data, styles, mostrarSiempre)}
      
      {generarTablaItems(
        itemsPagina, 
        styles, 
        formatearMonedaFn, 
        formatearDescuentosVisualFn,
        netoTraspasado,
        netoPagina,
        mostrarTraspasoSiguiente
      )}
      
      {/* Totales - SOLO EN LA ÚLTIMA PÁGINA */}
      {mostrarTotales && generarTotales && generarTotales(data, styles, formatearMonedaFn)}
      
      {/* Pie fiscal */}
      {generarPieFiscal(data, styles)}
    </Page>
  );
};

/**
 * Genera fila de traspaso para tabla de items
 * @param {number} neto - Neto a mostrar
 * @param {Object} styles - Estilos del componente
 * @param {Function} formatearMoneda - Función para formatear moneda
 * @param {boolean} esTraspasado - Si es "Traspasado de página anterior" (true) o "Traspaso página siguiente" (false)
 * @returns {JSX.Element} Fila de traspaso
 */
export const generarFilaTraspaso = (neto, styles, formatearMoneda, esTraspasado = false) => {
  const texto = esTraspasado 
    ? `Neto Acumulado de Pagina/s Anterior/es $${formatearMoneda(neto)}`
    : `Neto Acumulado a Pagina Siguiente $${formatearMoneda(neto)}`;
  
  console.log('Generando fila de traspaso:', { neto, texto, esTraspasado });
  
  return (
    <View style={styles.filaTraspaso}>
      <Text style={styles.colTraspaso}>{texto}</Text>
    </View>
  );
};

// Otros helpers visuales compartidos pueden agregarse aquí 

/**
 * Calcula el neto de página según el tipo de comprobante
 * @param {Array} itemsPagina - Items de la página actual
 * @param {string} tipoComprobante - Tipo de comprobante ('A', 'B', 'C')
 * @returns {number} Neto de la página
 */
export const calcularNetoPagina = (itemsPagina, tipoComprobante) => {
  if (!itemsPagina || itemsPagina.length === 0) return 0;
  
  return itemsPagina.reduce((total, item) => {
    if (tipoComprobante === 'A') {
      // Factura A: neto sin IVA
      const precioSinIva = item.precio_unitario_sin_iva || 0;
      const cantidad = item.vdi_cantidad || 0;
      return total + (precioSinIva * cantidad);
    } else {
      // Factura B y C: neto con IVA incluido
      const totalItem = item.total_item || 0;
      return total + totalItem;
    }
  }, 0);
};

/**
 * Calcula los traspasos para una página
 * @param {Array} itemsPagina - Items de la página actual
 * @param {string} tipoComprobante - Tipo de comprobante ('A', 'B', 'C')
 * @param {number} netoAnterior - Neto acumulado de páginas anteriores
 * @returns {number} Neto acumulado
 */
export const calcularTraspasos = (itemsPagina, tipoComprobante, netoAnterior = 0) => {
  const netoPagina = calcularNetoPagina(itemsPagina, tipoComprobante);
  return netoAnterior + netoPagina;
};

/**
 * Genera tabla de totales con formato de columnas y filas
 * @param {Object} data - Datos del comprobante
 * @param {Object} styles - Estilos del componente
 * @param {Function} formatearMoneda - Función para formatear moneda
 * @param {Array} configTotales - Configuración de campos a mostrar
 * @returns {JSX.Element} Tabla de totales
 */
export const generarTablaTotales = (data, styles, formatearMoneda, configTotales) => {
  return (
    <View style={styles.totalesContainer}>
      {/* Encabezados de columnas */}
      <View style={styles.totalesHeader}>
        {configTotales.map((campo, index) => (
          <Text key={index} style={styles.totalesHeaderCol}>{campo.label}</Text>
        ))}
      </View>
      
      {/* Fila de valores */}
      <View style={styles.totalesRow}>
        {configTotales.map((campo, index) => {
          let valor = 0;
          
          // Calcular valor según el tipo de campo
          switch (campo.tipo) {
            case 'neto_gravado':
              valor = data.ven_impneto || 0;
              break;
            case 'descuento1':
              valor = data.ven_descu1 ? (data.ven_impneto || 0) * (data.ven_descu1 / 100) : 0;
              break;
            case 'descuento2':
              valor = data.ven_descu2 ? (data.ven_impneto || 0) * (data.ven_descu2 / 100) : 0;
              break;
            case 'iva_contenido':
              valor = data.iva_global || 0;
              break;
            case 'total':
              valor = data.ven_total || data.total || 0;
              break;
            default:
              valor = data[campo.campo] || 0;
          }
          
          return (
            <Text key={index} style={styles.totalesCol}>
              {formatearMoneda(valor)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}; 