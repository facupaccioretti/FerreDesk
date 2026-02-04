"""
ViewSets principales para gestión de ventas y detalles.
"""
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db import IntegrityError
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter, CharFilter
from decimal import Decimal
import logging

from ..models import (
    Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed,
    VentaDetalleItemCalculado, VentaIVAAlicuota, VentaCalculada
)
from ..serializers import (
    VentaSerializer, VentaDetalleItemSerializer, VentaDetalleManSerializer,
    VentaRemPedSerializer, VentaDetalleItemCalculadoSerializer,
    VentaIVAAlicuotaSerializer, VentaCalculadaSerializer
)
from ferreapps.productos.models import Ferreteria, StockProve
from ferreapps.clientes.models import Cliente
from ..utils import asignar_comprobante, _construir_respuesta_comprobante
from ..ARCA import emitir_arca_automatico, debe_emitir_arca, FerreDeskARCAError
from ..ARCA.settings_arca import COMPROBANTES_INTERNOS
from .utils_stock import (
    _obtener_proveedor_habitual_stock,
    _obtener_codigo_venta,
    _descontar_distribuyendo,
)
from ferreapps.caja.models import SesionCaja, ESTADO_CAJA_ABIERTA

logger = logging.getLogger(__name__)

# Constantes
PUNTO_VENTA_INTERNO = 99
ALICUOTAS = {
    1: Decimal('0'),  # NO GRAVADO
    2: Decimal('0'),  # EXENTO
    3: Decimal('0'),  # 0%
    4: Decimal('10.5'),
    5: Decimal('21'),
    6: Decimal('27')
}

# Tipos de comprobante que requieren tener caja abierta
# Excluimos: presupuesto (propuesta), nota_credito (devolución)
COMPROBANTES_QUE_REQUIEREN_CAJA = [
    'factura',              # Ventas fiscales (A, B, C)
    'factura_interna',      # Cotización - venta en negro
    'nota_debito',          # Cobro adicional fiscal
    'nota_debito_interna',  # Cobro adicional interno
    'recibo',               # Cobro de cuenta corriente
]


def obtener_sesion_caja_activa(usuario):
    """
    Obtiene la sesión de caja abierta del usuario.
    Retorna None si no tiene caja abierta.
    """
    return SesionCaja.objects.filter(
        usuario=usuario,
        estado=ESTADO_CAJA_ABIERTA
    ).first()


class VentaFilter(FilterSet):
    ven_fecha = DateFromToRangeFilter(field_name='ven_fecha')
    ven_idcli = NumberFilter(field_name='ven_idcli')
    ven_idvdo = NumberFilter(field_name='ven_idvdo')
    ven_estado = NumberFilter(field_name='ven_estado')
    comprobante = NumberFilter(field_name='comprobante')
    comprobante_tipo = CharFilter(field_name='comprobante__tipo', lookup_expr='iexact')
    comprobante_letra = CharFilter(field_name='comprobante__letra', lookup_expr='iexact')
    ven_sucursal = NumberFilter(field_name='ven_sucursal')
    ven_total = DateFromToRangeFilter(field_name='ven_total')
    ven_punto = NumberFilter(field_name='ven_punto')
    ven_numero = NumberFilter(field_name='ven_numero')

    class Meta:
        model = Venta
        fields = [
            'ven_fecha', 'ven_idcli', 'ven_idvdo', 'ven_estado', 'comprobante',
            'comprobante_tipo', 'comprobante_letra', 'ven_sucursal', 'ven_total', 'ven_punto', 'ven_numero'
        ]


class VentaCalculadaFilter(FilterSet):
    ven_fecha = DateFromToRangeFilter(field_name='ven_fecha')
    ven_idcli = NumberFilter(field_name='ven_idcli')
    ven_idvdo = NumberFilter(field_name='ven_idvdo')
    comprobante_tipo = CharFilter(field_name='comprobante_tipo', lookup_expr='iexact')
    comprobante_letra = CharFilter(field_name='comprobante_letra', lookup_expr='iexact')
    # NUEVO: Filtro para notas de crédito - solo facturas válidas
    para_nota_credito = CharFilter(method='filter_para_nota_credito', label='Para nota de crédito')

    def filter_para_nota_credito(self, queryset, name, value):
        """
        Filtra para mostrar solo facturas válidas para asociar a una nota de crédito.
        Solo permite facturas fiscales (A, B, C) e internas (I).
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[FILTRO] filter_para_nota_credito llamado con value: {value}")
        logger.info(f"[FILTRO] Queryset inicial: {queryset.count()} registros")
        
        if value.lower() == 'true':
            filtered_queryset = queryset.filter(
                comprobante_tipo__in=['factura', 'venta', 'factura_interna']
            )
            logger.info(f"[FILTRO] Queryset filtrado: {filtered_queryset.count()} registros")
            
            # DEBUG: Mostrar tipos encontrados
            tipos_encontrados = set(filtered_queryset.values_list('comprobante_tipo', flat=True))
            logger.info(f"[FILTRO] Tipos de comprobantes encontrados: {tipos_encontrados}")
            
            return filtered_queryset
        return queryset

    class Meta:
        model = VentaCalculada  # Vista SQL (managed = False)
        fields = ['ven_fecha', 'ven_idcli', 'ven_idvdo', 'comprobante_tipo', 'comprobante_letra', 'para_nota_credito']


class VentaViewSet(viewsets.ModelViewSet):
    """ViewSet principal para Ventas.

    • list  -> usa la vista calculada (VENTA_CALCULADO) para incluir los totales.
    • otras -> continúan usando el modelo base `Venta`.
    """

    # Configuración por defecto (para acciones distintas de list)
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = VentaFilter

    # --- Selección dinámica de queryset / serializer / filterset --------
    def get_queryset(self):
        if getattr(self, 'action', None) == 'list':
            # Aseguramos que el filtro use el modelo adecuado para la vista
            self.filterset_class = VentaCalculadaFilter
            # Orden inverso por fecha e ID para traer los más recientes primero
            return VentaCalculada.objects.all().order_by('-ven_fecha', '-ven_id')
        # Restablecemos el filtro original para otras acciones
        self.filterset_class = VentaFilter
        return super().get_queryset()

    def get_serializer_class(self):
        if getattr(self, 'action', None) == 'list':
            return VentaCalculadaSerializer
        return super().get_serializer_class()

    def get_filterset_class(self):
        if getattr(self, 'action', None) == 'list':
            return VentaCalculadaFilter
        return super().get_filterset_class()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        items = data.get('items', [])
        tipo_comprobante = data.get('tipo_comprobante')
        # Para Notas de Débito y su equivalente interno permitimos items vacíos;
        # el serializer generará el ítem genérico en base a los campos específicos.
        if not items and tipo_comprobante not in ['nota_debito', 'nota_debito_interna']:
            return Response({'detail': 'El campo items es requerido y no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)

        # === VALIDACIÓN DE CAJA ABIERTA ===
        # Para ventas, cotizaciones y notas de débito se requiere tener una caja abierta
        sesion_caja = None
        if tipo_comprobante in COMPROBANTES_QUE_REQUIEREN_CAJA:
            sesion_caja = obtener_sesion_caja_activa(request.user)
            if not sesion_caja:
                return Response({
                    'detail': 'Debe abrir una caja antes de realizar esta operación.',
                    'error_code': 'CAJA_NO_ABIERTA',
                    'tipo_comprobante': tipo_comprobante
                }, status=status.HTTP_400_BAD_REQUEST)

        # --- NUEVO: Asignar bonificación general a los ítems sin bonificación particular ---
        bonif_general = data.get('bonificacionGeneral', 0)
        try:
            bonif_general = float(bonif_general)
        except Exception:
            bonif_general = 0
        for item in items:
            bonif = item.get('vdi_bonifica')
            if not bonif or float(bonif) == 0:
                item['vdi_bonifica'] = bonif_general

        # Obtener configuración de la ferretería para determinar política de stock negativo
        ferreteria = Ferreteria.objects.first()
        # Usar configuración de la ferretería, con posibilidad de override desde el frontend
        permitir_stock_negativo = data.get('permitir_stock_negativo', getattr(ferreteria, 'permitir_stock_negativo', False))
        
        es_presupuesto = (tipo_comprobante == 'presupuesto')
        es_nota_credito = (tipo_comprobante == 'nota_credito')
        es_nota_debito = (tipo_comprobante == 'nota_debito')
        errores_stock = []
        stock_actualizado = []
        if not es_presupuesto:
            for item in items:
                id_stock = item.get('vdi_idsto')
                cantidad = Decimal(str(item.get('vdi_cantidad', 0)))

                # Si el ítem no tiene un ID de stock, es genérico y no participa en la lógica de inventario.
                if not id_stock:
                    continue

                # NUEVO: El backend obtiene automáticamente el proveedor habitual del stock
                # El frontend solo debe enviar vdi_idsto, el backend maneja toda la lógica
                id_proveedor = _obtener_proveedor_habitual_stock(id_stock)
                if not id_proveedor:
                    cod = _obtener_codigo_venta(id_stock)
                    errores_stock.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock})")
                    continue
                    
                if es_nota_credito:
                    # Para notas de crédito, el stock se devuelve (suma) SOLO al proveedor indicado
                    try:
                        stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                    except StockProve.DoesNotExist:
                        cod = _obtener_codigo_venta(id_stock)
                        errores_stock.append(f"No existe stock para el producto {cod}")
                        continue
                    stockprove.cantidad += cantidad
                    stockprove.save()
                    stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                # Notas de débito: no tocan stock (no hay ItemsGrid de productos)
                elif es_nota_debito:
                    continue
                    try:
                        stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                    except StockProve.DoesNotExist:
                        cod = _obtener_codigo_venta(id_stock)
                        errores_stock.append(f"No existe stock para el producto {cod}")
                        continue
                    stockprove.cantidad += cantidad
                    stockprove.save()
                    stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                else:
                    # Venta: descontar distribuyendo entre proveedores si hace falta
                    _descontar_distribuyendo(
                        stock_id=id_stock,
                        proveedor_preferido_id=id_proveedor,
                        cantidad=cantidad,
                        permitir_stock_negativo=permitir_stock_negativo,
                        errores_stock=errores_stock,
                        stock_actualizado=stock_actualizado,
                    )
            if errores_stock:
                # Imitar exactamente el formato de conversión de presupuesto: detail = str({...})
                payload = {'detail': 'Error de stock', 'errores': errores_stock}
                return Response({'detail': str(payload)}, status=status.HTTP_400_BAD_REQUEST)
        cliente_id = data.get('ven_idcli')
        cliente = Cliente.objects.filter(id=cliente_id).first()
        situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
        tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
        
        # Obtener el comprobante apropiado según el tipo y cliente
        comprobante_id_enviado = data.get('comprobante_id')
        
        # Si el frontend envió un comprobante específico, lo usamos (validando que exista)
        if comprobante_id_enviado:
            comprobante_obj = Comprobante.objects.filter(codigo_afip=comprobante_id_enviado, activo=True).first()
            if not comprobante_obj:
                return Response({
                    'detail': f'No se encontró comprobante con código AFIP {comprobante_id_enviado} o no está activo'
                }, status=status.HTTP_400_BAD_REQUEST)
            comprobante = _construir_respuesta_comprobante(comprobante_obj)
        else:
            # Si no se envió un comprobante específico, utilizar la función asignar_comprobante
            try:
                comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
            except ValidationError as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        if not comprobante:
            return Response({
                'detail': 'No se encontró comprobante válido para la operación. '
                          'Verifique la configuración de comprobantes y letras.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data['comprobante_id'] = comprobante["codigo_afip"]

        # === PUNTO DE VENTA PARA COMPROBANTES INTERNOS ===
        # Si el tipo de comprobante está listado como interno, usar el PV interno 0099
        if tipo_comprobante in COMPROBANTES_INTERNOS:
            data['ven_punto'] = PUNTO_VENTA_INTERNO

        # === ALINEAR PUNTO DE VENTA CON ARCA CUANDO ES COMPROBANTE FISCAL ===
        # Para evitar desalineación con AFIP y colisiones de numeración, si el comprobante
        # requiere emisión ARCA, forzar a usar el punto de venta configurado en Ferretería.
        if debe_emitir_arca(tipo_comprobante):
            pv_arca = getattr(ferreteria, 'punto_venta_arca', None)
            if pv_arca:
                data['ven_punto'] = pv_arca
        # Si el frontend no envió punto de venta, usar el configurado en ferretería como valor por defecto
        if not data.get('ven_punto'):
            pv_defecto = getattr(ferreteria, 'punto_venta_arca', None)
            if pv_defecto:
                data['ven_punto'] = pv_defecto

        punto_venta = data.get('ven_punto')
        if not punto_venta:
            return Response({'detail': 'El punto de venta es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        intentos = 0
        max_intentos = 10
        while intentos < max_intentos:
            ultima_venta = Venta.objects.filter(
                ven_punto=punto_venta,
                comprobante_id=comprobante["codigo_afip"]
            ).order_by('-ven_numero').first()
            nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
            data['ven_numero'] = nuevo_numero
            try:
                # === CREAR VENTA ===
                response = super().create(request, *args, **kwargs)
                venta_creada = Venta.objects.get(ven_id=response.data['ven_id'])
                
                # === ASIGNAR SESIÓN DE CAJA ===
                # Si el comprobante requería caja abierta, vincular la venta con la sesión
                if sesion_caja:
                    venta_creada.sesion_caja = sesion_caja
                    venta_creada.save(update_fields=['sesion_caja'])
                
                # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
                if debe_emitir_arca(tipo_comprobante):
                    try:
                        logger.info(f"Emisión automática ARCA para venta {venta_creada.ven_id} - tipo: {tipo_comprobante}")
                        resultado_arca = emitir_arca_automatico(venta_creada)
                        
                        # Agregar información ARCA a la respuesta
                        response.data['arca_emitido'] = True
                        response.data['cae'] = resultado_arca.get('resultado', {}).get('cae')
                        response.data['cae_vencimiento'] = resultado_arca.get('resultado', {}).get('cae_vencimiento')
                        response.data['qr_generado'] = resultado_arca.get('resultado', {}).get('qr_generado', False)
                        response.data['observaciones'] = resultado_arca.get('resultado', {}).get('observaciones', [])
                        
                        logger.info(f"Emisión ARCA exitosa para venta {venta_creada.ven_id}: CAE {resultado_arca.get('resultado', {}).get('cae')}")
                        
                    except Exception as e:
                        # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
                        logger.error(f"Error en emisión automática ARCA para venta {venta_creada.ven_id}: {e}")
                        raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
                else:
                    # Comprobante interno - no requiere emisión ARCA
                    response.data['arca_emitido'] = False
                    response.data['arca_motivo'] = 'Comprobante interno - no requiere emisión ARCA'
                
                # === CREAR AUTO-IMPUTACIÓN SI ES "FACTURA RECIBO" ===
                comprobante_pagado = data.get('comprobante_pagado', False)
                monto_pago = Decimal(str(data.get('monto_pago', 0)))
                
                # Obtener total de la venta desde VentaCalculada
                venta_calculada = VentaCalculada.objects.filter(ven_id=venta_creada.ven_id).first()
                total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')

                # Permitir monto_pago < total: (1) recibo parcial (se crea recibo e imputación), o (2) Consumidor Final con justificación
                CLIENTE_CONSUMIDOR_FINAL_ID = 1
                if (
                    comprobante_pagado
                    and monto_pago > 0
                    and monto_pago < total_venta - Decimal('0.01')
                    and not data.get('recibo_parcial')
                ):
                    justificacion = (data.get('justificacion_diferencia') or '').strip()
                    cliente_id = venta_creada.ven_idcli_id
                    if cliente_id != CLIENTE_CONSUMIDOR_FINAL_ID or not justificacion:
                        raise ValidationError(
                            'El monto pagado no alcanza al total. Solo el cliente generico puede registrar '
                            'una diferencia menor con justificación obligatoria.'
                        )
                
                # Auto-imputación: solo hasta el total de la venta (no aplicar si hay recibo parcial)
                if comprobante_pagado and monto_pago > 0 and not data.get('recibo_parcial'):
                    from ferreapps.cuenta_corriente.models import ImputacionVenta
                    from datetime import date
                    
                    # El monto de auto-imputación es el mínimo entre monto_pago y total_venta
                    monto_auto_imputacion = min(monto_pago, total_venta)
                    
                    # Crear la auto-imputación: factura se imputa a sí misma
                    ImputacionVenta.objects.create(
                        imp_id_venta=venta_creada,      # La factura
                        imp_id_recibo=venta_creada,     # La misma factura (auto-imputación)
                        imp_monto=monto_auto_imputacion, # Monto del pago (limitado al total)
                        imp_fecha=date.today(),         # Fecha actual
                        imp_observacion='Factura Recibo - Auto-imputación'
                    )
                    
                    response.data['auto_imputacion_creada'] = True
                    response.data['monto_imputado'] = str(monto_auto_imputacion)
                else:
                    response.data['auto_imputacion_creada'] = False
                
                # === REGISTRAR PAGOS Y MOVIMIENTOS DE CAJA ===
                # Flujo unificado: normalizar_cobro (bruto/neto, excedente) → registrar_pagos_venta → metadata en Venta
                if sesion_caja and comprobante_pagado:
                    from ferreapps.caja.utils import normalizar_cobro, registrar_pagos_venta
                    from ferreapps.caja.models import MetodoPago, CODIGO_EFECTIVO

                    pagos_data = list(data.get('pagos') or [])
                    if not pagos_data and monto_pago and monto_pago > 0:
                        metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
                        if metodo_efectivo:
                            pagos_data = [{'metodo_pago_id': metodo_efectivo.id, 'monto': monto_pago}]

                    request_data = {
                        'pagos': pagos_data,
                        'monto_pago': monto_pago,
                        'excedente_destino': data.get('excedente_destino'),
                        'justificacion_excedente': data.get('justificacion_excedente'),
                    }
                    pagos_normalizados, metadata_cobro = normalizar_cobro(request_data, total_venta)

                    if pagos_normalizados:
                        pagos_creados = registrar_pagos_venta(
                            venta=venta_creada,
                            sesion_caja=sesion_caja,
                            pagos=pagos_normalizados,
                            descripcion_base="Pago de"
                        )
                        campos_actualizados = []
                        for clave, valor in metadata_cobro.items():
                            if valor is not None and hasattr(venta_creada, clave):
                                setattr(venta_creada, clave, valor)
                                campos_actualizados.append(clave)
                        if campos_actualizados:
                            venta_creada.save(update_fields=campos_actualizados)
                    else:
                        pagos_creados = []

                    response.data['pagos_registrados'] = len(pagos_creados)
                    response.data['total_pagado'] = str(sum(p.monto for p in pagos_creados))
                else:
                    response.data['pagos_registrados'] = 0
                
                # === CREAR RECIBO DE EXCEDENTE SI EXISTE ===
                recibo_excedente_data = data.get('recibo_excedente')
                if recibo_excedente_data:
                    # Fuente de verdad del total pagado: suma de pagos o monto_pago
                    _pagos_re = data.get('pagos') or []
                    _total_pagado_re = (
                        sum(Decimal(str(p.get('monto', 0))) for p in _pagos_re)
                        if _pagos_re
                        else monto_pago
                    )
                    excedente_calculado = max(_total_pagado_re - total_venta, Decimal('0'))
                    monto_recibo = Decimal(str(recibo_excedente_data.get('rec_monto_total', 0)))
                    
                    if abs(monto_recibo - excedente_calculado) > Decimal('0.01'):  # Tolerancia de 1 centavo
                        raise ValidationError(
                            f'El monto del recibo ({monto_recibo}) no coincide con el excedente ({excedente_calculado})'
                        )
                    
                    # Validar que el recibo no tenga imputaciones
                    if recibo_excedente_data.get('imputaciones'):
                        raise ValidationError('El recibo de excedente no debe tener imputaciones')
                    
                    # Crear el recibo
                    from datetime import date as datetime_date
                    
                    # Obtener comprobante de recibo (letra X)
                    comprobante_recibo = Comprobante.objects.filter(
                        tipo='recibo',
                        letra='X',
                        activo=True
                    ).first()
                    
                    if not comprobante_recibo:
                        raise ValidationError('No se encontró comprobante de recibo con letra X')
                    
                    # Formatear punto de venta y número
                    rec_pv = int(recibo_excedente_data['rec_pv'])
                    rec_num = int(recibo_excedente_data['rec_numero'])
                    
                    # Verificar unicidad
                    ya_existe = Venta.objects.filter(
                        comprobante=comprobante_recibo,
                        ven_punto=rec_pv,
                        ven_numero=rec_num
                    ).exists()
                    
                    if ya_existe:
                        raise ValidationError(
                            f'El número de recibo X {rec_pv:04d}-{rec_num:08d} ya existe'
                        )
                    
                    # Crear recibo
                    recibo = Venta.objects.create(
                        ven_sucursal=1,
                        ven_fecha=recibo_excedente_data.get('rec_fecha', datetime_date.today()),
                        comprobante=comprobante_recibo,
                        ven_punto=rec_pv,
                        ven_numero=rec_num,
                        ven_descu1=0,
                        ven_descu2=0,
                        ven_descu3=0,
                        ven_vdocomvta=0,
                        ven_vdocomcob=0,
                        ven_estado='CO',
                        ven_idcli=venta_creada.ven_idcli,
                        ven_cuit=venta_creada.ven_cuit or '',
                        ven_dni='',
                        ven_domicilio=venta_creada.ven_domicilio or '',
                        ven_razon_social=venta_creada.ven_razon_social or '',
                        ven_idpla=venta_creada.ven_idpla,
                        ven_idvdo=venta_creada.ven_idvdo,
                        ven_copia=1,
                        ven_observacion=recibo_excedente_data.get('rec_observacion', '')
                    )
                    
                    # Crear item genérico para el recibo
                    VentaDetalleItem.objects.create(
                        vdi_idve=recibo,
                        vdi_idsto=None,
                        vdi_idpro=None,
                        vdi_cantidad=1,
                        vdi_precio_unitario_final=monto_recibo,
                        vdi_idaliiva=3,  # Alícuota 0%
                        vdi_orden=1,
                        vdi_bonifica=0,
                        vdi_costo=0,
                        vdi_margen=0,
                        vdi_detalle1=f'Recibo X {rec_pv:04d}-{rec_num:08d}',
                        vdi_detalle2=''
                    )
                    
                    response.data['recibo_excedente_creado'] = True
                    response.data['recibo_excedente_id'] = recibo.ven_id
                    response.data['recibo_excedente_numero'] = f'X {rec_pv:04d}-{rec_num:08d}'
                else:
                    response.data['recibo_excedente_creado'] = False

                # === CREAR RECIBO PARCIAL E IMPUTACIÓN SI EXISTE ===
                recibo_parcial_data = data.get('recibo_parcial')
                if recibo_parcial_data:
                    from ferreapps.cuenta_corriente.models import ImputacionVenta
                    from datetime import date as datetime_date

                    monto_recibo_parcial = Decimal(str(recibo_parcial_data.get('rec_monto_total', 0)))
                    if monto_recibo_parcial <= 0:
                        raise ValidationError('El monto del recibo parcial debe ser mayor a 0.')

                    # Monto pagado debe coincidir con el recibo parcial
                    if abs(monto_recibo_parcial - monto_pago) > Decimal('0.01'):
                        raise ValidationError(
                            f'El monto del recibo parcial ({monto_recibo_parcial}) debe coincidir con el monto pagado ({monto_pago}).'
                        )

                    comprobante_recibo = Comprobante.objects.filter(
                        tipo='recibo',
                        letra='X',
                        activo=True
                    ).first()
                    if not comprobante_recibo:
                        raise ValidationError('No se encontró comprobante de recibo con letra X')

                    rec_pv = int(recibo_parcial_data['rec_pv'])
                    rec_num = int(recibo_parcial_data['rec_numero'])
                    ya_existe = Venta.objects.filter(
                        comprobante=comprobante_recibo,
                        ven_punto=rec_pv,
                        ven_numero=rec_num
                    ).exists()
                    if ya_existe:
                        raise ValidationError(
                            f'El número de recibo X {rec_pv:04d}-{rec_num:08d} ya existe'
                        )

                    recibo_parcial = Venta.objects.create(
                        ven_sucursal=1,
                        ven_fecha=recibo_parcial_data.get('rec_fecha', datetime_date.today()),
                        comprobante=comprobante_recibo,
                        ven_punto=rec_pv,
                        ven_numero=rec_num,
                        ven_descu1=0,
                        ven_descu2=0,
                        ven_descu3=0,
                        ven_vdocomvta=0,
                        ven_vdocomcob=0,
                        ven_estado='CO',
                        ven_idcli=venta_creada.ven_idcli,
                        ven_cuit=venta_creada.ven_cuit or '',
                        ven_dni='',
                        ven_domicilio=venta_creada.ven_domicilio or '',
                        ven_razon_social=venta_creada.ven_razon_social or '',
                        ven_idpla=venta_creada.ven_idpla,
                        ven_idvdo=venta_creada.ven_idvdo,
                        ven_copia=1,
                        ven_observacion=recibo_parcial_data.get('rec_observacion', '')
                    )

                    VentaDetalleItem.objects.create(
                        vdi_idve=recibo_parcial,
                        vdi_idsto=None,
                        vdi_idpro=None,
                        vdi_cantidad=1,
                        vdi_precio_unitario_final=monto_recibo_parcial,
                        vdi_idaliiva=3,
                        vdi_orden=1,
                        vdi_bonifica=0,
                        vdi_costo=0,
                        vdi_margen=0,
                        vdi_detalle1=f'Recibo X {rec_pv:04d}-{rec_num:08d}',
                        vdi_detalle2=''
                    )

                    fecha_imp = recibo_parcial_data.get('rec_fecha', datetime_date.today())
                    if isinstance(fecha_imp, str):
                        from datetime import datetime
                        fecha_imp = datetime.strptime(fecha_imp, '%Y-%m-%d').date()
                    ImputacionVenta.objects.create(
                        imp_id_venta=venta_creada,
                        imp_id_recibo=recibo_parcial,
                        imp_monto=monto_recibo_parcial,
                        imp_fecha=fecha_imp,
                        imp_observacion='Recibo parcial - Pago al cobro'
                    )

                    response.data['recibo_parcial_creado'] = True
                    response.data['recibo_parcial_id'] = recibo_parcial.ven_id
                    response.data['recibo_parcial_numero'] = f'X {rec_pv:04d}-{rec_num:08d}'
                else:
                    response.data['recibo_parcial_creado'] = False

                # Agregar datos de respuesta
                response.data['stock_actualizado'] = stock_actualizado
                response.data['comprobante_letra'] = comprobante["letra"]
                response.data['comprobante_nombre'] = comprobante["nombre"]
                response.data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
                
                return response
            except IntegrityError as e:
                if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                    intentos += 1
                    continue
                else:
                    raise
        return Response({'detail': 'No se pudo asignar un número único de venta tras varios intentos.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='convertir-a-venta')
    @transaction.atomic
    def convertir_a_venta(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        try:
            if venta.comprobante and (venta.comprobante.tipo == 'presupuesto' or venta.comprobante.nombre.lower().startswith('presupuesto')):
                # === VALIDACIÓN DE CAJA ABIERTA ===
                # Al convertir un presupuesto a factura, se requiere caja abierta
                sesion_caja = obtener_sesion_caja_activa(request.user)
                if not sesion_caja:
                    return Response({
                        'detail': 'Debe abrir una caja antes de convertir el presupuesto a venta.',
                        'error_code': 'CAJA_NO_ABIERTA'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                items = VentaDetalleItem.objects.filter(vdi_idve=venta.ven_id)
                # Obtener configuración de la ferretería para determinar política de stock negativo
                ferreteria = Ferreteria.objects.first()
                # Usar configuración de la ferretería, con posibilidad de override desde el frontend
                permitir_stock_negativo = request.data.get('permitir_stock_negativo', getattr(ferreteria, 'permitir_stock_negativo', False))
                errores_stock = []
                stock_actualizado = []
                for item in items:
                    id_stock = item.vdi_idsto
                    cantidad = Decimal(str(item.vdi_cantidad))
                    if not id_stock:
                        errores_stock.append(f"Falta stock en item: {item.id}")
                        continue
                    
                    # NUEVO: El backend obtiene automáticamente el proveedor habitual del stock
                    id_proveedor = _obtener_proveedor_habitual_stock(id_stock)
                    if not id_proveedor:
                        cod = _obtener_codigo_venta(id_stock)
                        errores_stock.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock})")
                        continue
                    
                    # Descontar distribuyendo entre proveedores si hace falta
                    _descontar_distribuyendo(
                        stock_id=id_stock,
                        proveedor_preferido_id=id_proveedor,
                        cantidad=cantidad,
                        permitir_stock_negativo=permitir_stock_negativo,
                        errores_stock=errores_stock,
                        stock_actualizado=stock_actualizado,
                    )
                if errores_stock:
                    payload = {'detail': 'Error de stock', 'errores': errores_stock}
                    return Response({'detail': str(payload)}, status=status.HTTP_400_BAD_REQUEST)
                cliente = Cliente.objects.filter(id=venta.ven_idcli).first()
                situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
                tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
                comprobante_venta = asignar_comprobante('factura', tipo_iva_cliente)
                if not comprobante_venta:
                    return Response({'detail': 'No se encontró comprobante de tipo factura para la conversión.'}, status=status.HTTP_400_BAD_REQUEST)
                venta.comprobante_id = comprobante_venta["codigo_afip"]
                venta.ven_estado = 'CE'
                # === ASIGNAR SESIÓN DE CAJA ===
                venta.sesion_caja = sesion_caja
                venta.save()
                serializer = self.get_serializer(venta)
                data = serializer.data
                data['stock_actualizado'] = stock_actualizado
                data['comprobante_letra'] = comprobante_venta["letra"]
                data['comprobante_nombre'] = comprobante_venta["nombre"]
                data['comprobante_codigo_afip'] = comprobante_venta["codigo_afip"]
                return Response(data)
            else:
                return Response({'detail': 'Este documento no es un presupuesto o ya fue convertido.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': f'Error al convertir: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # ATENCIÓN: Ya no se calculan ni manipulan campos calculados (ven_impneto, ven_total, etc.) aquí.
        # Toda la lógica de totales y cálculos se delega a la vista SQL.
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        items_data = request.data.get('items', None)
        if items_data is not None:
            try:
                # ATENCIÓN: No calcular totales ni campos calculados aquí.
                # Solo actualizar los ítems base.
                # --- NUEVO: Asignar bonificación general a los ítems sin bonificación particular ---
                bonif_general = request.data.get('bonificacionGeneral', 0)
                try:
                    bonif_general = float(bonif_general)
                except Exception:
                    bonif_general = 0
                for item in items_data:
                    bonif = item.get('vdi_bonifica')
                    if not bonif or float(bonif) == 0:
                        item['vdi_bonifica'] = bonif_general
                # -------------------------------------------------------------------------------
                instance.items.all().delete()
                for item_data in items_data:
                    item_data['vdi_idve'] = instance
                    for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                        item_data.pop(campo_calculado, None)
                    VentaDetalleItem.objects.create(**item_data)
            except Exception as e:
                logging.error(f"Error actualizando ítems de venta: {e}")
                raise

        return Response(serializer.data)


class VentaDetalleItemViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleItem.objects.all()
    serializer_class = VentaDetalleItemSerializer


class VentaDetalleManViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleMan.objects.all()
    serializer_class = VentaDetalleManSerializer


class VentaRemPedViewSet(viewsets.ModelViewSet):
    queryset = VentaRemPed.objects.all()
    serializer_class = VentaRemPedSerializer


class VentaDetalleItemCalculadoFilter(FilterSet):
    vdi_idve = NumberFilter(field_name='vdi_idve')
    
    class Meta:
        model = VentaDetalleItemCalculado
        fields = ['vdi_idve']


class VentaDetalleItemCalculadoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaDetalleItemCalculado.objects.all()
    serializer_class = VentaDetalleItemCalculadoSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = VentaDetalleItemCalculadoFilter


class VentaIVAAlicuotaFilter(FilterSet):
    vdi_idve = NumberFilter(field_name='vdi_idve')
    
    class Meta:
        model = VentaIVAAlicuota
        fields = ['vdi_idve']


class VentaIVAAlicuotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaIVAAlicuota.objects.all()
    serializer_class = VentaIVAAlicuotaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = VentaIVAAlicuotaFilter


class VentaCalculadaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaCalculada.objects.all()
    serializer_class = VentaCalculadaSerializer
