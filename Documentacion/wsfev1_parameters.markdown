# Parámetros para WSFEv1: Facturas y Notas de Crédito A, B, C

Este documento detalla los parámetros necesarios en formato JSON para interactuar con el **Web Service Factura Electrónica versión 1 (WSFEv1)** de la **Agencia de Recaudación y Control Aduanero (ARCA)**, según el manual proporcionado. Se describen los campos requeridos y condicionales para emitir **Facturas A, B, C** y **Notas de Crédito A, B, C**, enfocándose en elementos clave como IVA, CUIT, DNI y otros datos relevantes.

## Consideraciones Generales

- **Autenticación (`Auth`)**: Todas las solicitudes requieren un bloque de autenticación con `Token`, `Sign` y `Cuit`, obtenidos del WSAA. Estos son obligatorios en cada request.
- **Estructura General**: Las solicitudes se realizan mediante `FECAESolicitar` (para CAE) o `FECAEARegInformativo` (para CAEA). Estas incluyen:
  - `FeCabReq`: Cabecera con información del lote.
  - `FeDetReq`: Detalle de cada comprobante.
- **Campos Clave**:
  - `CbteTipo`: Define el tipo de comprobante (1 para Factura A, 3 para Nota de Crédito A, 6 para Factura B, etc.).
  - `DocTipo` y `DocNro`: Identifican al receptor (CUIT, DNI, etc.).
  - `Iva`: Detalle de alícuotas de IVA, obligatorio para ciertos casos.
  - `ImpTotal`, `ImpNeto`, `ImpIVA`, etc.: Montos del comprobante.
- **Validaciones**: Existen validaciones excluyentes (rechazan el comprobante) y no excluyentes (generan observaciones). Ejemplo: `DocNro` debe estar registrado en ARCA para Facturas A (código 10017).

## Parámetros por Tipo de Comprobante

### Factura A (CbteTipo: 1)

- **Destinatario**: Responsables Inscriptos (CUIT, `DocTipo: 80`).
- **IVA**: Obligatorio si `ImpIVA` > 0 (código 10019).
- **Campos Obligatorios**:
  - `CbteTipo`: 1
  - `DocTipo`: 80 (CUIT), 86 (CUIL), 87 (CDI) (código 10137).
  - `DocNro`: CUIT válido registrado en ARCA (código 10017).
  - `ImpTotal`: Suma de `ImpTotConc + ImpNeto + ImpOpEx + ImpTrib + ImpIVA` (código 10065).
  - `Iva`: Array con `Id`, `BaseImp`, `Importe`.
  - `MonId`: Código de moneda ("PES" para pesos).
  - `MonCotiz`: 1 si `MonId` es "PES" (código 10039).
- **Campos Condicionales**:
  - `CbtesAsoc`: Obligatorio para notas de débito/crédito asociadas.
  - `Opcionales`: Según normativas (e.g., RG 2863, RG 4004-E).

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 1
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 80,
          "DocNro": "30000000007",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 184.05,
          "ImpTotConc": 0,
          "ImpNeto": 150,
          "ImpOpEx": 0,
          "ImpTrib": 7.8,
          "ImpIva": 26.25,
          "MonId": "PES",
          "MonCotiz": 1,
          "Iva": [
            {
              "AlicIva": {
                "Id": 5,
                "BaseImp": 100,
                "Importe": 21
              }
            },
            {
              "AlicIva": {
                "Id": 4,
                "BaseImp": 50,
                "Importe": 5.25
              }
            }
          ],
          "Tributos": [
            {
              "Tributo": {
                "Id": 1,
                "BaseImp": 150,
                "Alic": 5.2,
                "Importe": 7.8
              }
            }
          ]
        }
      }
    ]
  }
}
```

### Factura B (CbteTipo: 6)

- **Destinatario**: Consumidor Final, Monotributista, o Exento. Usa `DocTipo: 96` (DNI) o `99` (Consumidor Final).
- **IVA**: No obligatorio si el receptor es Consumidor Final o Exento (código 1009).
- **Campos Obligatorios**:
  - `CbteTipo`: 6
  - `DocTipo`: 80, 86, 87, 96, 99.
  - `DocNro`: Puede ser 0 para Consumidor Final (código 708).
  - `ImpTotal`, `MonId`, `MonCotiz`.
- **Campos Condicionales**:
  - `Iva`: Obligatorio si `ImpIVA` > 0.
  - `Opcionales`: Para locación de inmuebles (Id 17).

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 6
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 99,
          "DocNro": "0",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 100,
          "ImpTotConc": 100,
          "ImpNeto": 0,
          "ImpOpEx": 0,
          "ImpTrib": 0,
          "ImpIva": 0,
          "MonId": "PES",
          "MonCotiz": 1
        }
      }
    ]
  }
}
```

### Factura C (CbteTipo: 11)

- **Destinatario**: Monotributistas, Exentos, o Consumidores Finales. Usa `DocTipo: 96` o `99`.
- **IVA**: No obligatorio (código 1009).
- **Campos Obligatorios**:
  - `CbteTipo`: 11
  - `DocTipo`, `DocNro`: Igual que Factura B.
  - `ImpTotal`, `MonId`, `MonCotiz`.
- **Campos Condicionales**:
  - `CAEA`: Para modalidad CAEA (RG 4291).
  - `Opcionales`: Según normativas.

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 11
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 99,
          "DocNro": "0",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 100,
          "ImpTotConc": 100,
          "ImpNeto": 0,
          "ImpOpEx": 0,
          "ImpTrib": 0,
          "ImpIva": 0,
          "MonId": "PES",
          "MonCotiz": 1,
          "CAEA": "21064126523746"
        }
      }
    ]
  }
}
```

### Nota de Crédito A (CbteTipo: 3)

- **Destinatario**: Igual que Factura A.
- **IVA**: Obligatorio si `ImpIVA` > 0.
- **Campos Obligatorios**:
  - `CbteTipo`: 3
  - `DocTipo`, `DocNro`: Igual que Factura A.
  - `CbtesAsoc`: Obligatorio, referencia a la factura asociada (código 800).
  - `ImpTotal`, `MonId`, `MonCotiz`.
- **Campos Condicionales**:
  - `Iva`: Igual que Factura A.
  - `Opcionales`: Según normativas.

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 3
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 80,
          "DocNro": "30000000007",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 184.05,
          "ImpTotConc": 0,
          "ImpNeto": 150,
          "ImpOpEx": 0,
          "ImpTrib": 7.8,
          "ImpIva": 26.25,
          "MonId": "PES",
          "MonCotiz": 1,
          "Iva": [
            {
              "AlicIva": {
                "Id": 5,
                "BaseImp": 100,
                "Importe": 21
              }
            }
          ],
          "CbtesAsoc": [
            {
              "CbteAsoc": {
                "Tipo": 1,
                "PtoVta": 2,
                "Nro": 1,
                "Cuit": "30000000007",
                "CbteFch": "20250728"
              }
            }
          ]
        }
      }
    ]
  }
}
```

### Nota de Crédito B (CbteTipo: 8)

- **Destinatario**: Igual que Factura B.
- **IVA**: No obligatorio si el receptor es Consumidor Final o Exento.
- **Campos Obligatorios**:
  - `CbteTipo`: 8
  - `DocTipo`, `DocNro`: Igual que Factura B.
  - `CbtesAsoc`: Obligatorio.
  - `ImpTotal`, `MonId`, `MonCotiz`.
- **Campos Condicionales**:
  - `Iva`: Igual que Factura B.

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 8
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 99,
          "DocNro": "0",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 100,
          "ImpTotConc": 100,
          "ImpNeto": 0,
          "ImpOpEx": 0,
          "ImpTrib": 0,
          "ImpIva": 0,
          "MonId": "PES",
          "MonCotiz": 1,
          "CbtesAsoc": [
            {
              "CbteAsoc": {
                "Tipo": 6,
                "PtoVta": 2,
                "Nro": 1,
                "Cuit": "0",
                "CbteFch": "20250728"
              }
            }
          ]
        }
      }
    ]
  }
}
```

### Nota de Crédito C (CbteTipo: 13)

- **Destinatario**: Igual que Factura C.
- **IVA**: No obligatorio.
- **Campos Obligatorios**:
  - `CbteTipo`: 13
  - `DocTipo`, `DocNro`: Igual que Factura C.
  - `CbtesAsoc`: Obligatorio.
  - `ImpTotal`, `MonId`, `MonCotiz`.
- **Campos Condicionales**:
  - `CAEA`: Para modalidad CAEA.
  - `Iva`: Igual que Factura C.

**Ejemplo JSON**:
```json
{
  "FeCAEReq": {
    "FeCabReq": {
      "CantReg": 1,
      "PtoVta": 2,
      "CbteTipo": 13
    },
    "FeDetReq": [
      {
        "FECAEDetRequest": {
          "Concepto": 1,
          "DocTipo": 99,
          "DocNro": "0",
          "CbteDesde": 1,
          "CbteHasta": 1,
          "CbteFch": "20250728",
          "ImpTotal": 100,
          "ImpTotConc": 100,
          "ImpNeto": 0,
          "ImpOpEx": 0,
          "ImpTrib": 0,
          "ImpIva": 0,
          "MonId": "PES",
          "MonCotiz": 1,
          "CAEA": "21064126523746",
          "CbtesAsoc": [
            {
              "CbteAsoc": {
                "Tipo": 11,
                "PtoVta": 2,
                "Nro": 1,
                "Cuit": "0",
                "CbteFch": "20250728"
              }
            }
          ]
        }
      }
    ]
  }
}
```

## Condición Frente al IVA del Receptor

Según el manual (pág. 197), las combinaciones válidas de `DocTipo` y `CbteTipo` son:

| Código | Descripción                        | Factura/Nota A/M | Factura/Nota B | Factura/Nota C |
|--------|------------------------------------|------------------|----------------|----------------|
| 1      | IVA Responsable Inscripto         | X                |                | X              |
| 4      | IVA Sujeto Exento                 |                  | X              | X              |
| 5      | Consumidor Final                  |                  | X              | X              |
| 10     | IVA Liberado - Ley N° 19.640      |                  | X              | X              |
| 13     | Monotributista Social             | X                |                | X              |
| 15     | IVA No Alcanzado                  |                  | X              | X              |
| 16     | Monotributo Trabajador Independiente Promovido | X |                | X              |

- **Factura A/Nota de Crédito A**: Requieren CUIT registrado (Responsable Inscripto o Monotributista Social).
- **Factura B/C, Nota de Crédito B/C**: Pueden usar DNI o Consumidor Final (DocNro: 0).

## Notas Adicionales

- **CAEA vs. CAE**: Para CAEA, incluir el campo `CAEA` en `FECAEADetRequest` (pág. 161). CAE no lo requiere.
- **Errores Comunes**:
  - `ImpTotal` incorrecto (código 10065).
  - `DocNro` no registrado en ARCA para Factura A (código 10017).
  - `Iva` obligatorio si `ImpIVA` > 0 (código 10019).
- **Consulta de Códigos**: Usa métodos como `FEParamGetTiposCbte`, `FEParamGetTiposDoc`, y `FEParamGetCondicionIvaReceptor` para obtener valores válidos.
- **Homologación URL**: Servicios se llaman desde `https://wswhomo.afip.gov.ar/wsfeV1/service.asmx`.

Este documento proporciona una guía clara para estructurar solicitudes JSON para WSFEv1, asegurando cumplimiento con las validaciones del manual.