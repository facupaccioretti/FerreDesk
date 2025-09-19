import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer"

import { 
  CANTIDAD_MAXIMA_ITEMS, 
  dividirItemsEnPaginas,
  generarPaginaComprobante,
  calcularNetoPagina,
  calcularTraspasos,
  generarFilaTraspaso,
  generarTablaTotales,
  convertirBytesABase64,
  esMonotributistaPorDenominacion
} from "../helpers"

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
    flex: 2.5,
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
    flex: 0.95, // Reducido de 1 a 0.95 (5% menos espaciosa)
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colDescripcion: {
    flex: 2.9, // Aumentado para aprovechar el espacio de la columna IVA eliminada
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "left",
    justifyContent: "center", // Centrar verticalmente
  },
  colCantidad: {
    flex: 0.95, // Reducido de 1 a 0.95 (5% menos espaciosa)
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colPrecio: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  colDescuento: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colPrecioBonificado: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "right",
    justifyContent: "center", // Centrar verticalmente
  },
  colAlicuota: {
    flex: 1,
    padding: 1, // Reducido de 2 a 1
    fontSize: 6.5, // Aumentado de 6 a 6.5
    textAlign: "center",
    justifyContent: "center", // Centrar verticalmente
  },
  colImporte: {
    flex: 1,
    padding: 1, 
    fontSize: 6.5, // Aumentado de 6 a 6.5
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

// Pie fiscal específico para Factura A con leyenda adicional para monotributistas
const generarPieFiscalA = (data, styles, numeroPagina = 1, totalPaginas = 1) => {
  const qrBase64 = data.ven_qr ? convertirBytesABase64(data.ven_qr) : null;
  return (
    <View style={styles.pieFiscal}>
      <View style={styles.pieFilaHorizontal}>
    {qrBase64 && (
      <Image 
        src={`data:image/png;base64,${qrBase64}`}
        style={styles.qrPlaceholder}
      />
    )}
        <View style={styles.arcaPlaceholder}>
          <Image 
            src={`/api/productos/servir-logo-arca/?v=${Date.now()}`}
            style={{ width: 60, height: 50, objectFit: "contain", resizeMode: "contain" }}
          />
        </View>
        <View style={styles.textosAfipContainer}>
          <Text style={styles.arcaAutorizado}>Comprobante Autorizado</Text>
          <Text style={styles.leyendaAfip}>
            Esta Administración Federal no se responsabiliza por los datos ingresados en detalle de la operación
          </Text>
                     {esMonotributistaPorDenominacion(data.condicion_iva_cliente) && (
             <Text style={[styles.leyendaAfip, { textAlign: 'left' }]}>
               El crédito fiscal discriminado en el presente comprobante, sólo podrá ser computado a efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley Nº 27.618
             </Text>
           )}
        </View>
        <View style={styles.pieDerecha}>
          <View style={styles.campoAfip}>
            <Text style={styles.labelAfip}>CAE:</Text>
            <Text style={styles.valorAfip}>{data.ven_cae || ''}</Text>
          </View>
          <View style={styles.campoAfip}>
            <Text style={styles.labelAfip}>CAE Vencimiento:</Text>
            <Text style={styles.valorAfip}>{data.ven_caevencimiento || ''}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, textAlign: 'right' }}>Página {numeroPagina} de {totalPaginas}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Configuración específica para Factura A
const configFacturaA = {
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
      {/* Encabezados con 8 columnas */}
      <View style={styles.itemsHeader}>
        <Text style={styles.headerCodigo}>Código</Text>
        <Text style={styles.headerDescripcion}>Descripción</Text>
        <Text style={styles.headerCantidad}>Cantidad</Text>
        <Text style={styles.headerPrecio}>P. Unitario</Text>
        <Text style={styles.headerDescuento}>Desc. %</Text>
        <Text style={styles.headerPrecioBonificado}>P. Unit. Bonif.</Text>
        <Text style={styles.headerAlicuota}>Alicuota</Text>
        <Text style={styles.headerImporte}>Importe</Text>
      </View>

      {/* Fila de traspasado de página anterior (si existe) */}
      {netoTraspasado !== null && generarFilaTraspaso(netoTraspasado, styles, formatearMoneda, true)}

      {/* Datos con 8 columnas */}
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
            <Text style={styles.colImporte}>{formatearMoneda(item.total_item)}</Text>
          </View>
        ))
      ) : null}

      {/* Fila de traspaso a página siguiente (si corresponde) */}
      {mostrarTraspasoSiguiente && netoPagina !== null && generarFilaTraspaso(netoPagina, styles, formatearMoneda, false)}
    </View>
  ),

  generarTotales: (data, styles, formatearMoneda) => {
    // Configuración de campos para Factura A (sin descuentos)
    const configTotalesA = [
      { label: "Neto Gravado", tipo: "neto_gravado" },
      { label: "IVA Contenido", tipo: "iva_contenido" },
      { label: "Total", tipo: "total" }
    ];
    
    return generarTablaTotales(data, styles, formatearMoneda, configTotalesA);
  },
  generarPieFiscal: generarPieFiscalA
};

const PlantillaFacturaAPDF = ({ data, ferreteriaConfig }) => {

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
        const netoPagina = calcularNetoPagina(itemsPagina, 'A');
        
        // Calcular neto traspasado de páginas anteriores
        let netoTraspasado = null;
        if (indexPagina > 0) {
          let netoAcumulado = 0;
          // Sumar netos de todas las páginas anteriores
          for (let i = 0; i < indexPagina; i++) {
            const paginaAnterior = paginasItems[i];
            netoAcumulado = calcularTraspasos(paginaAnterior, 'A', netoAcumulado);
          }
          netoTraspasado = netoAcumulado;
        }
        
        // Calcular neto acumulado para traspaso a página siguiente
        const netoAcumuladoParaSiguiente = netoTraspasado !== null 
          ? netoTraspasado + netoPagina 
          : netoPagina;
        
        // Determinar si mostrar traspaso a página siguiente
        const mostrarTraspasoSiguiente = !esUltimaPagina;
        
        
        
        return generarPaginaComprobante(
          configFacturaA, //  Configuración específica de Factura A
          data,
          ferreteriaConfig,
          itemsPagina,
          styles,
          esUltimaPagina, // Solo mostrar totales en la última página
          netoTraspasado, // Neto traspasado de página anterior
          netoAcumuladoParaSiguiente, // Neto acumulado para traspaso a página siguiente
          mostrarTraspasoSiguiente, // Si mostrar traspaso a página siguiente
          'A', // Tipo de comprobante
          indexPagina + 1, // Número de página actual
          paginasItems.length // Total de páginas
        );
      })}
    </Document>
  );
};

export default PlantillaFacturaAPDF;
