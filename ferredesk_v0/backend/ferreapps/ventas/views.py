from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from django.core.exceptions import ValidationError
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed, VentaDetalleItemCalculado, VentaIVAAlicuota, VentaCalculada
from .serializers import (
    ComprobanteSerializer,
    VentaSerializer,
    VentaDetalleItemSerializer,
    VentaDetalleManSerializer,
    VentaRemPedSerializer,
    VentaDetalleItemCalculadoSerializer,
    VentaIVAAlicuotaSerializer,
    VentaCalculadaSerializer
)
from django.db import transaction
from ferreapps.productos.models import Stock, StockProve
from decimal import Decimal
from ferreapps.productos.models import Ferreteria
from ferreapps.clientes.models import Cliente, TipoIVA
from django.db import IntegrityError
import logging
from rest_framework.permissions import IsAuthenticated

# Configurar logger para este módulo
logger = logging.getLogger(__name__)
from .utils import asignar_comprobante, _construir_respuesta_comprobante
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter, CharFilter

# Importación para integración ARCA automática
from .ARCA import emitir_arca_automatico, debe_emitir_arca, FerreDeskARCAError

# Diccionario de alícuotas (igual que en el frontend)
ALICUOTAS = {
    1: Decimal('0'),  # NO GRAVADO
    2: Decimal('0'),  # EXENTO
    3: Decimal('0'),  # 0%
    4: Decimal('10.5'),
    5: Decimal('21'),
    6: Decimal('27')
}

# Create your views here.

class ComprobanteViewSet(viewsets.ModelViewSet):
    queryset = Comprobante.objects.all()
    serializer_class = ComprobanteSerializer

    @action(detail=False, methods=['post'], url_path='asignar')
    def asignar(self, request):
        tipo_comprobante = request.data.get('tipo_comprobante')
        situacion_iva_cliente = request.data.get('situacion_iva_cliente')
        if not tipo_comprobante or not situacion_iva_cliente:
            return Response({'detail': 'Faltan datos requeridos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            comprobante = asignar_comprobante(tipo_comprobante, situacion_iva_cliente)
            return Response(comprobante)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
                comprobante_tipo__in=['factura', 'venta']  # 'venta' es el tipo de factura interna
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
        if not items:
            return Response({'detail': 'El campo items es requerido y no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)

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

        permitir_stock_negativo = data.get('permitir_stock_negativo', False)
        tipo_comprobante = data.get('tipo_comprobante')
        es_presupuesto = (tipo_comprobante == 'presupuesto')
        es_nota_credito = (tipo_comprobante == 'nota_credito')
        errores_stock = []
        stock_actualizado = []
        if not es_presupuesto:
            for item in items:
                id_stock = item.get('vdi_idsto')
                cantidad = Decimal(str(item.get('vdi_cantidad', 0)))

                # Si el ítem no tiene un ID de stock, es genérico y no participa en la lógica de inventario.
                if not id_stock:
                    continue

                # Si es un producto real, DEBE tener un proveedor.
                id_proveedor = item.get('vdi_idpro')
                if not id_proveedor:
                    errores_stock.append(f"Falta proveedor en item con ID de stock: {id_stock}")
                    continue
                    
                try:
                    stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                except StockProve.DoesNotExist:
                    errores_stock.append(f"No existe stock para el producto {id_stock} y proveedor {id_proveedor}")
                    continue
                
                if es_nota_credito:
                    # Para notas de crédito, el stock se devuelve (suma).
                    stockprove.cantidad += cantidad
                else:
                    # Para ventas normales, el stock se descuenta (resta).
                    if stockprove.cantidad < cantidad and not permitir_stock_negativo:
                        errores_stock.append(f"Stock insuficiente para producto {id_stock} con proveedor {id_proveedor}. Disponible: {stockprove.cantidad}, solicitado: {cantidad}")
                        continue
                    stockprove.cantidad -= cantidad

                stockprove.save()
                stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
            if errores_stock:
                return Response({'detail': 'Error de stock', 'errores': errores_stock}, status=status.HTTP_400_BAD_REQUEST)

        ferreteria = Ferreteria.objects.first()
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
                items = VentaDetalleItem.objects.filter(vdi_idve=venta.ven_id)
                permitir_stock_negativo = request.data.get('permitir_stock_negativo', False)
                errores_stock = []
                stock_actualizado = []
                for item in items:
                    id_stock = item.vdi_idsto
                    id_proveedor = item.vdi_idpro
                    cantidad = Decimal(str(item.vdi_cantidad))
                    if not id_stock or not id_proveedor:
                        errores_stock.append(f"Falta stock o proveedor en item: {item.id}")
                        continue
                    try:
                        stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                    except StockProve.DoesNotExist:
                        errores_stock.append(f"No existe stock para el producto {id_stock} y proveedor {id_proveedor}")
                        continue
                    if stockprove.cantidad < cantidad and not permitir_stock_negativo:
                        errores_stock.append(f"Stock insuficiente para producto {id_stock} con proveedor {id_proveedor}. Disponible: {stockprove.cantidad}, solicitado: {cantidad}")
                        continue
                    stockprove.cantidad -= cantidad
                    stockprove.save()
                    stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                if errores_stock:
                    return Response({'detail': 'Error de stock', 'errores': errores_stock}, status=status.HTTP_400_BAD_REQUEST)
                ferreteria = Ferreteria.objects.first()
                cliente = Cliente.objects.filter(id=venta.ven_idcli).first()
                situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
                tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
                comprobante_venta = asignar_comprobante('factura', tipo_iva_cliente)
                if not comprobante_venta:
                    return Response({'detail': 'No se encontró comprobante de tipo factura para la conversión.'}, status=status.HTTP_400_BAD_REQUEST)
                venta.comprobante_id = comprobante_venta["codigo_afip"]
                venta.ven_estado = 'CE'
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convertir_presupuesto_a_venta(request):
    try:
        with transaction.atomic():
            print("DEBUG - request.data:", request.data)
            print("DEBUG - presupuesto_origen:", request.data.get('presupuesto_origen'), type(request.data.get('presupuesto_origen')))
            print("DEBUG - items_seleccionados:", request.data.get('items_seleccionados'), type(request.data.get('items_seleccionados')))
            data = request.data
            presupuesto_id = data.get('presupuesto_origen')
            items_seleccionados = data.get('items_seleccionados', [])
            venta_data = data.copy()
            venta_data.pop('presupuesto_origen', None)
            venta_data.pop('items_seleccionados', None)

            if not presupuesto_id or not items_seleccionados:
                raise Exception('Faltan datos de presupuesto o ítems seleccionados.')

            print("DEBUG - INICIO BLOQUE ATOMICO")
            # Obtener el presupuesto con bloqueo
            presupuesto = Venta.objects.select_for_update().get(ven_id=presupuesto_id)
            print("DEBUG - Presupuesto obtenido:", presupuesto)
            # Validar que es un presupuesto (estado AB)
            if presupuesto.ven_estado != 'AB':
                print("DEBUG - Presupuesto no está en estado AB")
                raise Exception('Solo se pueden convertir presupuestos (estado AB).')

            # Obtener items del presupuesto
            items_presupuesto = list(presupuesto.items.all())
            ids_items_presupuesto = [str(item.id) for item in items_presupuesto]
            print("DEBUG - IDs items presupuesto:", ids_items_presupuesto)
            # Validar que los ítems seleccionados pertenecen al presupuesto
            if not all(str(i) in ids_items_presupuesto for i in items_seleccionados):
                print("DEBUG - Algunos ítems seleccionados no pertenecen al presupuesto")
                raise Exception('Algunos ítems seleccionados no pertenecen al presupuesto.')

            # Validar stock si es necesario
            permitir_stock_negativo = data.get('permitir_stock_negativo', False)
            items_editados = {str(item.get('id')): item for item in data.get('items', [])}
            if not permitir_stock_negativo:
                errores_stock = []
                for item_id in items_seleccionados:
                    item_editado = items_editados.get(str(item_id))
                    if not item_editado:
                        continue
                    try:
                        stockprove = StockProve.objects.select_for_update().get(
                            stock_id=item_editado.get('vdi_idsto'),
                            proveedor_id=item_editado.get('vdi_idpro')
                        )
                        cantidad = item_editado.get('vdi_cantidad', 0)
                        if stockprove.cantidad < cantidad:
                            errores_stock.append(
                                f"Stock insuficiente para producto {item_editado.get('vdi_idsto')} con proveedor {item_editado.get('vdi_idpro')}. "
                                f"Disponible: {stockprove.cantidad}, solicitado: {cantidad}"
                            )
                    except StockProve.DoesNotExist:
                        errores_stock.append(
                            f"No existe stock para el producto {item_editado.get('vdi_idsto')} y proveedor {item_editado.get('vdi_idpro')}"
                        )
                if errores_stock:
                    print("DEBUG - Errores de stock:", errores_stock)
                    raise Exception({'detail': 'Error de stock', 'errores': errores_stock})

            # Preparar datos de la venta
            venta_data['ven_estado'] = 'CE'  # Estado Venta
            venta_data['ven_tipo'] = 'Venta'  # Tipo Venta

            # --- Lógica de numeración robusta ---
            punto_venta = venta_data.get('ven_punto')
            tipo_comprobante = venta_data.get('tipo_comprobante')
            if not punto_venta or not tipo_comprobante:
                print("DEBUG - Falta punto de venta o tipo de comprobante")
                raise Exception('El punto de venta y tipo de comprobante son requeridos')

            # Obtener la situación fiscal de la ferretería y el cliente
            ferreteria = Ferreteria.objects.first()
            cliente = Cliente.objects.get(id=venta_data.get('ven_idcli'))
            situacion_iva_ferreteria = ferreteria.situacion_iva
            tipo_iva_cliente = cliente.iva.nombre.strip().lower()

            # Usar asignar_comprobante para determinar el comprobante correcto
            comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
            venta_data['comprobante_id'] = comprobante['codigo_afip']

            # --- Asignar bonificación general a los ítems sin bonificación particular ---
            bonif_general = venta_data.get('bonificacionGeneral', 0)
            try:
                bonif_general = float(bonif_general)
            except Exception:
                bonif_general = 0
            for item in venta_data.get('items', []):
                bonif = item.get('vdi_bonifica')
                if not bonif or float(bonif) == 0:
                    item['vdi_bonifica'] = bonif_general

            intentos = 0
            max_intentos = 10
            venta = None
            print("LOG: Antes de crear la venta")
            while intentos < max_intentos:
                ultima_venta = Venta.objects.filter(
                    ven_punto=punto_venta,
                    comprobante_id=comprobante['codigo_afip']
                ).order_by('-ven_numero').first()
                nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
                venta_data['ven_numero'] = nuevo_numero
                venta_serializer = VentaSerializer(data=venta_data)
                try:
                    venta_serializer.is_valid(raise_exception=True)
                    venta = venta_serializer.save()
                    print(f"LOG: Venta creada con ID {venta.pk}")
                    break
                except IntegrityError as e:
                    if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                        intentos += 1
                        continue  # Reintentar con el siguiente número
                    else:
                        print("DEBUG - Error de integridad:", e)
                        raise
            else:
                print("DEBUG - No se pudo asignar un número único de venta tras varios intentos.")
                raise Exception('No se pudo asignar un número único de venta tras varios intentos.')

            print("LOG: Antes de editar/eliminar el presupuesto")
            # Convertir ambos arrays de IDs a int para comparar correctamente
            ids_items_presupuesto_int = [int(i.id) for i in items_presupuesto]
            items_seleccionados_int = [int(i) for i in items_seleccionados]
            print(f"DEBUG - ids_items_presupuesto_int: {ids_items_presupuesto_int} (type: {type(ids_items_presupuesto_int[0]) if ids_items_presupuesto_int else None})")
            print(f"DEBUG - items_seleccionados_int: {items_seleccionados_int} (type: {type(items_seleccionados_int[0]) if items_seleccionados_int else None})")
            if set(items_seleccionados_int) == set(ids_items_presupuesto_int):
                print("DEBUG - Se seleccionaron todos los ítems, eliminando presupuesto")
                presupuesto.delete()
                print("LOG: Presupuesto eliminado")
                presupuesto_result = None
            else:
                print("DEBUG - Se dejan ítems no seleccionados en el presupuesto")
                items_restantes = [item for item in items_presupuesto if int(item.id) not in items_seleccionados_int]
                presupuesto.items.set(items_restantes)
                # Eliminar físicamente los ítems seleccionados del presupuesto
                ids_a_eliminar = [item.id for item in items_presupuesto if int(item.id) in items_seleccionados_int]
                if ids_a_eliminar:
                    VentaDetalleItem.objects.filter(id__in=ids_a_eliminar).delete()
                # Si no quedan ítems, eliminar el presupuesto
                if not items_restantes:
                    print("LOG: Presupuesto quedó vacío tras conversión, eliminando presupuesto")
                    presupuesto.delete()
                    presupuesto_result = None
                else:
                    # Recalcular totales y guardar
                    recalcular_totales_presupuesto(presupuesto)
                    presupuesto.save()
                    presupuesto_result = VentaSerializer(presupuesto).data

            print("LOG: Antes de actualizar stock")
            # Actualizar stock
            stock_actualizado = []
            for item_id in items_seleccionados:
                item_editado = items_editados.get(str(item_id))
                if not item_editado:
                    continue
                try:
                    stockprove = StockProve.objects.select_for_update().get(
                        stock_id=item_editado.get('vdi_idsto'),
                        proveedor_id=item_editado.get('vdi_idpro')
                    )
                    cantidad = item_editado.get('vdi_cantidad', 0)
                    stockprove.cantidad -= cantidad
                    stockprove.save()
                    stock_actualizado.append({
                        'stock_id': stockprove.stock_id,
                        'proveedor_id': stockprove.proveedor_id,
                        'cantidad_actual': stockprove.cantidad
                    })
                except StockProve.DoesNotExist:
                    print(f"DEBUG - No se encontró stock para el item {item_id}")
                    continue

            # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
            if debe_emitir_arca(tipo_comprobante):
                try:
                    logger.info(f"Emisión automática ARCA para conversión presupuesto {presupuesto.id} a venta {venta.ven_id} - tipo: {tipo_comprobante}")
                    resultado_arca = emitir_arca_automatico(venta)
                    
                    # Agregar información ARCA a la respuesta
                    response_data = {
                        'venta': VentaSerializer(venta).data,
                        'presupuesto': presupuesto_result,
                        'stock_actualizado': stock_actualizado,
                        'comprobante_letra': comprobante['letra'],
                        'comprobante_nombre': comprobante['nombre'],
                        'comprobante_codigo_afip': comprobante['codigo_afip'],
                        'arca_emitido': True,
                        'cae': resultado_arca.get('resultado', {}).get('cae'),
                        'cae_vencimiento': resultado_arca.get('resultado', {}).get('cae_vencimiento'),
                        'qr_generado': resultado_arca.get('resultado', {}).get('qr_generado', False),
                        'observaciones': resultado_arca.get('resultado', {}).get('observaciones', [])
                    }
                    
                    logger.info(f"Emisión ARCA exitosa para conversión presupuesto {presupuesto.id} a venta {venta.ven_id}: CAE {resultado_arca.get('resultado', {}).get('cae')}")
                    
                except Exception as e:
                    # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
                    logger.error(f"Error en emisión automática ARCA para conversión presupuesto {presupuesto.id} a venta {venta.ven_id}: {e}")
                    raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
            else:
                # Comprobante interno - no requiere emisión ARCA
                response_data = {
                    'venta': VentaSerializer(venta).data,
                    'presupuesto': presupuesto_result,
                    'stock_actualizado': stock_actualizado,
                    'comprobante_letra': comprobante['letra'],
                    'comprobante_nombre': comprobante['nombre'],
                    'comprobante_codigo_afip': comprobante['codigo_afip'],
                    'arca_emitido': False,
                    'arca_motivo': 'Comprobante interno - no requiere emisión ARCA'
                }
            
            return Response(response_data)

    except Exception as e:
        print("DEBUG - Error en convertir_presupuesto_a_venta:", str(e))
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

def recalcular_totales_presupuesto(presupuesto):
    """Recalcula `ven_impneto` y `ven_total` tomando los ítems reales del presupuesto.

    IMPORTANTE:
    • Los campos **vdi_importe** o **vdi_importe_total** no existen en el modelo *VentaDetalleItem*;
      sólo están presentes en la vista SQL de items calculados.  Por eso se reproduce aquí la
      misma fórmula empleando los campos persistentes (`vdi_costo`, `vdi_margen`, `vdi_bonifica`, `vdi_cantidad`).
    • En los presupuestos el IVA no se discrimina.  Por lo tanto **ven_total = ven_impneto**.
    """

    items_restantes = list(presupuesto.items.all())
    if not items_restantes:
        presupuesto.ven_impneto = Decimal('0.00')
        presupuesto.ven_total = Decimal('0.00')
        return

    subtotal_bruto = Decimal('0')

    for item in items_restantes:
        # 1) Precio de lista = costo + margen
        precio_lista = Decimal(item.vdi_costo or 0) * (Decimal('1') + Decimal(item.vdi_margen or 0) / Decimal('100'))

        # 2) Aplicar bonificación particular del ítem
        precio_bonificado = precio_lista * (Decimal('1') - Decimal(item.vdi_bonifica or 0) / Decimal('100'))

        # 3) Importe total del ítem = precio bonificado por cantidad
        importe_item = precio_bonificado * Decimal(item.vdi_cantidad or 0)

        subtotal_bruto += importe_item

    # ---- Aplicar bonificación/desc. generales del presupuesto ----
    bonif_general = Decimal(presupuesto.ven_bonificacion_general or 0)
    desc1 = Decimal(presupuesto.ven_descu1 or 0)
    desc2 = Decimal(presupuesto.ven_descu2 or 0)
    desc3 = Decimal(presupuesto.ven_descu3 or 0)

    neto = subtotal_bruto

    if bonif_general:
        neto *= (Decimal('1') - bonif_general / Decimal('100'))
    if desc1:
        neto *= (Decimal('1') - desc1 / Decimal('100'))
    if desc2:
        neto *= (Decimal('1') - desc2 / Decimal('100'))
    if desc3:
        neto *= (Decimal('1') - desc3 / Decimal('100'))

    # En la etapa de presupuesto no se agrega IVA
    presupuesto.ven_impneto = neto.quantize(Decimal('0.01'))
    presupuesto.ven_total = neto.quantize(Decimal('0.01'))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def convertir_factura_interna_a_fiscal(request):
    """
    Convierte una factura interna a factura fiscal.
    Diferencia clave: items originales NO descontan stock nuevamente.
    """
    try:
        data = request.data
        factura_interna_id = data.get('factura_interna_origen')
        items_seleccionados = data.get('items_seleccionados', [])
        tipo_conversion = data.get('tipo_conversion')
        
        # Validar tipo de conversión
        if tipo_conversion != 'factura_i_factura':
            return Response({'detail': 'Tipo de conversión inválido'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener factura interna original
        try:
            factura_interna = Venta.objects.select_for_update().get(
                ven_id=factura_interna_id,
                comprobante__tipo='factura_interna'
            )
        except Venta.DoesNotExist:
            return Response({'detail': 'Factura interna no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        # Preparar datos de la nueva factura fiscal (IDÉNTICO A VENTAFORM)
        venta_data = data.copy()
        venta_data.pop('factura_interna_origen', None)
        venta_data.pop('items_seleccionados', None)
        venta_data.pop('tipo_conversion', None)
        venta_data.pop('conversion_metadata', None)
        
        venta_data['ven_estado'] = 'CE'  # Estado Cerrado para factura fiscal
        
        # === USAR EL MISMO FLUJO QUE VentaViewSet.create() ===
        
        items = venta_data.get('items', [])
        if not items:
            return Response({'detail': 'El campo items es requerido y no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Asignar bonificación general a los ítems sin bonificación particular ---
        bonif_general = venta_data.get('bonificacionGeneral', 0)
        try:
            bonif_general = float(bonif_general)
        except Exception:
            bonif_general = 0
        for item in items:
            bonif = item.get('vdi_bonifica')
            if not bonif or float(bonif) == 0:
                item['vdi_bonifica'] = bonif_general

        # === LÓGICA DIFERENCIADA DE STOCK PARA CONVERSIONES ===
        # CORREGIDO: Consultar configuración de la ferretería para stock negativo
        ferreteria = Ferreteria.objects.first()
        permitir_stock_negativo = getattr(ferreteria, 'permitir_stock_negativo', False)
        
        tipo_comprobante = venta_data.get('tipo_comprobante')
        es_presupuesto = (tipo_comprobante == 'presupuesto')
        es_nota_credito = (tipo_comprobante == 'nota_credito')
        errores_stock = []
        stock_actualizado = []
        
        if not es_presupuesto:
            for item in items:
                id_stock = item.get('vdi_idsto')
                cantidad = Decimal(str(item.get('vdi_cantidad', 0)))

                # Si el ítem no tiene un ID de stock, es genérico y no participa en la lógica de inventario.
                if not id_stock:
                    continue

                # NUEVO: Si tiene idOriginal, proviene de factura interna - NO descontar stock
                if item.get('idOriginal'):
                    print(f"LOG: Item original {item.get('idOriginal')} - NO descuenta stock")
                    continue

                # Si es un producto real NUEVO, DEBE tener un proveedor y SÍ descontamos stock.
                id_proveedor = item.get('vdi_idpro')
                if not id_proveedor:
                    errores_stock.append(f"Falta proveedor en item con ID de stock: {id_stock}")
                    continue
                    
                try:
                    stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                except StockProve.DoesNotExist:
                    errores_stock.append(f"No existe stock para el producto {id_stock} y proveedor {id_proveedor}")
                    continue
                
                if es_nota_credito:
                    # Para notas de crédito, el stock se devuelve (suma).
                    stockprove.cantidad += cantidad
                else:
                    # Para ventas normales, el stock se descuenta (resta).
                    if stockprove.cantidad < cantidad and not permitir_stock_negativo:
                        errores_stock.append(f"Stock insuficiente para producto {id_stock} con proveedor {id_proveedor}. Disponible: {stockprove.cantidad}, solicitado: {cantidad}")
                        continue
                    stockprove.cantidad -= cantidad

                stockprove.save()
                stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                print(f"LOG: Item nuevo - Stock descontado: {cantidad} para stock_id {id_stock}")
                
            if errores_stock:
                return Response({'detail': 'Error de stock', 'errores': errores_stock}, status=status.HTTP_400_BAD_REQUEST)

        # === LÓGICA DE COMPROBANTE (IDÉNTICA AL MÉTODO CREATE) ===
        cliente_id = venta_data.get('ven_idcli')
        cliente = Cliente.objects.filter(id=cliente_id).first()
        situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
        tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
        
        # Obtener el comprobante apropiado según el tipo y cliente
        comprobante_id_enviado = venta_data.get('comprobante_id')
        
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
        
        venta_data['comprobante_id'] = comprobante["codigo_afip"]

        # === LÓGICA DE NUMERACIÓN (IDÉNTICA AL MÉTODO CREATE) ===
        punto_venta = venta_data.get('ven_punto')
        if not punto_venta:
            return Response({'detail': 'El punto de venta es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        intentos = 0
        max_intentos = 10
        nueva_factura = None
        
        while intentos < max_intentos:
            ultima_venta = Venta.objects.filter(
                ven_punto=punto_venta,
                comprobante_id=comprobante["codigo_afip"]
            ).order_by('-ven_numero').first()
            nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
            venta_data['ven_numero'] = nuevo_numero
            
            # === USAR VENTASERIALIZER EXACTAMENTE COMO EN CREATE() ===
            venta_serializer = VentaSerializer(data=venta_data)
            try:
                venta_serializer.is_valid(raise_exception=True)
                
                # DEBUGGING: Log detallado de los items antes de guardar
                items_debug = venta_data.get('items', [])
                print(f"DEBUG - Total items a procesar: {len(items_debug)}")
                for i, item in enumerate(items_debug):
                    print(f"DEBUG - Item {i}: vdi_precio_unitario_final = {item.get('vdi_precio_unitario_final')}")
                    print(f"DEBUG - Item {i}: precioFinal = {item.get('precioFinal')}")
                    print(f"DEBUG - Item {i}: idOriginal = {item.get('idOriginal')}")
                
                nueva_factura = venta_serializer.save()
                print(f"LOG: Factura fiscal creada con ID {nueva_factura.pk}")
                break
            except IntegrityError as e:
                if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                    intentos += 1
                    continue  # Reintentar con el siguiente número
                else:
                    print("DEBUG - Error de integridad:", e)
                    raise
        else:
            print("DEBUG - No se pudo asignar un número único de factura tras varios intentos.")
            return Response({'detail': 'No se pudo asignar un número único de factura tras varios intentos.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        print("LOG: Antes de gestionar la factura interna original")
        
        # === LÓGICA DE GESTIÓN DE FACTURA INTERNA (igual que presupuestos) ===
        
        # Obtener items de la factura interna
        items_factura_interna = list(factura_interna.items.all())
        ids_items_factura_interna = [str(item.id) for item in items_factura_interna]
        print(f"DEBUG - IDs items factura interna: {ids_items_factura_interna}")
        
        # Validar que los ítems seleccionados pertenecen a la factura interna
        if not all(str(i) in ids_items_factura_interna for i in items_seleccionados):
            print("DEBUG - Algunos ítems seleccionados no pertenecen a la factura interna")
            return Response({'detail': 'Algunos ítems seleccionados no pertenecen a la factura interna.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Convertir ambos arrays de IDs a int para comparar correctamente
        ids_items_factura_interna_int = [int(i.id) for i in items_factura_interna]
        items_seleccionados_int = [int(i) for i in items_seleccionados]
        print(f"DEBUG - ids_items_factura_interna_int: {ids_items_factura_interna_int}")
        print(f"DEBUG - items_seleccionados_int: {items_seleccionados_int}")
        
        # === LÓGICA DE GESTIÓN DE FACTURA INTERNA (igual que presupuestos) ===
        if set(items_seleccionados_int) == set(ids_items_factura_interna_int):
            print("DEBUG - Se seleccionaron todos los ítems, eliminando factura interna")
            factura_interna.delete()
            print("LOG: Factura interna eliminada")
            factura_interna_result = None
        else:
            print("DEBUG - Se dejan ítems no seleccionados en la factura interna")
            items_restantes = [item for item in items_factura_interna if int(item.id) not in items_seleccionados_int]
            factura_interna.items.set(items_restantes)
            # Eliminar físicamente los ítems seleccionados de la factura interna
            ids_a_eliminar = [item.id for item in items_factura_interna if int(item.id) in items_seleccionados_int]
            if ids_a_eliminar:
                VentaDetalleItem.objects.filter(id__in=ids_a_eliminar).delete()
            # Si no quedan ítems, eliminar la factura interna
            if not items_restantes:
                print("LOG: Factura interna quedó vacía tras conversión, eliminando factura interna")
                factura_interna.delete()
                factura_interna_result = None
            else:
                # Recalcular totales y guardar (usando la misma función que presupuestos)
                recalcular_totales_presupuesto(factura_interna)  # Funciona igual para facturas internas
                factura_interna.save()
                factura_interna_result = VentaSerializer(factura_interna).data
        
        # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
        if debe_emitir_arca(tipo_comprobante):
            try:
                logger.info(f"Emisión automática ARCA para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id} - tipo: {tipo_comprobante}")
                resultado_arca = emitir_arca_automatico(nueva_factura)
                
                # Agregar información ARCA a la respuesta
                response_data = VentaSerializer(nueva_factura).data
                response_data['stock_actualizado'] = stock_actualizado
                response_data['comprobante_letra'] = comprobante["letra"]
                response_data['comprobante_nombre'] = comprobante["nombre"]
                response_data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
                response_data['factura_interna'] = factura_interna_result
                response_data['arca_emitido'] = True
                response_data['cae'] = resultado_arca.get('resultado', {}).get('cae')
                response_data['cae_vencimiento'] = resultado_arca.get('resultado', {}).get('cae_vencimiento')
                response_data['qr_generado'] = resultado_arca.get('resultado', {}).get('qr_generado', False)
                response_data['observaciones'] = resultado_arca.get('resultado', {}).get('observaciones', [])
                
                logger.info(f"Emisión ARCA exitosa para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id}: CAE {resultado_arca.get('resultado', {}).get('cae')}")
                
            except Exception as e:
                # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
                logger.error(f"Error en emisión automática ARCA para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id}: {e}")
                raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
        else:
            # Comprobante interno - no requiere emisión ARCA
            response_data = VentaSerializer(nueva_factura).data
            response_data['stock_actualizado'] = stock_actualizado
            response_data['comprobante_letra'] = comprobante["letra"]
            response_data['comprobante_nombre'] = comprobante["nombre"]
            response_data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
            response_data['factura_interna'] = factura_interna_result
            response_data['arca_emitido'] = False
            response_data['arca_motivo'] = 'Comprobante interno - no requiere emisión ARCA'
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print("DEBUG - Error en convertir_factura_interna_a_fiscal:", str(e))
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)



# Dashboard endpoints
from django.http import JsonResponse
from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
import json

def productos_mas_vendidos(request):
    """Endpoint para obtener los productos más vendidos"""
    tipo = request.GET.get('tipo', 'cantidad')  # 'cantidad' o 'total'
    
    try:
        with connection.cursor() as cursor:
            if tipo == 'cantidad':
                # Agrupar por producto y sumar cantidades
                query = """
                SELECT 
                    COALESCE(vdi.vdi_detalle1, 'Producto sin nombre') as producto,
                    SUM(vdi.vdi_cantidad) as total_cantidad
                FROM VENTADETALLEITEM_CALCULADO vdi
                WHERE vdi.vdi_cantidad > 0
                GROUP BY vdi.vdi_detalle1
                ORDER BY total_cantidad DESC
                LIMIT 10
                """
            else:
                # Agrupar por producto y sumar totales facturados
                query = """
                SELECT 
                    COALESCE(vdi.vdi_detalle1, 'Producto sin nombre') as producto,
                    SUM(vdi.total_item) as total_facturado
                FROM VENTADETALLEITEM_CALCULADO vdi
                WHERE vdi.total_item > 0
                GROUP BY vdi.vdi_detalle1
                ORDER BY total_facturado DESC
                LIMIT 10
                """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            if not results:
                return JsonResponse({
                    'labels': [],
                    'datasets': [{
                        'label': 'Cantidad Vendida' if tipo == 'cantidad' else 'Total Facturado ($)',
                        'data': [],
                        'backgroundColor': 'rgba(59, 130, 246, 0.8)',
                        'borderColor': 'rgba(59, 130, 246, 1)',
                        'borderWidth': 1,
                        'borderRadius': 4,
                    }]
                })
            
            labels = [row[0] for row in results]
            data = [float(row[1]) for row in results]
            
            return JsonResponse({
                'labels': labels,
                'datasets': [{
                    'label': 'Cantidad Vendida' if tipo == 'cantidad' else 'Total Facturado ($)',
                    'data': data,
                    'backgroundColor': 'rgba(59, 130, 246, 0.8)',
                    'borderColor': 'rgba(59, 130, 246, 1)',
                    'borderWidth': 1,
                    'borderRadius': 4,
                }]
            })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def ventas_por_dia(request):
    """Endpoint para obtener las ventas por día"""
    periodo = request.GET.get('periodo', '7d')
    
    # Calcular fechas según el período
    hoy = timezone.now().date()
    if periodo == '7d':
        fecha_inicio = hoy - timedelta(days=7)
    elif periodo == '30d':
        fecha_inicio = hoy - timedelta(days=30)
    elif periodo == '90d':
        fecha_inicio = hoy - timedelta(days=90)
    elif periodo == '1y':
        fecha_inicio = hoy - timedelta(days=365)
    else:
        fecha_inicio = hoy - timedelta(days=7)
    
    try:
        with connection.cursor() as cursor:
            query = """
            SELECT 
                DATE(vc.ven_fecha) as fecha,
                SUM(vc.ven_total) as total_ventas
            FROM VENTA_CALCULADO vc
            WHERE vc.ven_fecha >= %s AND vc.ven_fecha <= %s
            GROUP BY DATE(vc.ven_fecha)
            ORDER BY fecha
            """
            
            cursor.execute(query, [fecha_inicio, hoy])
            results = cursor.fetchall()
            
            if not results:
                return JsonResponse({
                    'labels': [],
                    'datasets': [{
                        'label': 'Ventas Diarias ($)',
                        'data': [],
                        'borderColor': 'rgba(34, 197, 94, 1)',
                        'backgroundColor': 'rgba(34, 197, 94, 0.1)',
                        'borderWidth': 3,
                        'fill': True,
                        'tension': 0.4,
                        'pointBackgroundColor': 'rgba(34, 197, 94, 1)',
                        'pointBorderColor': '#ffffff',
                        'pointBorderWidth': 2,
                        'pointRadius': 6,
                        'pointHoverRadius': 8,
                    }]
                })
            
            # Procesar resultados reales
            fechas = []
            ventas = []
            for row in results:
                fecha = row[0]
                if isinstance(fecha, str):
                    fecha = datetime.strptime(fecha, '%Y-%m-%d').date()
                fechas.append(fecha.strftime('%d/%m'))
                ventas.append(float(row[1]))
            
            return JsonResponse({
                'labels': fechas,
                'datasets': [{
                    'label': 'Ventas Diarias ($)',
                    'data': ventas,
                    'borderColor': 'rgba(34, 197, 94, 1)',
                    'backgroundColor': 'rgba(34, 197, 94, 0.1)',
                    'borderWidth': 3,
                    'fill': True,
                    'tension': 0.4,
                    'pointBackgroundColor': 'rgba(34, 197, 94, 1)',
                    'pointBorderColor': '#ffffff',
                    'pointBorderWidth': 2,
                    'pointRadius': 6,
                    'pointHoverRadius': 8,
                }]
            })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def clientes_mas_ventas(request):
    """Endpoint para obtener los clientes con más ventas"""
    tipo = request.GET.get('tipo', 'total')  # 'total', 'cantidad', 'frecuencia'
    
    try:
        with connection.cursor() as cursor:
            if tipo == 'total':
                # Agrupar por cliente y sumar totales facturados
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    SUM(vc.ven_total) as total_facturado
                FROM VENTA_CALCULADO vc
                WHERE vc.ven_total > 0
                GROUP BY vc.cliente_razon
                ORDER BY total_facturado DESC
                LIMIT 10
                """
            elif tipo == 'cantidad':
                # Agrupar por cliente y sumar cantidad de productos
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    SUM(vdi.vdi_cantidad) as total_productos
                FROM VENTADETALLEITEM_CALCULADO vdi
                JOIN VENTA_CALCULADO vc ON vdi.vdi_idve = vc.ven_id
                WHERE vdi.vdi_cantidad > 0
                GROUP BY vc.cliente_razon
                ORDER BY total_productos DESC
                LIMIT 10
                """
            else:  # frecuencia
                # Agrupar por cliente y contar número de compras
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    COUNT(DISTINCT vc.ven_id) as frecuencia_compras
                FROM VENTA_CALCULADO vc
                WHERE vc.ven_total > 0
                GROUP BY vc.cliente_razon
                ORDER BY frecuencia_compras DESC
                LIMIT 10
                """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            if not results:
                return JsonResponse({
                    'labels': [],
                    'datasets': [{
                        'label': 'Total Facturado ($)' if tipo == 'total' else 'Cantidad de Productos' if tipo == 'cantidad' else 'Frecuencia de Compras',
                        'data': [],
                        'backgroundColor': 'rgba(168, 85, 247, 0.8)',
                        'borderColor': 'rgba(168, 85, 247, 1)',
                        'borderWidth': 1,
                        'borderRadius': 4,
                    }]
                })
            
            labels = [row[0] for row in results]
            data = [float(row[1]) for row in results]
            
            return JsonResponse({
                'labels': labels,
                'datasets': [{
                    'label': 'Total Facturado ($)' if tipo == 'total' else 'Cantidad de Productos' if tipo == 'cantidad' else 'Frecuencia de Compras',
                    'data': data,
                    'backgroundColor': 'rgba(168, 85, 247, 0.8)',
                    'borderColor': 'rgba(168, 85, 247, 1)',
                    'borderWidth': 1,
                    'borderRadius': 4,
                }]
            })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


