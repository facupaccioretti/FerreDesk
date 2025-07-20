import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fuentes (usando fuentes del sistema por defecto)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica', fontWeight: 'normal' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ]
});

// Estilos para PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  
  // Título principal
  titulo: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  
  // Información del comprobante
  infoComprobante: {
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'solid',
    padding: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  codigoOriginal: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  letraComprobante: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 5,
  },
  numeroComprobante: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  fechaEmision: {
    fontSize: 9,
  },
  
  // Información emisor/receptor
  seccionContacto: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  emisor: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    padding: 10,
    marginRight: 5,
  },
  receptor: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    padding: 10,
    marginLeft: 5,
  },
  subtitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  campo: {
    marginBottom: 3,
    fontSize: 9,
  },
  
  // Tabla de items
  tabla: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
    fontSize: 9,
  },
  rowAlternate: {
    backgroundColor: '#f9f9f9',
  },
  colCodigo: { width: '15%', padding: 5, textAlign: 'center' },
  colDescripcion: { width: '40%', padding: 5 },
  colCantidad: { width: '10%', padding: 5, textAlign: 'center' },
  colPrecio: { width: '15%', padding: 5, textAlign: 'right' },
  colImporte: { width: '20%', padding: 5, textAlign: 'right' },
  
  // Totales
  totales: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    marginBottom: 20,
  },
  filaTotal: {
    flexDirection: 'row',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
  },
  filaTotalFinal: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    fontSize: 16,
  },
  labelTotal: { width: '70%', paddingRight: 10 },
  valorTotal: { width: '30%', textAlign: 'right' },
  
  // Pie de comprobante
  pieComprobante: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'solid',
    padding: 10,
  },
  tituloPie: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  campoPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    fontSize: 9,
  },
});

const PlantillaFacturaCPDF = ({ data }) => {
  const formatearMoneda = (valor) => {
    if (!valor) return '$ 0,00';
    return `$ ${parseFloat(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Título */}
        <Text style={styles.titulo}>FACTURA</Text>
        
        {/* Información del comprobante */}
        <View style={styles.infoComprobante}>
          <Text style={styles.codigoOriginal}>CÓD. 11 ORIGINAL</Text>
          <Text style={styles.letraComprobante}>{data.comprobante?.letra || 'C'}</Text>
          <Text style={styles.numeroComprobante}>{data.numero_formateado || '0000-00000001'}</Text>
          <Text style={styles.fechaEmision}>Fecha de emisión: {data.fecha || ''}</Text>
        </View>
        
        {/* Emisor y Receptor */}
        <View style={styles.seccionContacto}>
          <View style={styles.emisor}>
            <Text style={styles.subtitulo}>EMISOR</Text>
            <Text style={styles.campo}>Nombre de Fantasía: {data.emisor_razon_social || 'Nombre de Fantasía'}</Text>
            <Text style={styles.campo}>Nombre y Apellido: {data.emisor_nombre || 'Nombre y Apellido'}</Text>
            <Text style={styles.campo}>Dirección: {data.emisor_direccion || 'Avenida 44 Nro. 12345 (1900) La Plata - Buenos Aires'}</Text>
            <Text style={styles.campo}>Teléfono: {data.emisor_telefono || '(0123) 15-456-7800'}</Text>
            <Text style={styles.campo}>Condición IVA: {data.emisor_condicion_iva || 'Responsable Monotributo'}</Text>
          </View>
          
          <View style={styles.receptor}>
            <Text style={styles.subtitulo}>RECEPTOR</Text>
            <Text style={styles.campo}>Nombre: {data.cliente || 'Cliente 1'}</Text>
            <Text style={styles.campo}>Dirección: {data.domicilio || 'Dirección Cliente 1'}</Text>
            <Text style={styles.campo}>Cond. IVA: {data.condicion_iva_cliente || 'Consumidor Final'}</Text>
            <Text style={styles.campo}>Cond. Venta: Contado</Text>
            <Text style={styles.campo}>DNI: {data.cuit || '28.123.123'}</Text>
            <Text style={styles.campo}>Localidad: {data.localidad || 'Ciudad Cliente 1'}</Text>
            <Text style={styles.campo}>Provincia: {data.provincia || 'Provincia Cliente 1'}</Text>
            <Text style={styles.campo}>Teléfono: {data.telefono_cliente || 'Teléfono Cliente 1'}</Text>
          </View>
        </View>
        
        {/* Tabla de Items */}
        <View style={styles.tabla}>
          <View style={styles.headerRow}>
            <Text style={styles.colCodigo}>Código</Text>
            <Text style={styles.colDescripcion}>Descripción</Text>
            <Text style={styles.colCantidad}>Cantidad</Text>
            <Text style={styles.colPrecio}>P. Unitario</Text>
            <Text style={styles.colImporte}>Importe</Text>
          </View>
          
          {data.items?.map((item, index) => (
            <View key={index} style={[styles.dataRow, index % 2 === 1 && styles.rowAlternate]}>
              <Text style={styles.colCodigo}>{item.codigo || ''}</Text>
              <Text style={styles.colDescripcion}>{item.vdi_detalle1 || ''}</Text>
              <Text style={styles.colCantidad}>{item.vdi_cantidad || 0}</Text>
              <Text style={styles.colPrecio}>{formatearMoneda(item.vdi_precio_unitario_final)}</Text>
              <Text style={styles.colImporte}>{formatearMoneda(item.total_item)}</Text>
            </View>
          ))}
        </View>
        
        {/* Totales */}
        <View style={styles.totales}>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>SUBTOTAL</Text>
            <Text style={styles.valorTotal}>{formatearMoneda(data.ven_total)}</Text>
          </View>
          <View style={styles.filaTotal}>
            <Text style={styles.labelTotal}>DTO./RECARGO</Text>
            <Text style={styles.valorTotal}>$ 0,00</Text>
          </View>
          <View style={styles.filaTotalFinal}>
            <Text style={styles.labelTotal}>TOTAL</Text>
            <Text style={styles.valorTotal}>{formatearMoneda(data.ven_total)}</Text>
          </View>
        </View>
        
        {/* Pie de comprobante */}
        <View style={styles.pieComprobante}>
          <Text style={styles.tituloPie}>INFORMACIÓN AFIP</Text>
          <View style={styles.campoPie}>
            <Text>CAE N°: {data.cae || '1234567890'}</Text>
            <Text></Text>
          </View>
          <View style={styles.campoPie}>
            <Text>Fecha de Vto. de CAE: {data.cae_vencimiento || '11/01/2025'}</Text>
            <Text>Comprobante generado con Virtual</Text>
          </View>
          <View style={styles.campoPie}>
            <Text>QR:</Text>
            <Text></Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PlantillaFacturaCPDF; 