ferreapps/productos
{
"productos_ferreteria": [
	{
		"id" : 1,
		"nombre" : "Ferreteria Default",
		"direccion" : "Direccion",
		"telefono" : "000",
		"email" : "",
		"activa" : 1,
		"fecha_creacion" : "",
		"situacion_iva" : "RI",
		"comprobante_por_defecto" : "",
		"margen_ganancia_por_defecto" : "",
		"notificaciones_email" : "",
		"notificaciones_pagos_pendientes" : "",
		"notificaciones_stock_bajo" : "",
		"notificaciones_vencimientos" : "",
		"permitir_stock_negativo" : "",
		"punto_venta_arca" : "",
		"cuit_cuil" : "000",
		"logo_empresa" : "",
		"razon_social" : "Ferreteria",
		"ingresos_brutos" : null,
		"inicio_actividad" : null,
		"arca_configurado" : "",
		"arca_error_configuracion" : null,
		"arca_habilitado" : "",
		"arca_ultima_validacion" : null,
		"certificado_arca" : "",
		"modo_arca" : "HOM",
		"url_wsaa_arca" : null,
		"url_wsfev1_arca" : null,
		"clave_privada_arca" : ""
	}
]}
Notas: eliminar campos url_wsaa y url_wsfev1
  Métodos del modelo no utilizados por servicios: get_configuracion_arca_urls, get_ruta_tokens_arca, get_ruta_certificados_arca (la arquitectura nueva usa ConfigManager y rutas multi-tenant propias).

**ALICUOTASIVA**    
{
"ALICUOTASIVA": [
	{
		"ALI_ID" : 1,
		"ALI_CODIGO" : "1",
		"ALI_DENO" : "NO GRAVADO",
		"ALI_PORCE" : 0
	},
	{
		"ALI_ID" : 2,
		"ALI_CODIGO" : "2",
		"ALI_DENO" : "EXENTO",
		"ALI_PORCE" : 0
	},
	{
		"ALI_ID" : 3,
		"ALI_CODIGO" : "3",
		"ALI_DENO" : "0%",
		"ALI_PORCE" : 0
	},
	{
		"ALI_ID" : 4,
		"ALI_CODIGO" : "4",
		"ALI_DENO" : "10.5%",
		"ALI_PORCE" : 10.5
	},
	{
		"ALI_ID" : 5,
		"ALI_CODIGO" : "5",
		"ALI_DENO" : "21%",
		"ALI_PORCE" : 21
	},
	{
		"ALI_ID" : 6,
		"ALI_CODIGO" : "6",
		"ALI_DENO" : "27%",
		"ALI_PORCE" : 27
	}
]}

ferreapps/clientes
**TIPOSIVA**
{
"TIPOSIVA": [
	{
		"TIV_ID" : 1,
		"TIV_DENO" : "Responsable Inscripto"
	},
	{
		"TIV_ID" : 4,
		"TIV_DENO" : "Sujeto Exento"
	},
	{
		"TIV_ID" : 5,
		"TIV_DENO" : "Consumidor Final"
	},
	{
		"TIV_ID" : 6,
		"TIV_DENO" : "Responsable Monotributo"
	},
	{
		"TIV_ID" : 13,
		"TIV_DENO" : "Monotributo Social"
	},
	{
		"TIV_ID" : 16,
		"TIV_DENO" : "Monotributo Trabajador"
	}
]}

**CLIENTES**
{
"CLIENTES": [
	{
		"CLI_ID" : 1,
		"CLI_CODIGO" : 1,
		"CLI_RAZON" : "Consumidor Final",
		"CLI_FANTASIA" : "Consumidor Final",
		"CLI_DOMI" : "",
		"CLI_TEL1" : "",
		"CLI_TEL2" : "",
		"CLI_TEL3" : "",
		"CLI_EMAIL" : "",
		"CLI_IB" : "",
		"CLI_STATUS" : null,
		"CLI_CONTACTO" : "",
		"CLI_COMENTARIO" : "",
		"CLI_LINEACRED" : 0,
		"CLI_IMPSALCTA" : 0,
		"CLI_FECSALCTA" : null,
		"CLI_DESCU1" : null,
		"CLI_DESCU2" : null,
		"CLI_DESCU3" : null,
		"CLI_CPOSTAL" : "",
		"CLI_ZONA" : "",
		"CLI_CANCELA" : "",
		"CLI_ACTI" : "A",
		"CLI_IDBAR" : null,
		"CLI_IDCAC" : null,
		"CLI_IDLOC" : null,
		"CLI_IDPLA" : 1,
		"CLI_IDPRV" : null,
		"CLI_IVA" : 5,
		"CLI_IDTRA" : null,
		"CLI_IDVDO" : null,
		"CLI_CUIT" : "0"
	}
]}
**PLAZOS**
{
"PLAZOS": [
	{
		"PLA_ID" : 1,
		"PLA_DENO" : "CONTADO",
		"PLA_ACTI" : "T",
		"PLA_PLA1" : 0,
		"PLA_PLA10" : 0,
		"PLA_PLA11" : 0,
		"PLA_PLA12" : 0,
		"PLA_PLA2" : 0,
		"PLA_PLA3" : 0,
		"PLA_PLA4" : 0,
		"PLA_PLA5" : 0,
		"PLA_PLA6" : 0,
		"PLA_PLA7" : 0,
		"PLA_PLA8" : 0,
		"PLA_PLA9" : 0,
		"PLA_POR1" : 0,
		"PLA_POR10" : 0,
		"PLA_POR11" : 0,
		"PLA_POR12" : 0,
		"PLA_POR2" : 0,
		"PLA_POR3" : 0,
		"PLA_POR4" : 0,
		"PLA_POR5" : 0,
		"PLA_POR6" : 0,
		"PLA_POR7" : 0,
		"PLA_POR8" : 0,
		"PLA_POR9" : 0
	}
]}

ferreapps/ventas
**COMPROBANTES**
{
"COMPROBANTES": [
	{
		"id" : 1,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "001",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "A",
		"CBT_TIPO" : "factura",
		"CBT_NOMBRE" : "Factura A"
	},
	{
		"id" : 2,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "002",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "A",
		"CBT_TIPO" : "nota_debito",
		"CBT_NOMBRE" : "Nota de Débito A"
	},
	{
		"id" : 3,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "003",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "A",
		"CBT_TIPO" : "nota_credito",
		"CBT_NOMBRE" : "Nota de Crédito A"
	},
	{
		"id" : 4,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "006",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "B",
		"CBT_TIPO" : "factura",
		"CBT_NOMBRE" : "Factura B"
	},
	{
		"id" : 5,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "007",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "B",
		"CBT_TIPO" : "nota_debito",
		"CBT_NOMBRE" : "Nota de Débito B"
	},
	{
		"id" : 6,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "008",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "B",
		"CBT_TIPO" : "nota_credito",
		"CBT_NOMBRE" : "Nota de Crédito B"
	},
	{
		"id" : 7,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "011",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "C",
		"CBT_TIPO" : "factura",
		"CBT_NOMBRE" : "Factura C"
	},
	{
		"id" : 8,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "012",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "C",
		"CBT_TIPO" : "nota_debito",
		"CBT_NOMBRE" : "Nota de Débito C"
	},
	{
		"id" : 9,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "013",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "C",
		"CBT_TIPO" : "nota_credito",
		"CBT_NOMBRE" : "Nota de Crédito C"
	},
	{
		"id" : 10,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "004",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "A",
		"CBT_TIPO" : "recibo",
		"CBT_NOMBRE" : "Recibo A"
	},
	{
		"id" : 11,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "009",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "B",
		"CBT_TIPO" : "recibo",
		"CBT_NOMBRE" : "Recibo B"
	},
	{
		"id" : 12,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "015",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "C",
		"CBT_TIPO" : "recibo",
		"CBT_NOMBRE" : "Recibo C"
	},
	{
		"id" : 13,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "9997",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "P",
		"CBT_TIPO" : "presupuesto",
		"CBT_NOMBRE" : "Presupuesto"
	},
	{
		"id" : 14,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "9998",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "I",
		"CBT_TIPO" : "nota_credito_interna",
		"CBT_NOMBRE" : "Nota de Credito"
	},
	{
		"id" : 15,
		"CBT_ACTIVO" : 1,
		"CBT_CODIGO_AFIP" : "9999",
		"CBT_DESCRIPCION" : "",
		"CBT_LETRA" : "I",
		"CBT_TIPO" : "factura_interna",
		"CBT_NOMBRE" : "Factura I"
	}
]}
