# Servicio de Generación de PDFs de Comprobantes

## Descripción

Este servicio genera archivos PDF de comprobantes (facturas A, B, C, presupuestos, etc.) con formato oficial AFIP, siguiendo la estética de los comprobantes argentinos.

## Características

- ✅ **Formato Oficial AFIP**: Cumple con las especificaciones de la AFIP
- ✅ **Múltiples Tipos**: Soporta Facturas A, B, C, Presupuestos, Ventas
- ✅ **Colores Diferenciados**: Cada tipo de comprobante tiene su color distintivo
- ✅ **Datos Completos**: Incluye emisor, receptor, items, totales e información AFIP
- ✅ **IVA Diferenciado**: Maneja correctamente el IVA según el tipo de comprobante

## Estructura del PDF

### 1. Encabezado
- Título "FACTURA" centrado
- Información del comprobante (letra, código AFIP, número, fecha)

### 2. Información de Contacto
- **Emisor** (izquierda): Razón social, dirección, CUIT, etc.
- **Receptor** (derecha): Datos del cliente

### 3. Tabla de Items
- **Factura A**: Código, descripción, cantidad, precio unitario, descuentos, alícuota, IVA, importe
- **Factura B/C**: Código, descripción, cantidad, precio unitario, descuentos, importe final

### 4. Totales
- **Factura A**: Importe neto gravado, IVA discriminado por alícuota, total
- **Factura B**: Subtotal, IVA contenido, total
- **Factura C**: Subtotal, total

### 5. Pie de Comprobante
- Información AFIP (CAE, vencimiento, QR)

## Colores por Tipo de Comprobante

| Letra | Tipo | Color | Código AFIP |
|-------|------|-------|-------------|
| A | Factura A | Azul (#1e40af) | 01 |
| B | Factura B | Verde (#059669) | 06 |
| C | Factura C | Púrpura (#7c3aed) | 11 |
| M | Factura M | Azul (#1e40af) | 01 |
| P | Presupuesto | Púrpura (#7c3aed) | 11 |
| V | Venta | Púrpura (#7c3aed) | 11 |

## Uso

### Desde el Backend

```python
from .servicies.comprobante_export_service import generar_pdf_comprobante, obtener_nombre_archivo_comprobante

# Datos del comprobante
datos_comprobante = {
    'fecha': '01/01/2025',
    'numero_formateado': 'A 0001-00000001',
    'ven_total': 10890.00,
    'cliente': 'Empresa Cliente',
    'comprobante': {
        'letra': 'A',
        'codigo_afip': '01',
    },
    'items': [...],
    # ... más datos
}

# Generar PDF
pdf_buffer = generar_pdf_comprobante(datos_comprobante)
nombre_archivo = obtener_nombre_archivo_comprobante(datos_comprobante)
```

### Desde el Frontend

El botón "Imprimir" en la tabla de comprobantes llama al endpoint:

```
GET /api/ventas/{id}/imprimir/
```

Que devuelve un archivo PDF para descarga.

## Archivos del Servicio

- `comprobante_export_service.py`: Servicio principal de generación
- `test_pdf_comprobante.py`: Script de pruebas
- `README_PDF_COMPROBANTES.md`: Esta documentación

## Pruebas

Para probar el servicio:

```bash
cd ferredesk_v0/backend
python test_pdf_comprobante.py
```

Esto generará archivos PDF de ejemplo para verificar el funcionamiento.

## Dependencias

- **ReportLab**: Librería principal para generación de PDFs
- **Django**: Framework web
- **Python 3.8+**: Versión mínima requerida

## Configuración Futura

### Datos del Emisor
Actualmente los datos del emisor están hardcodeados. Se debe implementar:

1. Modelo de configuración de la empresa
2. Endpoint para obtener datos del emisor
3. Integración con el servicio de PDF

### Mejoras Pendientes

- [ ] QR code real (actualmente placeholder)
- [ ] Logo de la empresa
- [ ] Configuración de datos del emisor
- [ ] Múltiples idiomas
- [ ] Plantillas personalizables
- [ ] Compresión de PDF
- [ ] Cache de PDFs generados

## Estructura de Datos Requerida

El servicio espera un diccionario con la siguiente estructura:

```python
{
    'fecha': str,                    # Fecha formateada DD/MM/YYYY
    'numero_formateado': str,        # Número con letra
    'ven_total': float,              # Total del comprobante
    'ven_impneto': float,            # Importe neto (solo Factura A)
    'iva_global': float,             # IVA total
    'cliente': str,                  # Nombre del cliente
    'domicilio': str,                # Dirección del cliente
    'cuit': str,                     # CUIT/DNI del cliente
    'comprobante': {
        'letra': str,                # Letra del comprobante (A, B, C, etc.)
        'codigo_afip': str,          # Código AFIP
    },
    'items': [                       # Lista de items
        {
            'codigo': str,
            'vdi_detalle1': str,
            'vdi_cantidad': int,
            # ... más campos según tipo
        }
    ],
    # ... más campos opcionales
}
```

## Notas Técnicas

- Los PDFs se generan en memoria usando `io.BytesIO`
- Se usa ReportLab para el layout y estilos
- Los colores están definidos como constantes
- El formato es A4 con márgenes de 0.5 pulgadas
- Los archivos se nombran automáticamente con el formato: `comprobante_{letra}_{numero}_{fecha}.pdf` 