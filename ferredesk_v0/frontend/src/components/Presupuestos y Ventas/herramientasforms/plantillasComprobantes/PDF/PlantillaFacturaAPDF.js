import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"
import { useFerreteriaAPI } from "../../../../../utils/useFerreteriaAPI"
import { 
  CANTIDAD_MAXIMA_ITEMS, 
  dividirItemsEnPaginas,
  generarPaginaComprobante,
  calcularNetoPagina,
  calcularTraspasos,
  generarFilaTraspaso,
  generarTablaTotales
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
    marginBottom: 8,
    position: "relative",
  },
  seccionIzquierda: {
    flex: 1,
    alignItems: "center", // Centrar todo el contenido horizontalmente
    justifyContent: "flex-end", // Alinear todo hacia abajo
    paddingRight: 20, // Espacio para el recuadro flotante
    minHeight: 80, // Altura mínima para distribuir el contenido
    paddingBottom: 4, // Pequeño margen del pie del header
  },
  infoEmpresaCentrada: {
    alignItems: "center", // Centrar horizontalmente
    justifyContent: "center", // Centrar verticalmente
    marginBottom: 8, // Espacio entre la información principal y "Responsable Inscripto"
  },
  logoEmpresa: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginBottom: 4,
  },
  logoTexto: {
    fontSize: 4,
    textAlign: "center",
  },
  empresaNombre: {
    fontSize: 12,
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
    marginBottom: 2,
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
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 6,
    minHeight: 60, // Altura mínima para líneas completas
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
  
  // Pie fiscal - Simplificado
  pieFiscal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    padding: 4,
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    minHeight: 60, // 30% más grande (antes 35)
  },
  pieIzquierda: {
    flex: 1,
    alignItems: "center",
    paddingRight: 6,
  },
  placeholdersContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    gap: 10,
  },
  qrPlaceholder: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  qrTexto: {
    fontSize: 4,
    textAlign: "center",
  },
  arcaPlaceholder: {
    width: 40,
    height: 30,
    borderWidth: 1,
    borderColor: "#000",
    borderStyle: "solid",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  arcaTexto: {
    fontSize: 5,
    textAlign: "center",
  },
  arcaAutorizado: {
    fontSize: 6,
    fontWeight: "bold",
    marginBottom: 1,
    textAlign: "center",
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
    flex: 1,
    alignItems: "flex-end",
    paddingLeft: 6,
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
  ),

  generarTotales: (data, styles, formatearMoneda) => {
    // Configuración de campos para Factura A (sin descuentos)
    const configTotalesA = [
      { label: "Neto Gravado", tipo: "neto_gravado" },
      { label: "IVA Contenido", tipo: "iva_contenido" },
      { label: "Total", tipo: "total" }
    ];
    
    return generarTablaTotales(data, styles, formatearMoneda, configTotalesA);
  }
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
          configFacturaA, // ✅ Configuración específica de Factura A
          data,
          ferreteriaConfig,
          itemsPagina,
          styles,
          esUltimaPagina, // Solo mostrar totales en la última página
          netoTraspasado, // Neto traspasado de página anterior
          netoAcumuladoParaSiguiente, // Neto acumulado para traspaso a página siguiente
          mostrarTraspasoSiguiente, // Si mostrar traspaso a página siguiente
          'A' // Tipo de comprobante
        );
      })}
    </Document>
  );
};

export default PlantillaFacturaAPDF;
