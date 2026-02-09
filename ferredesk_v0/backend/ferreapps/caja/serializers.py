"""Serializadores para el módulo de Caja.

Define los serializadores para la API REST de:
- SesionCaja
- MovimientoCaja  
- MetodoPago
- PagoVenta
"""

from rest_framework import serializers
from .models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    PagoVenta,
    CuentaBanco,
    Cheque,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
)


class MetodoPagoSerializer(serializers.ModelSerializer):
    """Serializador para métodos de pago."""
    
    class Meta:
        model = MetodoPago
        fields = [
            'id',
            'codigo',
            'nombre',
            'descripcion', 
            'afecta_arqueo',
            'activo',
            'orden',
        ]
        read_only_fields = ['id']


class SesionCajaSerializer(serializers.ModelSerializer):
    """Serializador para sesiones de caja."""
    
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    esta_abierta = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SesionCaja
        fields = [
            'id',
            'usuario',
            'usuario_nombre',
            'sucursal',
            'fecha_hora_inicio',
            'fecha_hora_fin',
            'saldo_inicial',
            'saldo_final_declarado',
            'saldo_final_sistema',
            'diferencia',
            'estado',
            'observaciones_cierre',
            'esta_abierta',
        ]
        read_only_fields = [
            'id',
            'usuario',
            'fecha_hora_inicio',
            'fecha_hora_fin',
            'saldo_final_sistema',
            'diferencia',
            'estado',
        ]


class AbrirCajaSerializer(serializers.Serializer):
    """Serializador para la acción de abrir caja."""
    
    saldo_inicial = serializers.DecimalField(
        max_digits=15, 
        decimal_places=2,
        min_value=0,
        help_text='Monto inicial declarado al abrir la caja'
    )
    sucursal = serializers.IntegerField(
        default=1,
        help_text='Identificador de sucursal'
    )
    
    def validate(self, data):
        """Valida que el usuario no tenga otra caja abierta."""
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('Usuario no autenticado')
        
        # Verificar si ya tiene una caja abierta
        caja_abierta = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        
        if caja_abierta:
            raise serializers.ValidationError(
                f'Ya tiene una caja abierta (ID: {caja_abierta.id}). '
                'Debe cerrarla antes de abrir otra.'
            )
        
        return data


class CerrarCajaSerializer(serializers.Serializer):
    """Serializador para la acción de cerrar caja (Cierre Z)."""
    
    saldo_final_declarado = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0,
        help_text='Monto contado físicamente al cerrar'
    )
    observaciones_cierre = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text='Observaciones opcionales del cierre'
    )


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Serializador para movimientos de caja."""
    
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    
    class Meta:
        model = MovimientoCaja
        fields = [
            'id',
            'sesion_caja',
            'usuario',
            'usuario_nombre',
            'tipo',
            'tipo_display',
            'monto',
            'descripcion',
            'fecha_hora',
        ]
        read_only_fields = ['id', 'usuario', 'sesion_caja', 'fecha_hora']


class CrearMovimientoSerializer(serializers.Serializer):
    """Serializador para crear un movimiento de caja."""
    
    tipo = serializers.ChoiceField(
        choices=['ENTRADA', 'SALIDA'],
        help_text='Tipo de movimiento'
    )
    monto = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0.01,
        help_text='Monto del movimiento'
    )
    descripcion = serializers.CharField(
        max_length=200,
        help_text='Descripción o motivo del movimiento'
    )


class PagoVentaSerializer(serializers.ModelSerializer):
    """Serializador para pagos de venta."""
    
    metodo_pago_nombre = serializers.CharField(
        source='metodo_pago.nombre', 
        read_only=True
    )
    metodo_pago_codigo = serializers.CharField(
        source='metodo_pago.codigo',
        read_only=True
    )
    cuenta_banco_nombre = serializers.CharField(source='cuenta_banco.nombre', read_only=True)
    
    class Meta:
        model = PagoVenta
        fields = [
            'id',
            'venta',
            'metodo_pago',
            'metodo_pago_nombre',
            'metodo_pago_codigo',
            'cuenta_banco',
            'cuenta_banco_nombre',
            'monto',
            'es_vuelto',
            'referencia_externa',
            'fecha_hora',
            'observacion',
        ]
        read_only_fields = ['id', 'fecha_hora']


# Longitud estándar de CBU/CVU (Argentina)
LONGITUD_CLAVE_BANCARIA = 22


class CuentaBancoSerializer(serializers.ModelSerializer):
    """Serializador para cuentas bancarias o billeteras virtuales."""

    class Meta:
        model = CuentaBanco
        fields = [
            'id',
            'tipo_entidad',
            'nombre',
            'alias',
            'clave_bancaria',
            'tipo_cuenta',
            'activo',
        ]
        read_only_fields = ['id']

    def validate_clave_bancaria(self, valor):
        """Exige 22 dígitos si se proporciona clave."""
        if valor is None or valor == '':
            return valor
        valor_limpio = ''.join(c for c in str(valor) if c.isdigit())
        if len(valor_limpio) != LONGITUD_CLAVE_BANCARIA:
            raise serializers.ValidationError(
                f'La clave bancaria (CBU/CVU) debe tener exactamente {LONGITUD_CLAVE_BANCARIA} dígitos.'
            )
        return valor_limpio


class ChequeSerializer(serializers.ModelSerializer):
    """Serializador para cheques (valores en cartera e historial)."""

    venta_id = serializers.IntegerField(source='venta.id', read_only=True)
    pago_venta_id = serializers.IntegerField(source='pago_venta.id', read_only=True)
    cuenta_banco_deposito_nombre = serializers.CharField(source='cuenta_banco_deposito.nombre', read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.razon', read_only=True)
    nota_debito_venta_id = serializers.SerializerMethodField()
    nota_debito_numero_formateado = serializers.SerializerMethodField()
    cliente_origen = serializers.SerializerMethodField()

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


class PagoVentaCreateSerializer(serializers.Serializer):
    """Serializador para crear pagos dentro del payload de venta.
    
    Se usa cuando se envía la lista de pagos al crear/confirmar una venta.
    """
    
    metodo_pago_id = serializers.IntegerField(
        required=False,
        help_text='ID del método de pago'
    )
    metodo_pago_codigo = serializers.CharField(
        required=False,
        max_length=30,
        help_text='Código del método de pago (alternativa a ID)'
    )
    monto = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0.01,
        help_text='Monto del pago'
    )
    referencia_externa = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text='Referencia externa opcional'
    )

    cuenta_banco_id = serializers.IntegerField(
        required=False,
        help_text='ID de la cuenta bancaria/billetera destino (transferencia/QR)'
    )
    
    def validate(self, data):
        """Valida que se proporcione ID o código del método de pago."""
        if not data.get('metodo_pago_id') and not data.get('metodo_pago_codigo'):
            raise serializers.ValidationError(
                'Debe proporcionar metodo_pago_id o metodo_pago_codigo'
            )
        return data
