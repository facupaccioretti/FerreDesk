import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

import { 
  CANTIDAD_MAXIMA_ITEMS, 
  dividirItemsEnPaginas,
  generarPaginaComprobante,
  calcularNetoPagina,
  calcularTraspasos,
  generarFilaTraspaso,
  generarTablaTotales,
  mapearTipoComprobante
} from "../helpers"
import { Image } from "@react-pdf/renderer";

// Registrar fuentes
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica", fontWeight: "normal" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
})

// Estilos para el PDF, diseñados para coincidir con el esquema de 2 secciones.
const styles = StyleSheet.create({
  page: {
    padding: 8, // Reducido de 15 a 8 para acercar a los bordes
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  
  // HEADER: Contenedor principal con posición relativa para elementos flotantes.
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 8,
    marginBottom: 4, // Reducido para achicar el largo
    position: "relative",
  },
  seccionIzquierda: {
    flex: 1,
    flexDirection: "row", // Disposición horizontal
    alignItems: "flex-start", // Alinear al tope
    justifyContent: "flex-start", // Alinear a la izquierda
    paddingRight: 20, // Espacio para el recuadro flotante
    minHeight: 60, // Reducido de 80 a 60
    paddingTop: 4, // Reducido
    paddingBottom: 4, // Reducido
  },
  infoEmpresaCentrada: {
    flex: 1, // Ocupar el espacio restante
    alignItems: "center", // Centrar horizontalmente
    justifyContent: "flex-start", // Alinear hacia arriba
    marginLeft: 8, // Espacio entre logo y texto
  },
  logoEmpresa: {
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0, // Sin margen inferior
  },
  logoTexto: {
    fontSize: 4,
    textAlign: "center",
  },
  logoImagen: {
    width: 70,
    height: 70,
    objectFit: "contain",
    resizeMode: "contain",
  },
  empresaNombre: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
  },
  empresaInfo: {
    fontSize: 8,
    marginBottom: 1,
  },
  situacionFiscal: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 0,
    width: "100%",
    alignSelf: "center",
  },
  situacionFiscalContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  
  // LÍNEA DIVISORIA CENTRAL (cortada para no superponerse con el recuadro)
  lineaDivisoriaCentral: {
    width: 1,
    backgroundColor: 'black',
    position: 'absolute',
    left: '50%',
    top: 40, // Empieza después del recuadro (altura del recuadro = 40px)
    bottom: 0,
    zIndex: 1,
  },
  
  // RECUADRO DE LETRA FLOTANTE
  recuadroLetraFlotante: {
    position: 'absolute',
    left: '50%',
    top: 0,
    marginLeft: -20, // Mitad del ancho del recuadro (40/2) para centrarlo perfectamente
    width: 40,
    height: 40,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Valor alto para asegurar que esté por encima de todo
  },
  letraGrande: {
    fontSize: 24,
    fontWeight: "bold",
  },
  codigoOriginal: {
    fontSize: 6,
    fontWeight: "bold",
  },
  
  // SECCIÓN DERECHA
  seccionDerecha: {
    flex: 1,
    padding: 6,
    paddingLeft: 20, // Espacio para el recuadro flotante
  },
  facturaInfoTop: {
    paddingBottom: 2,
  },
  facturaInfoBottom: {
    paddingTop: 2,
  },
  facturaTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  numeroComprobante: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  fechaEmision: {
    fontSize: 8,
    textAlign: "center",
    marginBottom: 1,
  },
  tituloComprobante: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },

  lineaDivisoria: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    marginVertical: 2,
  },
  
  // Información del cliente - Estructura corregida
  infoCliente: {
    flexDirection: "row",
    marginBottom: 5, // Reducido
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 4, // Reducido
    minHeight: 40, // Reducido de 60 a 40
  },
  clienteIzquierda: {
    flex: 1,
    paddingRight: 6,
    // Eliminé la línea vertical divisoria
    justifyContent: "flex-start", // Alinear a la izquierda
    alignItems: "flex-start", // Alinear a la izquierda
  },
  clienteDerecha: {
    flex: 1,
    paddingLeft: 6,
    justifyContent: "flex-start", // Alinear a la izquierda
    alignItems: "flex-start", // Alinear a la izquierda
  },
  labelCliente: {
    fontSize: 7,
    marginBottom: 1,
    textAlign: "left", // Alinear a la izquierda
  },
  labelBold: {
    fontWeight: "bold", // Solo el label en negrita
  },
  labelNormal: {
    fontWeight: "normal", // El valor en normal
  },
  
  // ITEMS - ESTRUCTURA CORREGIDA con líneas completas
  itemsContainer: {
    marginBottom: 10,
    pageBreakInside: "avoid", // Evitar cortar la tabla en medio
    pageBreakAfter: "auto", // Permitir salto de página después si es necesario
    // Quitado el borde alrededor de la tabla
  },
  itemsHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    minHeight: 12, // Reducido de 25 a 12 para hacer más compacto
  },
  headerCodigo: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerDescripcion: {
    flex: 2,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerCantidad: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerPrecio: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerDescuento: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerPrecioBonificado: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerAlicuota: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerIVA: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  headerImporte: {
    flex: 1,
    padding: 0, // Eliminado completamente el padding
    fontSize: 7, // Aumentado de 6 a 7
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "flex-start", // Alinear al tope en lugar de centrar
  },
  itemRow: {
    flexDirection: "row",
    minHeight: 18, // Reducido para eliminar espacio extra
    // Sin separación visual entre filas
  },
  colCodigo: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colDescripcion: {
    flex: 2,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "left",
    justifyContent: "center", // Centrar verticalmente
  },
  colCantidad: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colPrecio: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  colDescuento: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colPrecioBonificado: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  colAlicuota: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colIVA: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 8, // Aumentado 35% de 6 a 8
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  colImporte: {
    flex: 1,
    padding: 1, 
    fontSize: 8, 
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  
  // Totales - Tabla con columnas y filas
  totalesContainer: {
    position: "absolute",
    bottom: 75, 
    left: 8,
    right: 8,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    backgroundColor: "#f8f9fa",
    minHeight: 40, 
  },
  totalesHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderBottomStyle: "solid",
    backgroundColor: "#e9ecef",
  },
  totalesHeaderCol: {
    flex: 1,
    padding: 4,
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderRightStyle: "solid",
  },
  totalesRow: {
    flexDirection: "row",
  },
  totalesCol: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderRightStyle: "solid",
  },
  totalesLabel: {
    flex: 1,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalesValor: {
    flex: 1,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
  },
  
  // Pie fiscal - UNA SOLA FILA HORIZONTAL
  pieFiscal: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 4,
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    minHeight: 60,
  },
  // Fila horizontal: QR + Logo ARCA + Textos AFIP
  pieFilaHorizontal: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  // QR Placeholder (60x60)
  qrPlaceholder: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  qrTexto: {
    fontSize: 6,
    textAlign: "center",
  },
  // Logo ARCA
  arcaPlaceholder: {
    width: 60,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  arcaTexto: {
    fontSize: 5,
    textAlign: "center",
  },
  // Contenedor de disclaimer AFIP
  textosAfipContainer: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 8,
  },

  arcaAutorizado: {
    fontSize: 6,
    fontWeight: "bold",
    marginBottom: 1,
    textAlign: "left",
  },
  pieCentro: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  leyendaAfip: {
    fontSize: 6,
    textAlign: "center",
    marginBottom: 2,
  },
  infoBancaria: {
    fontSize: 5,
    textAlign: "center",
    fontWeight: "bold",
  },
  pieDerecha: {
    alignItems: "flex-end",
    paddingLeft: 6,
    minWidth: 120,
  },
  campoAfip: {
    marginBottom: 3,
  },
  labelAfip: {
    fontSize: 6,
    fontWeight: "bold",
    textAlign: "right",
  },
  valorAfip: {
    fontSize: 6,
    textAlign: "right",
  },
  
  // Estilos para filas de traspaso
  filaTraspaso: {
    flexDirection: "row",
    minHeight: 18,
    backgroundColor: "#f8f9fa",
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderTopStyle: "solid",
  },
  colTraspaso: {
    flex: 9, // Ocupa todas las columnas
    padding: 2,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    justifyContent: "center",
    color: "#000",
  },
})

// Sobrescribir la función del header para la plantilla C
const generarHeaderC = (data, ferreteriaConfig, styles, mostrarSiempre, formatearHora, mapearSituacionFiscal) => {
  const comprobante = data.comprobante || {};
  const esComprobanteInformal = (comprobante.tipo === "presupuesto" || comprobante.tipo === "factura_interna" || comprobante.letra === "P" || comprobante.letra === "I");

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
          {/* Situación fiscal centrada al pie del bloque empresa */}
          <View style={styles.situacionFiscalContainer}>
            <Text style={styles.situacionFiscal}>
              {ferreteriaConfig.situacion_iva ? mapearSituacionFiscal(ferreteriaConfig.situacion_iva) : ""}
            </Text>
          </View>
        </View>
      </View>
      {/* LÍNEA DIVISORIA CENTRAL */}
      <View style={styles.lineaDivisoriaCentral} />
      {/* RECUADRO DE LETRA FLOTANTE SOBRESCRITO */}
      <View style={styles.recuadroLetraFlotante}>
        {data.comprobante?.letra && (
          <Text style={styles.letraGrande}>{data.comprobante.letra}</Text>
        )}
        {data.comprobante?.codigo_afip && (
          <Text style={styles.codigoOriginal}>CÓD. {data.comprobante.codigo_afip}</Text>
        )}
        {/* Mostrar 'ORIGINAL' solo si es comprobante formal */}
        {!esComprobanteInformal && (
          <Text style={styles.codigoOriginal}>ORIGINAL</Text>
        )}
      </View>
      {/* SECCIÓN DERECHA */}
      <View style={styles.seccionDerecha}>
        <View style={styles.facturaInfoTop}>
          <Text style={styles.facturaTitle}>{mapearTipoComprobante(data.comprobante)}</Text>
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
        {/* Etiqueta de documento no válido centrada y más baja en la sección derecha */}
        {esComprobanteInformal && (
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 8, textAlign: 'center' }}>
              Documento no válido como comprobante
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Usar la función común del pie fiscal que ya maneja el QR
// La plantilla C no necesita una implementación específica del pie fiscal

// Configuración específica para Factura C
const configFacturaC = {
  generarHeader: generarHeaderC,
  generarTablaItems: (
    itemsPagina,
    styles,
    formatearMoneda,
    formatearDescuentosVisual,
    netoTraspasado = null,
    netoPagina = null,
    mostrarTraspasoSiguiente = false
  ) => (
    <View style={styles.itemsContainer}>
      <View style={styles.itemsHeader}>
        <Text style={styles.headerCodigo}>Código</Text>
        <Text style={styles.headerDescripcion}>Descripción</Text>
        <Text style={styles.headerCantidad}>Cantidad</Text>
        <Text style={styles.headerPrecio}>P. Unitario</Text>
        <Text style={styles.headerDescuento}>Desc. %</Text>
        <Text style={styles.headerPrecioBonificado}>P. Unit. Bonif.</Text>
        <Text style={styles.headerImporte}>Importe</Text>
      </View>
      {netoTraspasado !== null && generarFilaTraspaso(netoTraspasado, styles, formatearMoneda, true)}
      {itemsPagina && itemsPagina.length > 0 ? (
        itemsPagina.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.colCodigo}>{item.codigo || ""}</Text>
            <Text style={styles.colDescripcion}>{item.vdi_detalle1 || ""}</Text>
            <Text style={styles.colCantidad}>{item.vdi_cantidad || ""}</Text>
            <Text style={styles.colPrecio}>{formatearMoneda(item.vdi_precio_unitario_final)}</Text>
            <Text style={styles.colDescuento}>{formatearDescuentosVisual(item.vdi_bonifica, item.ven_descu1, item.ven_descu2, item.ven_descu3)}</Text>
            <Text style={styles.colPrecioBonificado}>{formatearMoneda(item.precio_unitario_bonificado_con_iva)}</Text>
            <Text style={styles.colImporte}>{formatearMoneda(item.total_item)}</Text>
          </View>
        ))
      ) : null}
      {mostrarTraspasoSiguiente && netoPagina !== null && generarFilaTraspaso(netoPagina, styles, formatearMoneda, false)}
    </View>
  ),
  // Ajuste de la tabla de totales: solo Subtotal y Total (finales)
  generarTotales: (data, styles, formatearMoneda) => {
    const configTotalesC = [
      { label: "Subtotal", tipo: "ven_total" },
      { label: "Total", tipo: "ven_total" }
    ];
    return generarTablaTotales(data, styles, formatearMoneda, configTotalesC);
  },
  // Ajuste del bloque de cliente: solo los campos mínimos
  generarInfoCliente: (data, styles, mostrarSiempre) => (
    <View style={styles.infoCliente}>
      <View style={styles.clienteIzquierda}>
        {mostrarSiempre(data.cliente, "Razón Social", styles)}
        {mostrarSiempre(data.domicilio, "Domicilio", styles)}
        {mostrarSiempre(data.cuit, "DNI/CUIT", styles)}
        <Text style={styles.labelCliente}>
          <Text style={styles.labelBold}>Condición de venta: </Text>
          <Text style={styles.labelNormal}>Contado</Text>
        </Text>
      </View>
    </View>
  )
  // No sobrescribir generarPieFiscal para usar la función común que ya maneja el QR
};

const PlantillaFacturaCPDF = ({ data, ferreteriaConfig }) => {

  // Si no hay configuración, no renderizar nada o un mensaje de error
  if (!ferreteriaConfig) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text>Error: Faltan los datos de configuración de la empresa.</Text>
        </Page>
      </Document>
    );
  }

  // Dividir items en páginas
  const paginasItems = dividirItemsEnPaginas(data.items || [], CANTIDAD_MAXIMA_ITEMS);




  return (
    <Document>
      {paginasItems.map((itemsPagina, indexPagina) => {
        const esUltimaPagina = indexPagina === paginasItems.length - 1;
        
        // Calcular neto de la página actual
        const netoPagina = calcularNetoPagina(itemsPagina, 'C');
        
        // Calcular neto traspasado de páginas anteriores
        let netoTraspasado = null;
        if (indexPagina > 0) {
          let netoAcumulado = 0;
          // Sumar netos de todas las páginas anteriores
          for (let i = 0; i < indexPagina; i++) {
            const paginaAnterior = paginasItems[i];
            netoAcumulado = calcularTraspasos(paginaAnterior, 'C', netoAcumulado);
          }
          netoTraspasado = netoAcumulado;
        }
        
        // Calcular neto acumulado para traspaso a página siguiente
        const netoAcumuladoParaSiguiente = netoTraspasado !== null 
          ? netoTraspasado + netoPagina 
          : netoPagina;
        
        // Determinar si mostrar traspaso a página siguiente
        const mostrarTraspasoSiguiente = !esUltimaPagina;
        
        // Logs de depuración
        console.log(`Página ${indexPagina + 1}:`, {
          itemsEnPagina: itemsPagina.length,
          netoPagina,
          netoTraspasado,
          netoAcumuladoParaSiguiente,
          mostrarTraspasoSiguiente,
          esUltimaPagina
        });
        
        return generarPaginaComprobante(
          configFacturaC, //  Configuración específica de Factura A
          data,
          ferreteriaConfig,
          itemsPagina,
          styles,
          esUltimaPagina, // Solo mostrar totales en la última página
          netoTraspasado, // Neto traspasado de página anterior
          netoAcumuladoParaSiguiente, // Neto acumulado para traspaso a página siguiente
          mostrarTraspasoSiguiente, // Si mostrar traspaso a página siguiente
          'C', // Tipo de comprobante
          indexPagina + 1, // Número de página actual
          paginasItems.length // Total de páginas
        );
      })}
    </Document>
  );
};

export default PlantillaFacturaCPDF; 
