"""
Serializers para cheques.

Este módulo contiene todos los serializers relacionados con cheques:
- ChequeSerializer: Serializador base para cheques (valores en cartera e historial)
- ChequeDetalleSerializer: Para vista detalle con historial completo
- ChequeUpdateSerializer: Para edición de datos del cheque
"""

from decimal import Decimal

from rest_framework import serializers
from datetime import timedelta
from django.utils import timezone

from ..models import Cheque


class ChequeSerializer(serializers.ModelSerializer):
    """Serializador para cheques (valores en cartera e historial)."""

    venta_id = serializers.IntegerField(source='venta.id', read_only=True)
    pago_venta_id = serializers.IntegerField(source='pago_venta.id', read_only=True)
    cuenta_banco_deposito_nombre = serializers.CharField(source='cuenta_banco_deposito.nombre', read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.razon', read_only=True)
    nota_debito_venta_id = serializers.SerializerMethodField()
    nota_debito_numero_formateado = serializers.SerializerMethodField()
    cliente_origen = serializers.SerializerMethodField()
    origen_tipo = serializers.CharField(read_only=True)
    origen_cliente_nombre = serializers.CharField(
        source='origen_cliente.razon', read_only=True, allow_null=True
    )
    origen_descripcion = serializers.CharField(read_only=True, allow_null=True)
    movimiento_caja_entrada_id = serializers.SerializerMethodField()
    movimiento_caja_salida_id = serializers.SerializerMethodField()
    comision_cambio = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = Cheque
        fields = [
            'id',
            'numero',
            'banco_emisor',
            'monto',
            'cuit_librador',
            'fecha_emision',
            'fecha_presentacion',
            'estado',
            'venta_id',
            'pago_venta_id',
            'cuenta_banco_deposito',
            'cuenta_banco_deposito_nombre',
            'proveedor',
            'proveedor_nombre',
            'usuario_registro',
            'fecha_hora_registro',
            'nota_debito_venta_id',
            'nota_debito_numero_formateado',
            'cliente_origen',
            'origen_tipo',
            'origen_cliente_nombre',
            'origen_descripcion',
            'movimiento_caja_entrada_id',
            'movimiento_caja_salida_id',
            'comision_cambio',
        ]
        read_only_fields = [
            'id',
            'estado',
            'venta_id',
            'pago_venta_id',
            'cuenta_banco_deposito_nombre',
            'proveedor_nombre',
            'usuario_registro',
            'fecha_hora_registro',
        ]

    def get_nota_debito_venta_id(self, obj):
        """ID de la venta ND vinculada (usa la FK directa para no depender de la relación cargada)."""
        return getattr(obj, 'nota_debito_venta_id', None)

    def get_nota_debito_numero_formateado(self, obj):
        """Número formateado de la ND vinculada (ej. A 0001-00000012) si existe."""
        nd = obj.nota_debito_venta
        if not nd:
            return None
        letra = (nd.comprobante.letra or '').strip() if nd.comprobante else ''
        if nd.ven_punto is not None and nd.ven_numero is not None:
            return f"{letra} {nd.ven_punto:04d}-{nd.ven_numero:08d}".strip()
        return str(nd.ven_id)

    def get_cliente_origen(self, obj):
        """Nombre o razón social del cliente de la venta de origen (si existe)."""
        venta = obj.venta
        if not venta or not venta.ven_idcli:
            return None
        cliente = venta.ven_idcli
        return getattr(cliente, 'razon', None) or getattr(cliente, 'nombre', None) or str(cliente)

    def get_movimiento_caja_entrada_id(self, obj):
        """ID del movimiento de caja de entrada (null si el cheque no viene de caja)."""
        return getattr(obj.movimiento_caja_entrada, 'id', None) if obj.movimiento_caja_entrada else None

    def get_movimiento_caja_salida_id(self, obj):
        """ID del movimiento de caja de salida (null si no es cambio de cheque)."""
        return getattr(obj.movimiento_caja_salida, 'id', None) if obj.movimiento_caja_salida else None


class ChequeDetalleSerializer(ChequeSerializer):
    """Serializer para vista detalle del cheque con historial completo.
    
    Extiende ChequeSerializer agregando:
    - historial_estados: Array con cambios de estado del cheque
    - fecha_vencimiento_calculada: fecha_presentacion + 30 días
    - dias_hasta_vencimiento: Diferencia en días con la fecha actual
    """
    
    historial_estados = serializers.SerializerMethodField()
    fecha_vencimiento_calculada = serializers.SerializerMethodField()
    dias_hasta_vencimiento = serializers.SerializerMethodField()
    
    class Meta(ChequeSerializer.Meta):
        fields = ChequeSerializer.Meta.fields + [
            'historial_estados',
            'fecha_vencimiento_calculada',
            'dias_hasta_vencimiento',
        ]
    
    def get_historial_estados(self, obj):
        """Construye el historial de cambios de estado del cheque.
        
        El historial se construye desde campos del modelo (no hay tabla de auditoría),
        por lo que puede ser aproximado. Incluye:
        - Registro inicial (EN_CARTERA)
        - Depósito (si tiene cuenta_banco_deposito)
        - Endoso (si tiene proveedor)
        - Rechazo (si tiene nota_debito_venta o estado RECHAZADO)
        - Reactivación (si volvió a EN_CARTERA desde RECHAZADO)
        """
        historial = []
        
        # Registro inicial
        historial.append({
            'estado': Cheque.ESTADO_EN_CARTERA,
            'estado_display': 'En cartera',
            'fecha': obj.fecha_hora_registro.date() if obj.fecha_hora_registro else None,
            'fecha_hora': obj.fecha_hora_registro.isoformat() if obj.fecha_hora_registro else None,
            'usuario': obj.usuario_registro.username if obj.usuario_registro else None,
            'descripcion': 'Cheque registrado en cartera',
        })
        
        # Depósito (si tiene cuenta_banco_deposito)
        if obj.cuenta_banco_deposito:
            historial.append({
                'estado': Cheque.ESTADO_DEPOSITADO,
                'estado_display': 'Depositado',
                'fecha': obj.fecha_presentacion,  # Usar fecha_presentacion como aproximación
                'fecha_hora': None,  # No hay timestamp exacto del depósito
                'usuario': None,
                'descripcion': f'Depositado en {obj.cuenta_banco_deposito.nombre}',
            })
        
        # Endoso (si tiene proveedor)
        if obj.proveedor:
            historial.append({
                'estado': Cheque.ESTADO_ENTREGADO,
                'estado_display': 'Entregado',
                'fecha': obj.fecha_presentacion,  # Usar fecha_presentacion como aproximación
                'fecha_hora': None,  # No hay timestamp exacto del endoso
                'usuario': None,
                'descripcion': f'Endosado a {obj.proveedor.razon}',
            })
        
        # Rechazo (si tiene nota_debito_venta o estado RECHAZADO)
        if obj.estado == Cheque.ESTADO_RECHAZADO:
            if obj.nota_debito_venta:
                fecha_rechazo = obj.nota_debito_venta.ven_fecha if hasattr(obj.nota_debito_venta, 'ven_fecha') else None
                descripcion = 'Cheque rechazado (ND generada)'
            else:
                fecha_rechazo = None
                descripcion = 'Cheque rechazado manualmente'
            
            historial.append({
                'estado': Cheque.ESTADO_RECHAZADO,
                'estado_display': 'Rechazado',
                'fecha': fecha_rechazo,
                'fecha_hora': None,
                'usuario': None,
                'descripcion': descripcion,
            })
        
        # Ordenar por fecha (más antiguo primero)
        historial.sort(key=lambda x: x['fecha'] or timezone.now().date())
        
        return historial
    
    def get_fecha_vencimiento_calculada(self, obj):
        """Calcula la fecha de vencimiento legal: fecha_presentacion + 30 días."""
        if not obj.fecha_presentacion:
            return None
        return obj.fecha_presentacion + timedelta(days=30)
    
    def get_dias_hasta_vencimiento(self, obj):
        """Calcula los días hasta el vencimiento (puede ser negativo si ya venció)."""
        fecha_vencimiento = self.get_fecha_vencimiento_calculada(obj)
        if not fecha_vencimiento:
            return None
        hoy = timezone.localdate()
        diferencia = (fecha_vencimiento - hoy).days
        return diferencia


class ChequeUpdateSerializer(serializers.Serializer):
    """Serializer para editar datos de un cheque.
    
    Solo permite editar campos básicos del cheque cuando está EN_CARTERA.
    Incluye validaciones de formato, rangos y algoritmo de CUIT.
    """
    
    numero = serializers.CharField(
        max_length=50,
        required=False,
        help_text='Número del cheque'
    )
    banco_emisor = serializers.CharField(
        max_length=100,
        required=False,
        help_text='Banco emisor del cheque'
    )
    monto = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0.01,
        required=False,
        help_text='Monto del cheque (debe ser mayor a 0)'
    )
    cuit_librador = serializers.CharField(
        max_length=11,
        required=False,
        help_text='CUIT del librador (11 dígitos, sin guiones)'
    )
    fecha_emision = serializers.DateField(
        required=False,
        help_text='Fecha de emisión del cheque'
    )
    fecha_presentacion = serializers.DateField(
        required=False,
        help_text='Fecha de presentación del cheque'
    )
    
    def validate_monto(self, valor):
        """Valida que el monto sea positivo."""
        if valor is not None and valor <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a 0.')
        return valor
    
    def validate_cuit_librador(self, valor):
        """Valida el CUIT usando el algoritmo de dígito verificador.
        
        Usa el algoritmo existente en ferreapps.clientes.algoritmo_cuit_utils
        que valida formato y dígito verificador.
        """
        if not valor:
            return valor
        
        from ferreapps.clientes.algoritmo_cuit_utils import validar_cuit
        
        resultado = validar_cuit(valor)
        if not resultado.get('es_valido'):
            raise serializers.ValidationError(
                resultado.get('mensaje_error', 'CUIT inválido')
            )
        
        # Retornar CUIT limpio (11 dígitos sin guiones)
        return resultado.get('cuit_limpio', valor)
    
    def validate(self, data):
        """Validaciones cruzadas entre campos."""
        fecha_emision = data.get('fecha_emision')
        fecha_presentacion = data.get('fecha_presentacion')
        
        # Si ambas fechas están presentes, validar que emisión <= presentación
        if fecha_emision and fecha_presentacion:
            if fecha_emision > fecha_presentacion:
                raise serializers.ValidationError({
                    'fecha_emision': 'La fecha de emisión debe ser menor o igual a la fecha de presentación.'
                })
        
        return data


class CrearChequeCajaSerializer(serializers.Serializer):
    """Serializer para crear cheques directamente desde caja (caja general o cambio de cheque)."""

    numero = serializers.CharField(max_length=50, required=True)
    banco_emisor = serializers.CharField(max_length=100, required=True)
    monto = serializers.DecimalField(
        max_digits=15, decimal_places=2, min_value=Decimal('0.01'), required=True
    )
    cuit_librador = serializers.CharField(max_length=11, required=True)
    fecha_emision = serializers.DateField(required=True)
    fecha_presentacion = serializers.DateField(required=True)

    origen_tipo = serializers.ChoiceField(
        choices=[Cheque.ORIGEN_CAJA_GENERAL, Cheque.ORIGEN_CAMBIO_CHEQUE],
        required=True,
    )
    origen_cliente_id = serializers.IntegerField(required=False, allow_null=True)
    origen_descripcion = serializers.CharField(max_length=200, required=False, allow_blank=True)

    monto_efectivo_entregado = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        required=False,
        allow_null=True,
        help_text='Monto de efectivo entregado (debe ser <= monto del cheque)',
    )
    comision_cambio = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=Decimal('0.00'),
    )

    def validate_cuit_librador(self, valor):
        """Valida CUIT usando el algoritmo existente en clientes."""
        from ferreapps.clientes.algoritmo_cuit_utils import validar_cuit
        resultado = validar_cuit(valor)
        if not resultado.get('es_valido'):
            raise serializers.ValidationError(
                resultado.get('mensaje_error', 'CUIT inválido')
            )
        return resultado.get('cuit_limpio', valor)

    def validate(self, data):
        """Validaciones cruzadas: fechas y para cambio de cheque, montos."""
        fecha_emision = data.get('fecha_emision')
        fecha_presentacion = data.get('fecha_presentacion')
        if fecha_emision and fecha_presentacion and fecha_emision > fecha_presentacion:
            raise serializers.ValidationError({
                'fecha_emision': 'La fecha de emisión debe ser <= fecha de presentación.'
            })

        if data.get('origen_tipo') == Cheque.ORIGEN_CAMBIO_CHEQUE:
            monto_cheque = data.get('monto')
            monto_efectivo = data.get('monto_efectivo_entregado')
            comision = data.get('comision_cambio') or Decimal('0.00')

            if monto_efectivo is None:
                raise serializers.ValidationError({
                    'monto_efectivo_entregado': 'Debe especificar el monto de efectivo entregado.'
                })
            if monto_efectivo > monto_cheque:
                raise serializers.ValidationError({
                    'monto_efectivo_entregado': 'El efectivo entregado no puede ser mayor al monto del cheque.'
                })
            diferencia = monto_cheque - monto_efectivo - comision
            if abs(diferencia) > Decimal('0.01'):
                raise serializers.ValidationError({
                    'monto_efectivo_entregado': (
                        f'El monto del cheque ({monto_cheque}) debe ser igual a '
                        f'efectivo entregado ({monto_efectivo}) + comisión ({comision}).'
                    )
                })
        return data
